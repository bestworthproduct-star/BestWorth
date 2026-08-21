const crypto = require('crypto');
const mongoose = require('mongoose');
const { getSecret } = require('./auth-token');

function signature(id, email) {
  return crypto.createHmac('sha256', process.env.NEWSLETTER_TOKEN_SECRET || getSecret())
    .update(`${id}:${String(email).trim().toLowerCase()}`)
    .digest('base64url');
}

function createUnsubscribeToken(subscriber) {
  const id = String(subscriber._id);
  return `${id}.${signature(id, subscriber.email)}`;
}

function hashUnsubscribeToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyUnsubscribeToken(token, subscriber) {
  const [id, supplied] = String(token || '').split('.');
  if (!mongoose.isValidObjectId(id) || !supplied || id !== String(subscriber?._id)) return false;
  const expected = signature(id, subscriber.email);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createUnsubscribeToken, hashUnsubscribeToken, verifyUnsubscribeToken };
