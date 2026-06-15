const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
const auth = require('../middleware/auth');
const { sendInquiryNotification, sendAdminReply } = require('../utils/email');

// Public: Submit inquiry
router.post('/', async (req, res) => {
  const inquiry = new Inquiry(req.body);
  try {
    const newInquiry = await inquiry.save();
    
    // Send email notification to company
    await sendInquiryNotification(newInquiry);
    
    req.app.get('io').emit('inquiry_change', { action: 'create', data: newInquiry });
    res.status(201).json(newInquiry);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Reply to inquiry
router.post('/reply', auth, async (req, res) => {
  const { to, subject, message, inquiryId, cmsData } = req.body;
  try {
    // 1. Send the actual email with CMS footer data
    await sendAdminReply(to, subject, message, cmsData);

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
      const inquiry = await Inquiry.findById(inquiryId);
      if (inquiry && inquiry.status === 'new') {
        updateData.status = 'read';
      }

      await Inquiry.findByIdAndUpdate(inquiryId, updateData);

      // Notify frontend via socket
      req.app.get('io').emit('inquiry_change', { action: 'reply', id: inquiryId });
    }

    res.json({ message: 'Reply sent successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Bulk delete inquiries
router.delete('/bulk', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Invalid IDs provided' });
    }
    await Inquiry.deleteMany({ _id: { $in: ids } });
    req.app.get('io').emit('inquiry_change', { action: 'bulk_delete', ids });
    res.json({ message: 'Inquiries deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Delete single inquiry
router.delete('/:id', auth, async (req, res) => {
  try {
    await Inquiry.findByIdAndDelete(req.params.id);
    req.app.get('io').emit('inquiry_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Inquiry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Get all inquiries
router.get('/', auth, async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Update inquiry status
router.patch('/:id', auth, async (req, res) => {
  try {
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    req.app.get('io').emit('inquiry_change', { action: 'update', data: inquiry });
    res.json(inquiry);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
