const ACCESS_LEVEL_RANK = { view: 1, manage: 2 };

function entityId(entity) {
  const value = entity?._id || entity?.id || entity;
  return value ? String(value) : '';
}

function grantAllowsLevel(grant, actor, target, requiredLevel = 'view') {
  if (!grant || grant.revokedAt) return false;
  const grantedLevel = ACCESS_LEVEL_RANK[grant.level] || 0;
  const requiredRank = ACCESS_LEVEL_RANK[requiredLevel] || Number.POSITIVE_INFINITY;
  return entityId(grant.actor) === entityId(actor)
    && entityId(grant.target) === entityId(target)
    && grantedLevel >= requiredRank;
}

module.exports = { ACCESS_LEVEL_RANK, entityId, grantAllowsLevel };
