const express = require('express');
const crypto = require('crypto');
const Course = require('../models/Course');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route  POST /api/courses  (teacher creates a course)
router.post('/', protect, authorize('teacher'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const course = await Course.create({ title, description, teacher: req.user._id, joinCode });
    await User.findByIdAndUpdate(req.user._id, { $push: { coursesCreated: course._id } });

    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create course', error: err.message });
  }
});

// @route  GET /api/courses  (list: teacher's own courses, or student's available/enrolled)
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      const courses = await Course.find({ teacher: req.user._id }).populate('students', 'name email');
      return res.json(courses);
    }
    // student: all courses (available to join) + flag which they're enrolled in
    const courses = await Course.find().populate('teacher', 'name email');
    return res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch courses', error: err.message });
  }
});

// @route  GET /api/courses/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('students', 'name email')
      .populate('videos');
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course', error: err.message });
  }
});

// @route  POST /api/courses/:id/enroll  (student joins by course id, or use /join with code)
router.post('/:id/enroll', protect, authorize('student'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (course.students.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already enrolled' });
    }
    course.students.push(req.user._id);
    await course.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { coursesEnrolled: course._id } });

    res.json({ message: 'Enrolled successfully', course });
  } catch (err) {
    res.status(500).json({ message: 'Enrollment failed', error: err.message });
  }
});

// @route  POST /api/courses/join  (student joins via join code)
router.post('/join', protect, authorize('student'), async (req, res) => {
  try {
    const { joinCode } = req.body;
    const course = await Course.findOne({ joinCode: joinCode?.toUpperCase() });
    if (!course) return res.status(404).json({ message: 'Invalid join code' });

    if (!course.students.includes(req.user._id)) {
      course.students.push(req.user._id);
      await course.save();
      await User.findByIdAndUpdate(req.user._id, { $push: { coursesEnrolled: course._id } });
    }
    res.json({ message: 'Joined course', course });
  } catch (err) {
    res.status(500).json({ message: 'Join failed', error: err.message });
  }
});

// @route  POST /api/courses/:id/announcements  (teacher)
router.post('/:id/announcements', protect, authorize('teacher'), async (req, res) => {
  try {
    const { title, message } = req.body;
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      { $push: { announcements: { title, message } } },
      { new: true }
    );
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Failed to post announcement', error: err.message });
  }
});

// @route  PUT /api/courses/:id
router.put('/:id', protect, authorize('teacher'), async (req, res) => {
  try {
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      req.body,
      { new: true }
    );
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

// @route  DELETE /api/courses/:id
router.delete('/:id', protect, authorize('teacher'), async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ _id: req.params.id, teacher: req.user._id });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

module.exports = router;
