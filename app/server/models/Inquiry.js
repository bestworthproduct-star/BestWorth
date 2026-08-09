const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  company: { type: String },
  message: { type: String, required: true },
  policyAcknowledged: { type: Boolean, required: true },
  policyAcknowledgedAt: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['new', 'read', 'archived'],
    default: 'new'
  },
  reply: {
    subject: String,
    message: String,
    sentAt: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', inquirySchema);
