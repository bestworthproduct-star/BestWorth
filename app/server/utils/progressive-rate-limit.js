const crypto = require('crypto');
const ProgressiveRateLimitEntry = require('../models/ProgressiveRateLimitEntry');

const DEFAULT_LOCK_DURATIONS_MS = Object.freeze([
  15 * 1000,
  15 * 60 * 1000,
  2 * 60 * 60 * 1000
]);
const DEFAULT_RESET_AFTER_MS = 24 * 60 * 60 * 1000;

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

function entryId(scope, keyHash) {
  return hashKey(`${scope}:${keyHash}`);
}

function normalizeClientIp(value) {
  const ip = String(value || 'unknown').trim().toLowerCase();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function retryAfterSeconds(blockedUntil, now = Date.now()) {
  return Math.max(Math.ceil((new Date(blockedUntil).getTime() - now) / 1000), 1);
}

function nextLockStage(currentStage, lockDurationsMs = DEFAULT_LOCK_DURATIONS_MS) {
  const stage = Math.min(Math.max(Number(currentStage || 0) + 1, 1), lockDurationsMs.length);
  return { stage, durationMs: lockDurationsMs[stage - 1] };
}

function blockedResult(entry, now = Date.now()) {
  if (!entry?.blockedUntil || new Date(entry.blockedUntil).getTime() <= now) {
    return { blocked: false, retryAfterSeconds: 0, strikeLevel: Number(entry?.strikeLevel || 0) };
  }

  return {
    blocked: true,
    retryAfterSeconds: retryAfterSeconds(entry.blockedUntil, now),
    strikeLevel: Number(entry.strikeLevel || 0)
  };
}

async function getProgressiveBlock(scope, rawKey, now = new Date()) {
  const keyHash = hashKey(rawKey);
  const entry = await ProgressiveRateLimitEntry.findById(entryId(scope, keyHash)).lean();
  return blockedResult(entry, now.getTime());
}

async function incrementFailure(scope, keyHash, resetBoundary, expiresAt, now) {
  const _id = entryId(scope, keyHash);
  const update = [
    {
      $set: {
        scope,
        keyHash,
        failureCount: {
          $cond: [
            { $lt: [{ $ifNull: ['$lastFailureAt', new Date(0)] }, resetBoundary] },
            1,
            { $add: [{ $ifNull: ['$failureCount', 0] }, 1] }
          ]
        },
        strikeLevel: {
          $cond: [
            { $lt: [{ $ifNull: ['$lastFailureAt', new Date(0)] }, resetBoundary] },
            0,
            { $ifNull: ['$strikeLevel', 0] }
          ]
        },
        blockedUntil: {
          $cond: [
            { $lt: [{ $ifNull: ['$lastFailureAt', new Date(0)] }, resetBoundary] },
            null,
            { $ifNull: ['$blockedUntil', null] }
          ]
        },
        lastFailureAt: now,
        expiresAt
      }
    }
  ];

  try {
    return await ProgressiveRateLimitEntry.findOneAndUpdate(
      { _id, scope, keyHash },
      update,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false, updatePipeline: true }
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return ProgressiveRateLimitEntry.findOneAndUpdate(
      { _id, scope, keyHash },
      update,
      { returnDocument: 'after', updatePipeline: true }
    ).lean();
  }
}

async function recordProgressiveFailure({
  scope,
  key,
  threshold,
  lockDurationsMs = DEFAULT_LOCK_DURATIONS_MS,
  resetAfterMs = DEFAULT_RESET_AFTER_MS,
  now = new Date()
}) {
  const keyHash = hashKey(key);
  const resetBoundary = new Date(now.getTime() - resetAfterMs);
  const maxLockMs = Math.max(...lockDurationsMs);
  const expiresAt = new Date(now.getTime() + resetAfterMs + maxLockMs + 60_000);
  const entry = await incrementFailure(scope, keyHash, resetBoundary, expiresAt, now);
  const existingBlock = blockedResult(entry, now.getTime());

  if (existingBlock.blocked || Number(entry.failureCount || 0) < threshold) {
    return { ...existingBlock, failureCount: Number(entry.failureCount || 0) };
  }

  const { stage, durationMs } = nextLockStage(entry.strikeLevel, lockDurationsMs);
  const blockedUntil = new Date(now.getTime() + durationMs);
  const activated = await ProgressiveRateLimitEntry.findOneAndUpdate(
    {
      _id: entry._id,
      strikeLevel: Number(entry.strikeLevel || 0),
      failureCount: { $gte: threshold },
      $or: [
        { blockedUntil: null },
        { blockedUntil: { $exists: false } },
        { blockedUntil: { $lte: now } }
      ]
    },
    { $set: { strikeLevel: stage, failureCount: 0, blockedUntil, expiresAt } },
    { returnDocument: 'after' }
  ).lean();

  const finalEntry = activated || await ProgressiveRateLimitEntry.findById(entry._id).lean();
  const result = blockedResult(finalEntry, now.getTime());
  return { ...result, failureCount: Number(finalEntry?.failureCount || 0) };
}

async function clearProgressiveFailures(scope, rawKey) {
  const keyHash = hashKey(rawKey);
  await ProgressiveRateLimitEntry.deleteOne({ _id: entryId(scope, keyHash) });
}

function applyRetryAfter(res, result) {
  const seconds = Math.max(Number(result?.retryAfterSeconds || 1), 1);
  res.setHeader('Retry-After', seconds);
  res.setHeader('RateLimit-Remaining', 0);
  res.setHeader('RateLimit-Reset', seconds);
}

module.exports = {
  DEFAULT_LOCK_DURATIONS_MS,
  DEFAULT_RESET_AFTER_MS,
  normalizeClientIp,
  nextLockStage,
  getProgressiveBlock,
  recordProgressiveFailure,
  clearProgressiveFailures,
  applyRetryAfter
};
