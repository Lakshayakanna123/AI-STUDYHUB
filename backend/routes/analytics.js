const express = require('express');
const Course = require('../models/Course');
const Video = require('../models/Video');
const { Quiz } = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const VideoProgress = require('../models/VideoProgress');
const { StudentProgress } = require('../models/Misc');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route  GET /api/analytics/teacher  (dashboard summary + per-student table)
router.get('/teacher', protect, authorize('teacher'), async (req, res) => {
  try {
    const courses = await Course.find({ teacher: req.user._id }).populate('students', 'name email lastActive');
    const courseIds = courses.map((c) => c._id);

    const videos = await Video.find({ course: { $in: courseIds } });
    const quizzes = await Quiz.find({ course: { $in: courseIds } });
    const attempts = await QuizAttempt.find({ course: { $in: courseIds } }).populate('student', 'name');

    const totalStudents = new Set(courses.flatMap((c) => c.students.map((s) => s._id.toString()))).size;
    const avgScore = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
      : 0;

    // Per-student rows across all of this teacher's courses
    const studentRows = [];
    for (const course of courses) {
      for (const student of course.students) {
        const progress = await StudentProgress.findOne({ student: student._id, course: course._id });
        const videoProgresses = await VideoProgress.find({ student: student._id, course: course._id });
        const avgWatch = videoProgresses.length
          ? Math.round(videoProgresses.reduce((s, v) => s + v.completionPercent, 0) / videoProgresses.length)
          : 0;
        const totalWatchTime = videoProgresses.reduce((s, v) => s + v.watchedSeconds, 0);
        const pauseCount = videoProgresses.reduce((s, v) => s + v.pauseCount, 0);
        const replayCount = videoProgresses.reduce((s, v) => s + v.replayCount, 0);

        studentRows.push({
          studentName: student.name,
          course: course.title,
          lastActive: student.lastActive,
          videoWatchPercent: avgWatch,
          totalWatchTimeSeconds: totalWatchTime,
          pauseCount,
          replayCount,
          videoCompletionStatus: avgWatch >= 90 ? 'Completed' : 'In Progress',
          quizScore: progress?.avgQuizScore || 0,
          overallProgress: progress?.overallProgressPercent || avgWatch,
          learningScore: progress?.learningScore || 'Average',
          performancePrediction: progress?.performancePrediction || 'On track',
        });
      }
    }

    res.json({
      totalStudents,
      totalCourses: courses.length,
      totalVideos: videos.length,
      totalQuizzes: quizzes.length,
      averageScore: avgScore,
      students: studentRows,
      videoCompletionStats: videos.map((v) => ({ videoId: v._id, title: v.title })), // extend with real stats as needed
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load teacher analytics', error: err.message });
  }
});

// @route  GET /api/analytics/student  (student's own dashboard)
router.get('/student', protect, authorize('student'), async (req, res) => {
  try {
    const progressList = await StudentProgress.find({ student: req.user._id }).populate('course', 'title');
    const attempts = await QuizAttempt.find({ student: req.user._id }).populate('quiz', 'title');

    res.json({
      courses: progressList,
      quizHistory: attempts.map((a) => ({
        quizTitle: a.quiz?.title,
        score: a.totalScore,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        feedback: a.aiFeedbackSummary,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load student analytics', error: err.message });
  }
});

module.exports = router;
