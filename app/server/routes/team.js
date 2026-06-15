const express = require('express');
const router = express.Router();
const TeamMember = require('../models/TeamMember');
const auth = require('../middleware/auth');

// Public: Get all team members
router.get('/', async (req, res) => {
  try {
    const team = await TeamMember.find().sort({ order: 1 });
    res.json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Add team member
router.post('/', auth, async (req, res) => {
  const member = new TeamMember(req.body);
  try {
    const newMember = await member.save();
    req.app.get('io').emit('team_change', { action: 'create', data: newMember });
    res.status(201).json(newMember);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Update team member
router.put('/:id', auth, async (req, res) => {
  try {
    const updatedMember = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.app.get('io').emit('team_change', { action: 'update', data: updatedMember });
    res.json(updatedMember);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: Delete team member
router.delete('/:id', auth, async (req, res) => {
  try {
    await TeamMember.findByIdAndDelete(req.params.id);
    req.app.get('io').emit('team_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Team member removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
