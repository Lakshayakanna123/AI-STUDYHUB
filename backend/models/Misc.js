const mongoose = require('mongoose');

// Aggregated per-course progress for a student (rolled up from VideoProgress + QuizAttempt)
const studentProgressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    videosCompleted: { type: Number, default: 0 },
    totalVideos: { type: Number, default: 0 },
    avgQuizScore: { type: Number, default: 0 },
    overallProgressPercent: { type: Number, default: 0 },
    learningScore: {
      type: String,
      enum: ['Excellent', 'Good', 'Average', 'Needs Improvement'],
      default: 'Average',
    },
    performancePrediction: { type: String }, // e.g. "On track", "At risk"
    weakTopics: [String],
    recommendedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  },
  { timestamps: true }
);
studentProgressSchema.index({ student: 1, course: 1 }, { unique: true });

// Snapshot analytics events (login, chatbot usage, etc.) for learning-analytics AI feature
const analyticsSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    eventType: {
      type: String,
      enum: ['login', 'video_watch', 'quiz_attempt', 'chatbot_query', 'retry'],
      required: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const reportSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    quizAttempt: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizAttempt' },
    scoreSummary: String,
    strengths: [String],
    weakTopics: [String],
    improvementSuggestions: [String],
  },
  { timestamps: true }
);

const chatHistorySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'] },
        content: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const certificateSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    issuedAt: { type: Date, default: Date.now },
    certificateUrl: String,
  },
  { timestamps: true }
);

module.exports = {
  StudentProgress: mongoose.model('StudentProgress', studentProgressSchema),
  Analytics: mongoose.model('Analytics', analyticsSchema),
  Report: mongoose.model('Report', reportSchema),
  ChatHistory: mongoose.model('ChatHistory', chatHistorySchema),
  Certificate: mongoose.model('Certificate', certificateSchema),
};
