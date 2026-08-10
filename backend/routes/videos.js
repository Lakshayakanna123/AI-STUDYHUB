const express = require('express');
const axios = require('axios');
const Video = require('../models/Video');
const Course = require('../models/Course');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @route  POST /api/videos/:courseId  (teacher uploads a lecture video)
router.post(
  '/:courseId',
  protect,
  authorize('teacher'),
  upload.single('video'),
  async (req, res) => {
    try {
      const course = await Course.findOne({ _id: req.params.courseId, teacher: req.user._id });
      if (!course) return res.status(404).json({ message: 'Course not found' });
      if (!req.file) return res.status(400).json({ message: 'Video file is required' });

      const video = await Video.create({
        course: course._id,
        title: req.body.title || req.file.originalname,
        description: req.body.description,
        url: `/uploads/${req.file.filename}`,
        uploadedBy: req.user._id,
      });

      course.videos.push(video._id);
      await course.save();

      // Kick off AI pipeline asynchronously: transcribe -> summarize -> generate questions.
      // Fire-and-forget; the AI service updates transcriptStatus/questionsGenerated when done.
      axios
        .post(`${process.env.AI_SERVICE_URL}/transcribe/process-video`, {
          videoId: video._id.toString(),
          videoUrl: video.url,
          courseId: course._id.toString(),
        })
        .catch((err) => console.error('AI service trigger failed:', err.message));

      video.transcriptStatus = 'processing';
      await video.save();

      res.status(201).json(video);
    } catch (err) {
      res.status(500).json({ message: 'Video upload failed', error: err.message });
    }
  }
);

// @route  GET /api/videos/course/:courseId
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const videos = await Video.find({ course: req.params.courseId }).sort({ createdAt: 1 });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch videos', error: err.message });
  }
});

// @route  PUT /api/videos/:id  (teacher edits title/description/notes)
router.put('/:id', protect, authorize('teacher'), async (req, res) => {
  try {
    const video = await Video.findOneAndUpdate(
      { _id: req.params.id, uploadedBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!video) return res.status(404).json({ message: 'Video not found' });
    res.json(video);
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

// @route  DELETE /api/videos/:id
router.delete('/:id', protect, authorize('teacher'), async (req, res) => {
  try {
    const video = await Video.findOneAndDelete({ _id: req.params.id, uploadedBy: req.user._id });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    await Course.findByIdAndUpdate(video.course, { $pull: { videos: video._id } });
    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

module.exports = router;
