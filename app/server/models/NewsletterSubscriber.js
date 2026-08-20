const mongoose = require('mongoose');

const newsletterSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed', index: true },
  consentAt: { type: Date, required: true },
  unsubscribedAt: { type: Date },
  unsubscribeToken: { type: String, required: true, unique: true, index: true },
  ipAddress: { type: String, trim: true },
  userAgent: { type: String, trim: true, maxlength: 500 }
}, { timestamps: true });

newsletterSubscriberSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
