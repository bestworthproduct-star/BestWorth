const { hasPermission, getRole } = require('../utils/permissions');

function requireSessionReady(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      message: 'Change your temporary password before continuing.',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.mustChangePassword) return requireSessionReady(req, res, next);
  if (getRole(req.user) !== 'admin') {
    return res.status(403).json({ message: 'Owner access is required.', code: 'ACCESS_DENIED' });
  }
  next();
}

function requirePermission(moduleName, requiredLevel = 'view') {
  return (req, res, next) => {
    if (req.user?.mustChangePassword) return requireSessionReady(req, res, next);
    if (!hasPermission(req.user, moduleName, requiredLevel)) {
      return res.status(403).json({ message: 'You do not have access to this area.', code: 'ACCESS_DENIED' });
    }
    next();
  };
}

module.exports = { requireSessionReady, requireAdmin, requirePermission };
