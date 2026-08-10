const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['mcq', 'true_false', 'fill_blank', 'short_answer', 'long_answer'],
    required: true,
  },
  questionText: { type: String, required: true },
  options: [String], // for MCQ
  correctAnswer: { type: String }, // for MCQ / true-false / fill-blank
  modelAnswer: { type: String }, // for short/long answer AI comparison
  marks: { type: Number, default: 1 },
  aiGenerated: { type: Boolean, default: true },
});

const quizSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    questions: [questionSchema],
    published: { type: Boolean, default: false },
    totalMarks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

quizSchema.pre('save', function (next) {
  this.totalMarks = this.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  next();
});

// GeneratedQuestions collection kept separate as a staging area before teacher
// approves/edits and the quiz gets published (mirrors the brief's DB design).
const generatedQuestionSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    questions: [questionSchema],
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = {
  Quiz: mongoose.model('Quiz', quizSchema),
  GeneratedQuestion: mongoose.model('GeneratedQuestion', generatedQuestionSchema),
};
