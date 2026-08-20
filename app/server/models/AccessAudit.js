const mongoose = require('mongoose');

const accessAuditSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, trim: true },
  ipAddress: { type: String, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

accessAuditSchema.index({ createdAt: -1 });
accessAuditSchema.index({ targetUser: 1, createdAt: -1 });

module.exports = mongoose.model('AccessAudit', accessAuditSchema);
