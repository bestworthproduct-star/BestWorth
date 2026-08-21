const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  company: { type: String, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  policyAcknowledged: { type: Boolean, required: true },
  policyAcknowledgedAt: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['new', 'read', 'archived'],
    default: 'new'
  },
  reply: {
    subject: { type: String, maxlength: 200 },
    message: { type: String, maxlength: 10000 },
    sentAt: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', inquirySchema);
