const AccessAudit = require('../models/AccessAudit');

async function recordAccessAudit(req, action, options = {}) {
  try {
    await AccessAudit.create({
      actor: options.actor || req?.user?.id,
      targetUser: options.targetUser,
      action,
      ipAddress: req?.ip,
      metadata: options.metadata || {}
    });
  } catch (error) {
    console.error('Access audit write failed:', error.message);
  }
}

module.exports = { recordAccessAudit };
