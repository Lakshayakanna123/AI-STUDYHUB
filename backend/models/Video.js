const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    description: String,
    url: { type: String, required: true }, // local path or Cloudinary/S3 URL
    durationSeconds: { type: Number, default: 0 },
    notesUrl: String, // downloadable notes (PDF etc.)
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // AI pipeline status
    transcriptStatus: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending' },
    questionsGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);
