const mongoose = require('mongoose');

const progressiveRateLimitEntrySchema = new mongoose.Schema({
  _id: { type: String, required: true, maxlength: 64 },
  scope: { type: String, required: true, maxlength: 80 },
  keyHash: { type: String, required: true, maxlength: 64 },
  failureCount: { type: Number, default: 0, min: 0 },
  strikeLevel: { type: Number, default: 0, min: 0 },
  blockedUntil: { type: Date, default: null },
  lastFailureAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });

progressiveRateLimitEntrySchema.index({ scope: 1, keyHash: 1 }, { unique: true });
progressiveRateLimitEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProgressiveRateLimitEntry', progressiveRateLimitEntrySchema);
