const express = require('express');
const VideoProgress = require('../models/VideoProgress');
const { StudentProgress, Analytics } = require('../models/Misc');
const Video = require('../models/Video');
const { protect } = require('../middleware/auth');

const router = express.Router();

const QUIZ_UNLOCK_THRESHOLD = 90; // % watched

// @route  POST /api/progress/video
// body: { videoId, courseId, positionSeconds, watchedDeltaSeconds, durationSeconds, event, unlockNow }
router.post('/video', protect, async (req, res) => {
  try {
    const { videoId, courseId, positionSeconds, watchedDeltaSeconds = 0, durationSeconds = 0, event, unlockNow } = req.body;

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const effectiveCourseId = courseId || video.course;

    if (durationSeconds > 0 && (!video.durationSeconds || video.durationSeconds === 0)) {
      video.durationSeconds = Math.round(durationSeconds);
      await video.save();
    }

    let progress = await VideoProgress.findOne({ student: req.user._id, video: videoId });
    if (!progress) {
      progress = new VideoProgress({ student: req.user._id, video: videoId, course: effectiveCourseId });
    } else if (!progress.course) {
      progress.course = effectiveCourseId;
    }

    progress.lastPositionSeconds = positionSeconds ?? progress.lastPositionSeconds;
    progress.watchedSeconds += watchedDeltaSeconds;
    if (event === 'pause') progress.pauseCount += 1;
    if (event === 'replay') progress.replayCount += 1;

    const effectiveDuration = durationSeconds || video.durationSeconds || 0;
    if (effectiveDuration > 0) {
      const posPercent = Math.round((progress.lastPositionSeconds / effectiveDuration) * 100);
      const watchedPercent = Math.round((progress.watchedSeconds / effectiveDuration) * 100);
      progress.completionPercent = Math.min(100, Math.max(posPercent, watchedPercent));
    }

    if (unlockNow || progress.completionPercent >= QUIZ_UNLOCK_THRESHOLD) {
      progress.completionPercent = 100;
      progress.isCompleted = true;
      progress.quizUnlocked = true;
    }

    await progress.save();

    // Recalculate rolled up StudentProgress
    if (courseId) {
      const allVp = await VideoProgress.find({ student: req.user._id, course: courseId });
      const completedCount = allVp.filter((vp) => vp.isCompleted).length;
      const totalVids = await Video.countDocuments({ course: courseId });
      const avgWatch = totalVids > 0
        ? Math.round(allVp.reduce((s, v) => s + (v.completionPercent || 0), 0) / totalVids)
        : (allVp.length ? Math.round(allVp.reduce((s, v) => s + v.completionPercent, 0) / allVp.length) : 0);

      const existingSp = await StudentProgress.findOne({ student: req.user._id, course: courseId });
      const quizAvg = existingSp?.avgQuizScore || 0;
      const overall = Math.round(existingSp?.avgQuizScore ? (avgWatch * 0.4 + quizAvg * 0.6) : avgWatch);

      await StudentProgress.findOneAndUpdate(
        { student: req.user._id, course: courseId },
        {
          videosCompleted: completedCount,
          totalVideos: totalVids,
          overallProgressPercent: overall,
          learningScore: overall >= 85 ? 'Excellent' : overall >= 70 ? 'Good' : overall >= 50 ? 'Average' : 'Needs Improvement',
          performancePrediction: quizAvg >= 80 && avgWatch >= 70 ? 'High Performer' : (quizAvg < 50 || avgWatch < 30 ? 'At risk' : 'On track'),
        },
        { upsert: true, new: true }
      );
    }

    await Analytics.create({
      student: req.user._id,
      course: courseId,
      eventType: 'video_watch',
      metadata: { videoId, event, completionPercent: progress.completionPercent },
    });

    res.json(progress);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update progress', error: err.message });
  }
});

// @route  POST /api/progress/video/:videoId/unlock (manually unlock quiz for demo/testing)
router.post('/video/:videoId/unlock', protect, async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    let progress = await VideoProgress.findOne({ student: req.user._id, video: videoId });
    if (!progress) {
      progress = new VideoProgress({ student: req.user._id, video: videoId, course: video.course });
    }

    progress.completionPercent = 100;
    progress.isCompleted = true;
    progress.quizUnlocked = true;
    await progress.save();

    res.json(progress);
  } catch (err) {
    res.status(500).json({ message: 'Failed to unlock quiz', error: err.message });
  }
});

// @route  GET /api/progress/video/:videoId  (resume position + unlock status)
router.get('/video/:videoId', protect, async (req, res) => {
  try {
    const progress = await VideoProgress.findOne({
      student: req.user._id,
      video: req.params.videoId,
    });
    res.json(progress || { lastPositionSeconds: 0, completionPercent: 0, quizUnlocked: false });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch progress', error: err.message });
  }
});

// @route  GET /api/progress/course/:courseId  (aggregated progress)
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const progress = await StudentProgress.findOne({
      student: req.user._id,
      course: req.params.courseId,
    });
    res.json(progress || null);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch progress', error: err.message });
  }
});

module.exports = router;

