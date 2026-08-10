const express = require('express');
const axios = require('axios');
const { ChatHistory, Analytics } = require('../models/Misc');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route  POST /api/chatbot/:courseId
// body: { message }
router.post('/:courseId', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const { courseId } = req.params;

    const { data } = await axios.post(`${process.env.AI_SERVICE_URL}/chat/ask`, {
      courseId,
      question: message,
    });
    // data = { answer, sources: [...] }

    await ChatHistory.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $push: {
          messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: data.answer },
          ],
        },
      },
      { upsert: true }
    );

    await Analytics.create({
      student: req.user._id,
      course: courseId,
      eventType: 'chatbot_query',
      metadata: { message },
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Chatbot request failed', error: err.message });
  }
});

// @route  GET /api/chatbot/:courseId/history
router.get('/:courseId/history', protect, async (req, res) => {
  try {
    const history = await ChatHistory.findOne({ student: req.user._id, course: req.params.courseId });
    res.json(history?.messages || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch chat history', error: err.message });
  }
});

module.exports = router;

