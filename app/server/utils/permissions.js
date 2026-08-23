const MODULES = ['overview', 'catalog', 'leadership', 'inquiries', 'media', 'cms', 'workers'];
const LEVELS = ['none', 'view', 'manage'];
const LEVEL_RANK = { none: 0, view: 1, manage: 2 };

function getRole(user) {
  return user?.role === 'worker' ? 'worker' : 'admin';
}

function normalizePermissions(role, permissions = {}) {
  return MODULES.reduce((result, moduleName) => {
    if (role === 'admin') {
      result[moduleName] = 'manage';
      return result;
    }

    const requested = permissions?.[moduleName];
    result[moduleName] = LEVELS.includes(requested)
      ? requested
      : (moduleName === 'overview' ? 'view' : 'none');
    return result;
  }, {});
}

function hasPermission(user, moduleName, requiredLevel = 'view') {
  const role = getRole(user);
  if (role === 'admin') return true;
  if (!MODULES.includes(moduleName)) return false;

  const permissions = normalizePermissions(role, user?.permissions);
  return LEVEL_RANK[permissions[moduleName]] >= LEVEL_RANK[requiredLevel];
}

function canDelegatePermissions(actor, requestedPermissions = {}, existingPermissions = null) {
  if (getRole(actor) === 'admin') return true;

  const actorPermissions = normalizePermissions('worker', actor?.permissions);
  const requested = normalizePermissions('worker', requestedPermissions);
  const existing = existingPermissions == null
    ? null
    : normalizePermissions('worker', existingPermissions);

  return MODULES.every((moduleName) => {
    // Delegated managers cannot create or appoint other account managers.
    if (moduleName === 'workers') {
      return requested.workers === (existing?.workers || 'none');
    }
    return LEVEL_RANK[requested[moduleName]] <= LEVEL_RANK[actorPermissions[moduleName]];
  });
}

function isCreatorProtectedTarget(actor, target) {
  if (getRole(actor) === 'admin' || !actor?.createdBy || !target) return false;
  const creatorId = actor.createdBy?._id || actor.createdBy;
  const targetId = target._id || target.id;
  return Boolean(targetId) && String(creatorId) === String(targetId);
}

function serializeUser(user) {
  const role = getRole(user);
  return {
    id: String(user._id || user.id),
    username: user.username,
    fullName: user.fullName || '',
    jobTitle: user.jobTitle || '',
    createdBy: user.createdBy ? String(user.createdBy?._id || user.createdBy) : null,
    email: user.email || '',
    role,
    permissions: normalizePermissions(role, user.permissions),
    active: user.active !== false,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
}

module.exports = {
  MODULES,
  LEVELS,
  getRole,
  normalizePermissions,
  hasPermission,
  canDelegatePermissions,
  isCreatorProtectedTarget,
  serializeUser
};
