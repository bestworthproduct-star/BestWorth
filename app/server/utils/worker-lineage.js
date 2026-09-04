const MAX_LINEAGE_DEPTH = 50;
const MAX_LINEAGE_USERS = 5000;

function entityId(entity) {
  const value = entity?._id || entity?.id || entity;
  return value ? String(value) : '';
}

async function isDescendantOf(actor, target, findUserById, maxDepth = MAX_LINEAGE_DEPTH) {
  const actorId = entityId(actor);
  const targetId = entityId(target);
  if (!actorId || !targetId || actorId === targetId || typeof findUserById !== 'function') return false;

  const visited = new Set([targetId]);
  let creatorId = entityId(target?.createdBy);
  let actorFound = false;

  for (let depth = 0; depth < maxDepth && creatorId; depth += 1) {
    if (visited.has(creatorId)) return false;
    if (creatorId === actorId) actorFound = true;
    visited.add(creatorId);

    const creator = await findUserById(creatorId);
    if (!creator) return false;
    // A valid chain must terminate at the owner. Legacy owner accounts may have no explicit role.
    if (creator.role !== 'worker') return actorFound;
    creatorId = entityId(creator.createdBy);
  }

  return false;
}

async function appearsInCreatorChain(possibleAncestor, target, findUserById, maxDepth = MAX_LINEAGE_DEPTH) {
  const ancestorId = entityId(possibleAncestor);
  const targetId = entityId(target);
  if (!ancestorId || !targetId || ancestorId === targetId || typeof findUserById !== 'function') return false;

  const visited = new Set([targetId]);
  let creatorId = entityId(target?.createdBy);

  for (let depth = 0; depth < maxDepth && creatorId; depth += 1) {
    if (visited.has(creatorId)) return false;
    if (creatorId === ancestorId) return true;
    visited.add(creatorId);
    const creator = await findUserById(creatorId);
    if (!creator) return false;
    creatorId = entityId(creator.createdBy);
  }

  return false;
}

async function collectDescendants(root, findChildren, options = {}) {
  const rootId = entityId(root);
  const maxDepth = options.maxDepth || MAX_LINEAGE_DEPTH;
  const maxUsers = options.maxUsers || MAX_LINEAGE_USERS;
  if (!rootId || typeof findChildren !== 'function') return [];

  const descendants = [];
  const visited = new Set([rootId]);
  let parentIds = [rootId];

  for (let depth = 0; depth < maxDepth && parentIds.length > 0; depth += 1) {
    const children = await findChildren(parentIds);
    const nextParentIds = [];

    for (const child of children || []) {
      const childId = entityId(child);
      if (!childId || visited.has(childId)) continue;
      visited.add(childId);
      descendants.push(child);
      nextParentIds.push(childId);

      if (descendants.length >= maxUsers) return descendants;
    }

    parentIds = nextParentIds;
  }

  return descendants;
}

module.exports = {
  MAX_LINEAGE_DEPTH,
  MAX_LINEAGE_USERS,
  appearsInCreatorChain,
  collectDescendants,
  entityId,
  isDescendantOf
};
