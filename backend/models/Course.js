const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: String,
    message: String,
    postedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    announcements: [announcementSchema],
    joinCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
