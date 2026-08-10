const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, unique: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    rawText: { type: String, required: true },
    summary: { type: String },
    keyConcepts: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transcript', transcriptSchema);
