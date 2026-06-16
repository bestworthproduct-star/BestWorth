const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const TeamMember = require('../models/TeamMember');
const auth = require('../middleware/auth');
const {
  hydrateMediaFieldsForResponse,
  normalizeMediaFieldsForStorage,
  getRequestOrigin
} = require('../utils/public-url');

function serializeTeamMember(req, member) {
  if (!member) {
    return null;
  }

  const plainMember = typeof member.toObject === 'function' ? member.toObject() : member;
  return hydrateMediaFieldsForResponse(req, plainMember);
}

function normalizeTeamImage(req, image) {
  if (typeof image !== 'string') {
    return image;
  }

  const trimmedImage = image.trim();
  const requestOrigin = getRequestOrigin(req);

  if (trimmedImage.startsWith(`${requestOrigin}/`)) {
    return trimmedImage.slice(requestOrigin.length);
  }

  return normalizeMediaFieldsForStorage(trimmedImage);
}

function sanitizeTeamPayload(req) {
  const body = req.body || {};
  const orderValue = Number(body.order);

  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    role: typeof body.role === 'string' ? body.role.trim() : '',
    bio: typeof body.bio === 'string' ? body.bio.trim() : '',
    image: normalizeTeamImage(req, body.image),
    order: Number.isFinite(orderValue) ? orderValue : 0
  };
}

function validateTeamPayload(payload) {
  if (!payload.name) {
    return 'Name is required';
  }

  if (!payload.role) {
    return 'Role is required';
  }

  if (!payload.image || typeof payload.image !== 'string') {
    return 'Image is required';
  }

  return null;
}

// Public: Get all team members
router.get('/', async (req, res) => {
  try {
    const team = await TeamMember.find()
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.json(team.map((member) => serializeTeamMember(req, member)));
  } catch (err) {
    console.error('Failed to fetch team members:', err.message);
    res.status(500).json({ message: 'Failed to fetch team members' });
  }
});

// Admin: Add team member
router.post('/', auth, async (req, res) => {
  try {
    const payload = sanitizeTeamPayload(req);
    const validationError = validateTeamPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const member = await TeamMember.create(payload);
    const serializedMember = serializeTeamMember(req, member);

    const io = req.app.get('io');
    if (io) {
      io.emit('team_change', { action: 'create', data: serializedMember });
    }

    return res.status(201).json(serializedMember);
  } catch (err) {
    console.error('Failed to create team member:', err.message);
    return res.status(400).json({ message: err.message || 'Failed to create team member' });
  }
});

// Admin: Update team member
router.put('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid team member ID' });
    }

    const payload = sanitizeTeamPayload(req);
    const validationError = validateTeamPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updatedMember = await TeamMember.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    if (!updatedMember) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    const serializedMember = serializeTeamMember(req, updatedMember);
    const io = req.app.get('io');
    if (io) {
      io.emit('team_change', { action: 'update', data: serializedMember });
    }

    return res.json(serializedMember);
  } catch (err) {
    console.error('Failed to update team member:', err.message);
    return res.status(400).json({ message: err.message || 'Failed to update team member' });
  }
});

// Admin: Delete team member
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid team member ID' });
    }

    const deletedMember = await TeamMember.findByIdAndDelete(req.params.id);

    if (!deletedMember) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('team_change', { action: 'delete', id: req.params.id });
    }

    return res.json({ message: 'Team member removed', id: req.params.id });
  } catch (err) {
    console.error('Failed to delete team member:', err.message);
    return res.status(500).json({ message: 'Failed to delete team member' });
  }
});

module.exports = router;
