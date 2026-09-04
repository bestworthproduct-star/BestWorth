const mongoose = require('mongoose');

const workerAccessGrantSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: String, enum: ['view', 'manage'], required: true },
  reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 300 },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

workerAccessGrantSchema.index({ actor: 1, target: 1 }, { unique: true });
workerAccessGrantSchema.index({ actor: 1, revokedAt: 1 });
workerAccessGrantSchema.index({ target: 1, revokedAt: 1 });

module.exports = mongoose.model('WorkerAccessGrant', workerAccessGrantSchema);
