const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },

    lastPositionSeconds: { type: Number, default: 0 }, // resume playback
    watchedSeconds: { type: Number, default: 0 }, // cumulative active watch time
    completionPercent: { type: Number, default: 0 },
    pauseCount: { type: Number, default: 0 },
    replayCount: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false }, // true when >= 90%
    quizUnlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

videoProgressSchema.index({ student: 1, video: 1 }, { unique: true });

module.exports = mongoose.model('VideoProgress', videoProgressSchema);
