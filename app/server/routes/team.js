const express = require('express');
const router = express.Router();
const TeamMember = require('../models/TeamMember');
const auth = require('../middleware/auth');
const {
  hydrateMediaFieldsForResponse,
  normalizeMediaFieldsForStorage
} = require('../utils/public-url');

// Public: Get all team members
router.get('/', async (req, res) => {
  try {
    const team = await TeamMember.find().sort({ order: 1 });
    res.json(team.map((member) => hydrateMediaFieldsForResponse(req, member.toObject())));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Add team member
router.post('/', auth, async (req, res) => {
  const member = new TeamMember(normalizeMediaFieldsForStorage(req.body));
  try {
    const newMember = await member.save();
    const payload = hydrateMediaFieldsForResponse(req, newMember.toObject());
    req.app.get('io').emit('team_change', { action: 'create', data: payload });
    res.status(201).json(payload);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Update team member
router.put('/:id', auth, async (req, res) => {
  try {
    const updatedMember = await TeamMember.findByIdAndUpdate(
      req.params.id,
      normalizeMediaFieldsForStorage(req.body),
      { new: true }
    );
    if (!updatedMember) {
      return res.status(404).json({ message: 'Team member not found' });
    }
    const payload = hydrateMediaFieldsForResponse(req, updatedMember.toObject());
    req.app.get('io').emit('team_change', { action: 'update', data: payload });
    res.json(payload);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Delete team member
router.delete('/:id', auth, async (req, res) => {
  try {
    const deletedMember = await TeamMember.findByIdAndDelete(req.params.id);
    if (!deletedMember) {
      return res.status(404).json({ message: 'Team member not found' });
    }
    req.app.get('io').emit('team_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Team member removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
