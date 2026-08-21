const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
const Content = require('../models/Content');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { sendInquiryNotification, sendInquiryConfirmation, sendAdminReply } = require('../utils/email');
const { rateLimit, clientIp } = require('../utils/rate-limit');
const { stringField, emailField, objectId } = require('../utils/validation');

const inquiryLimit = rateLimit({ scope: 'public-inquiry', limit: 5, windowMs: 60 * 60 * 1000 });
const replyLimit = rateLimit({ scope: 'inquiry-reply', limit: 30, windowMs: 60 * 60 * 1000, key: (req) => `${clientIp(req)}:${req.user.id}` });

async function getCmsEmailData() {
  const [docs, adminUser] = await Promise.all([
    Content.find({ key: { $in: ['contact', 'footer', 'branding'] } }),
    User.findOne({ $or: [{ role: 'admin' }, { role: { $exists: false } }] }).select('notificationEmails').lean()
  ]);

  const cmsData = docs.reduce((accumulator, document) => {
    accumulator[document.key] = document.data;
    return accumulator;
  }, {});

  cmsData.notificationEmails = adminUser?.notificationEmails || [];
  return cmsData;
}

// Public: Submit inquiry
router.post('/', inquiryLimit, async (req, res) => {
  const { policyAcknowledged } = req.body || {};

  if (req.body?.website) return res.status(201).json({ message: 'Inquiry received.' });

  if (policyAcknowledged !== true) {
    return res.status(400).json({
      message: 'Please acknowledge the Privacy Policy and Cookie Policy before submitting your inquiry.'
    });
  }

  try {
    const inquiry = new Inquiry({
      name: stringField(req.body?.name, { name: 'Full name', required: true, max: 120 }),
      email: emailField(req.body?.email),
      company: stringField(req.body?.company, { name: 'Company', max: 160 }),
      message: stringField(req.body?.message, { name: 'Message', required: true, max: 5000 }),
      policyAcknowledged: true,
      policyAcknowledgedAt: new Date()
    });
    const newInquiry = await inquiry.save();
    
    let emailSent = true;
    try {
      const cmsData = await getCmsEmailData();
      await sendInquiryNotification(newInquiry, cmsData);
      await sendInquiryConfirmation(newInquiry, cmsData);
    } catch (emailError) {
      emailSent = false;
      console.error('[inquiries] inquiry notification email failed', {
        inquiryId: String(newInquiry._id),
        message: emailError.message
      });
    }
    
    req.app.get('io').to('module:inquiries').emit('inquiry_change', { action: 'create', data: newInquiry });
    res.status(201).json({ message: 'Inquiry received.', id: String(newInquiry._id), emailSent });
  } catch (err) {
    if (/required|must be|invalid|characters/i.test(err.message)) return res.status(400).json({ message: err.message });
    console.error('[inquiries] submission failed:', err.message);
    res.status(500).json({ message: 'Your inquiry could not be submitted. Please try again.' });
  }
});

// Admin: Reply to inquiry
router.post('/reply', auth, requirePermission('inquiries', 'manage'), replyLimit, async (req, res) => {
  const { inquiryId } = req.body;
  try {
    objectId(inquiryId, 'Inquiry ID');
    const subject = stringField(req.body?.subject, { name: 'Subject', required: true, max: 200 });
    const message = stringField(req.body?.message, { name: 'Message', required: true, max: 10000 });
    const inquiry = await Inquiry.findById(inquiryId);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found.' });
    const cmsData = await getCmsEmailData();
    await sendAdminReply(inquiry.email, subject, message, cmsData);

    // 2. Save reply to database if inquiryId is provided
    if (inquiryId) {
      const updateData = {
        reply: {
          subject,
          message,
          sentAt: new Date()
        }
      };

      // Mark as read if it was previously 'new'
      if (inquiry && inquiry.status === 'new') {
        updateData.status = 'read';
      }

      await Inquiry.findByIdAndUpdate(inquiryId, updateData);

      // Notify frontend via socket
      req.app.get('io').to('module:inquiries').emit('inquiry_change', { action: 'reply', id: inquiryId });
    }

    res.json({ message: 'Reply sent successfully' });
  } catch (err) {
    if (/required|invalid|characters/i.test(err.message)) return res.status(400).json({ message: err.message });
    console.error('[inquiries] reply failed:', err.message);
    res.status(500).json({ message: 'Email delivery failed.' });
  }
});

// Admin: Bulk delete inquiries
router.delete('/bulk', auth, requirePermission('inquiries', 'manage'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !require('mongoose').isValidObjectId(id))) {
      return res.status(400).json({ message: 'Invalid IDs provided' });
    }
    await Inquiry.deleteMany({ _id: { $in: ids } });
    req.app.get('io').to('module:inquiries').emit('inquiry_change', { action: 'bulk_delete', ids });
    res.json({ message: 'Inquiries deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Inquiries could not be deleted.' });
  }
});

// Admin: Delete single inquiry
router.delete('/:id', auth, requirePermission('inquiries', 'manage'), async (req, res) => {
  try {
    objectId(req.params.id, 'Inquiry ID');
    await Inquiry.findByIdAndDelete(req.params.id);
    req.app.get('io').to('module:inquiries').emit('inquiry_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Inquiry deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Inquiry could not be deleted.' });
  }
});

// Admin: Get all inquiries
router.get('/', auth, requirePermission('inquiries', 'view'), async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ message: 'Inquiries could not be loaded.' });
  }
});

// Admin: Update inquiry status
router.patch('/:id', auth, requirePermission('inquiries', 'manage'), async (req, res) => {
  try {
    objectId(req.params.id, 'Inquiry ID');
    if (!['new', 'read', 'archived'].includes(req.body?.status)) return res.status(400).json({ message: 'Invalid inquiry status.' });
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    req.app.get('io').to('module:inquiries').emit('inquiry_change', { action: 'update', data: inquiry });
    res.json(inquiry);
  } catch (err) {
    res.status(400).json({ message: 'Inquiry status could not be updated.' });
  }
});

module.exports = router;
