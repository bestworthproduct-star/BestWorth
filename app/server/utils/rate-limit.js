const crypto = require('crypto');
const mongoose = require('mongoose');
const RateLimitEntry = require('../models/RateLimitEntry');

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function consume(scope, rawKey, limit, windowMs) {
  const now = Date.now();
  const startMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(startMs);
  const expiresAt = new Date(startMs + windowMs + 60_000);
  const keyHash = crypto.createHash('sha256').update(String(rawKey)).digest('hex');
  let entry;
  try {
    entry = await RateLimitEntry.findOneAndUpdate(
      { scope, keyHash, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false }
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    entry = await RateLimitEntry.findOneAndUpdate(
      { scope, keyHash, windowStart }, { $inc: { count: 1 } }, { returnDocument: 'after' }
    ).lean();
  }
  return { allowed: entry.count <= limit, count: entry.count, limit, retryAfterSeconds: Math.max(Math.ceil((startMs + windowMs - now) / 1000), 1) };
}

function rateLimit({ scope, limit, windowMs, key = (req) => clientIp(req) }) {
  return async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) return next();
      const result = await consume(scope, key(req), limit, windowMs);
      res.setHeader('RateLimit-Limit', limit);
      res.setHeader('RateLimit-Remaining', Math.max(limit - result.count, 0));
      res.setHeader('RateLimit-Reset', result.retryAfterSeconds);
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSeconds);
        return res.status(429).json({ message: 'Too many requests. Please wait and try again.', retryAfterSeconds: result.retryAfterSeconds });
      }
      next();
    } catch (error) {
      console.error(`[security] rate limiter ${scope} failed:`, error.message);
      res.status(503).json({ message: 'Service temporarily unavailable. Please try again shortly.' });
    }
  };
}

module.exports = { consume, rateLimit, clientIp };
