const mongoose = require('mongoose');

const newsletterCampaignSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'NewsMediaPost', required: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  previewText: { type: String, trim: true, maxlength: 300, default: '' },
  status: {
    type: String,
    enum: ['sending', 'sent', 'partial', 'failed'],
    default: 'sending',
    index: true
  },
  isTest: { type: Boolean, default: false, index: true },
  testEmail: { type: String, trim: true, lowercase: true, default: '' },
  recipientCount: { type: Number, default: 0, min: 0 },
  sentCount: { type: Number, default: 0, min: 0 },
  failedCount: { type: Number, default: 0, min: 0 },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  lastError: { type: String, maxlength: 500, default: '' }
}, { timestamps: true });

newsletterCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NewsletterCampaign', newsletterCampaignSchema);
