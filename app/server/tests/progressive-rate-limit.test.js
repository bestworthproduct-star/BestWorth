const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressiveRateLimitEntry = require('../models/ProgressiveRateLimitEntry');
const {
  DEFAULT_LOCK_DURATIONS_MS,
  normalizeClientIp,
  nextLockStage,
  applyRetryAfter,
  recordProgressiveFailure
} = require('../utils/progressive-rate-limit');

test('progressive lock stages rise from 15 seconds to 15 minutes and cap at 2 hours', () => {
  assert.deepEqual(nextLockStage(0), { stage: 1, durationMs: 15_000 });
  assert.deepEqual(nextLockStage(1), { stage: 2, durationMs: 15 * 60_000 });
  assert.deepEqual(nextLockStage(2), { stage: 3, durationMs: 2 * 60 * 60_000 });
  assert.deepEqual(nextLockStage(3), { stage: 3, durationMs: 2 * 60 * 60_000 });
  assert.equal(DEFAULT_LOCK_DURATIONS_MS.length, 3);
});

test('IPv4-mapped addresses use the same rate-limit identity as IPv4 addresses', () => {
  assert.equal(normalizeClientIp('::ffff:192.0.2.10'), '192.0.2.10');
  assert.equal(normalizeClientIp('192.0.2.10'), '192.0.2.10');
});

test('blocked responses expose a real Retry-After header', () => {
  const headers = new Map();
  const response = { setHeader: (name, value) => headers.set(name, value) };

  applyRetryAfter(response, { retryAfterSeconds: 900 });

  assert.equal(headers.get('Retry-After'), 900);
  assert.equal(headers.get('RateLimit-Remaining'), 0);
  assert.equal(headers.get('RateLimit-Reset'), 900);
});

test('Mongo aggregation updates explicitly enable Mongoose update pipelines', async () => {
  const originalFindOneAndUpdate = ProgressiveRateLimitEntry.findOneAndUpdate;
  let receivedOptions;

  ProgressiveRateLimitEntry.findOneAndUpdate = (_filter, _update, options) => {
    receivedOptions = options;
    return {
      lean: async () => ({ _id: 'test-entry', failureCount: 1, strikeLevel: 0, blockedUntil: null })
    };
  };

  try {
    const result = await recordProgressiveFailure({
      scope: 'test-progressive',
      key: '192.0.2.20:test-user',
      threshold: 8
    });

    assert.equal(result.blocked, false);
    assert.equal(receivedOptions.updatePipeline, true);
  } finally {
    ProgressiveRateLimitEntry.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
