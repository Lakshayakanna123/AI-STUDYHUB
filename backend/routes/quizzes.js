const express = require('express');
const axios = require('axios');
const { Quiz, GeneratedQuestion } = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const VideoProgress = require('../models/VideoProgress');
const Video = require('../models/Video');
const Transcript = require('../models/Transcript');
const { StudentProgress } = require('../models/Misc');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route  GET /api/quizzes/generated/:videoId  (teacher reviews AI-generated draft questions)
router.get('/generated/:videoId', protect, authorize('teacher'), async (req, res) => {
  try {
    const draft = await GeneratedQuestion.findOne({ video: req.params.videoId });
    if (!draft) return res.status(404).json({ message: 'No AI-generated questions yet' });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch draft questions', error: err.message });
  }
});

// @route  PUT /api/quizzes/generated/:videoId  (teacher edits/adds/deletes questions in draft)
router.put('/generated/:videoId', protect, authorize('teacher'), async (req, res) => {
  try {
    const draft = await GeneratedQuestion.findOneAndUpdate(
      { video: req.params.videoId },
      { questions: req.body.questions, reviewed: true },
      { new: true }
    );
    if (!draft) return res.status(404).json({ message: 'Draft not found' });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update draft', error: err.message });
  }
});

// @route  POST /api/quizzes/generated/:videoId/publish  (teacher publishes reviewed questions as a live quiz)
router.post('/generated/:videoId/publish', protect, authorize('teacher'), async (req, res) => {
  try {
    const draft = await GeneratedQuestion.findOne({ video: req.params.videoId });
    if (!draft) return res.status(404).json({ message: 'Draft not found' });

    const quiz = await Quiz.create({
      video: draft.video,
      course: req.body.courseId,
      title: req.body.title || 'Lecture Quiz',
      questions: draft.questions,
      published: true,
    });

    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Failed to publish quiz', error: err.message });
  }
});

// Helper: Auto-generate quiz via AI service from transcript or video title
async function autoGenerateQuiz(videoId) {
  try {
    const video = await Video.findById(videoId);
    if (!video) return null;

    // Look up existing transcript
    const transcript = await Transcript.findOne({ video: videoId });
    const transcriptText = transcript ? transcript.rawText : '';

    console.log(`[Quiz Auto-Gen] Calling AI service for video "${video.title}" (${videoId})`);

    const { data } = await axios.post(`${process.env.AI_SERVICE_URL}/transcribe/generate-quiz`, {
      transcript: transcriptText,
      title: video.title || 'Lecture',
      videoId: videoId.toString(),
      courseId: video.course.toString(),
    });

    if (data.status === 'generated') {
      // Reload the quiz that the AI service just saved to DB
      const quiz = await Quiz.findOne({ video: videoId, published: true });
      return quiz;
    }
    return null;
  } catch (err) {
    console.error(`[Quiz Auto-Gen] Failed for video ${videoId}:`, err.message);
    return null;
  }
}

// @route  POST /api/quizzes/generate/:videoId  (explicitly trigger quiz generation)
router.post('/generate/:videoId', protect, async (req, res) => {
  try {
    // Check if quiz already exists
    let quiz = await Quiz.findOne({ video: req.params.videoId, published: true });
    if (quiz) {
      const safeQuiz = quiz.toObject();
      if (req.user.role === 'student') {
        safeQuiz.questions = safeQuiz.questions.map(({ correctAnswer, modelAnswer, ...q }) => q);
      }
      return res.json({ status: 'existing', quiz: safeQuiz });
    }

    // Auto-generate
    quiz = await autoGenerateQuiz(req.params.videoId);
    if (!quiz) {
      return res.status(500).json({ message: 'Quiz generation failed. Please try again.' });
    }

    const safeQuiz = quiz.toObject();
    if (req.user.role === 'student') {
      safeQuiz.questions = safeQuiz.questions.map(({ correctAnswer, modelAnswer, ...q }) => q);
    }
    res.status(201).json({ status: 'generated', quiz: safeQuiz });
  } catch (err) {
    res.status(500).json({ message: 'Quiz generation failed', error: err.message });
  }
});

// @route  GET /api/quizzes/video/:videoId  (fetch quiz — auto-generates if missing)
router.get('/video/:videoId', protect, async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const progress = await VideoProgress.findOne({ student: req.user._id, video: req.params.videoId });
      if (!progress || !progress.quizUnlocked) {
        return res.status(403).json({ message: 'Watch at least 90% of the video to unlock the quiz' });
      }
    }

    let quiz = await Quiz.findOne({ video: req.params.videoId, published: true });

    // Auto-generate if quiz doesn't exist yet
    if (!quiz) {
      console.log(`[Quiz] No published quiz found for video ${req.params.videoId}, triggering auto-generation...`);
      quiz = await autoGenerateQuiz(req.params.videoId);
    }

    if (!quiz) return res.status(404).json({ message: 'Quiz not available', canGenerate: true });

    const safeQuiz = quiz.toObject();
    if (req.user.role === 'student') {
      safeQuiz.questions = safeQuiz.questions.map(({ correctAnswer, modelAnswer, ...q }) => q);
    }
    res.json(safeQuiz);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quiz', error: err.message });
  }
});

// @route  POST /api/quizzes/:quizId/submit  (submits answers; AI evaluates)
// body: { answers: [{ questionId, studentAnswer }] }
router.post('/:quizId/submit', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const { data } = await axios.post(`${process.env.AI_SERVICE_URL}/evaluate/quiz`, {
      questions: quiz.questions,
      answers: req.body.answers,
    });
    // data = { results: [...], totalScore, totalMarks, feedbackSummary }

    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: req.user._id,
      course: quiz.course,
      answers: data.results,
      totalScore: data.totalScore,
      totalMarks: data.totalMarks,
      percentage: data.totalMarks ? Math.round((data.totalScore / data.totalMarks) * 100) : 0,
      aiFeedbackSummary: data.feedbackSummary,
    });

    // Roll up into StudentProgress
    const existing = await StudentProgress.findOne({ student: req.user._id, course: quiz.course });
    const newAvg = existing
      ? Math.round((existing.avgQuizScore + attempt.percentage) / 2)
      : attempt.percentage;
    await StudentProgress.findOneAndUpdate(
      { student: req.user._id, course: quiz.course },
      {
        avgQuizScore: newAvg,
        learningScore: newAvg >= 85 ? 'Excellent' : newAvg >= 70 ? 'Good' : newAvg >= 50 ? 'Average' : 'Needs Improvement',
      },
      { upsert: true, new: true }
    );

    res.status(201).json(attempt);
  } catch (err) {
    res.status(500).json({ message: 'Quiz submission/evaluation failed', error: err.message });
  }
});

// @route  GET /api/quizzes/attempts/:courseId  (teacher views all attempts for a course)
router.get('/attempts/:courseId', protect, authorize('teacher'), async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ course: req.params.courseId })
      .populate('student', 'name email')
      .populate('quiz', 'title');
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch attempts', error: err.message });
  }
});

module.exports = router;

