const mongoose = require('mongoose');

const rateLimitEntrySchema = new mongoose.Schema({
  scope: { type: String, required: true, maxlength: 80 },
  keyHash: { type: String, required: true, maxlength: 64 },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });

rateLimitEntrySchema.index({ scope: 1, keyHash: 1, windowStart: 1 }, { unique: true });
rateLimitEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RateLimitEntry', rateLimitEntrySchema);
