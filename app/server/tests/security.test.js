const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-only-secret-that-is-longer-than-thirty-two-characters';
process.env.NODE_ENV = 'test';

const { stringField, emailField, safeHttpUrl, objectId } = require('../utils/validation');
const { signAuthToken, verifyAuthToken, getRequestToken } = require('../utils/auth-token');
const { rejectOperatorInjection } = require('../middleware/security');
const { createUnsubscribeToken, hashUnsubscribeToken, verifyUnsubscribeToken } = require('../utils/newsletter-token');

test('strict text and email validation rejects objects and malformed values', () => {
  assert.throws(() => stringField({ $ne: '' }, { name: 'Name' }), /must be text/);
  assert.throws(() => emailField('not-an-email'), /invalid/);
  assert.equal(emailField(' Test@Example.com '), 'test@example.com');
});

test('safe URL validation only accepts secure or local application URLs', () => {
  assert.equal(safeHttpUrl('/api/media/123', { name: 'Media' }), '/api/media/123');
  assert.match(safeHttpUrl('https://example.com/image.jpg'), /^https:/);
  assert.throws(() => safeHttpUrl('javascript:alert(1)'), /HTTPS/);
});

test('operator-injection middleware rejects nested Mongo operators and dotted keys', () => {
  for (const body of [{ username: { $ne: null } }, { profile: { 'name.first': 'x' } }, { constructor: { prototype: {} } }]) {
    let status;
    const req = { body, query: {}, params: {} };
    const res = { status(code) { status = code; return this; }, json() { return this; } };
    rejectOperatorInjection(req, res, () => { status = 200; });
    assert.equal(status, 400);
  }
});

test('auth tokens pin algorithm, issuer, audience, and session version', () => {
  const token = signAuthToken({ _id: '507f1f77bcf86cd799439011', sessionVersion: 4 });
  const decoded = verifyAuthToken(token);
  assert.equal(decoded.sv, 4);
  assert.equal(decoded.iss, 'bestworth-api');
  assert.equal(decoded.aud, 'bestworth-admin');
});

test('request tokens prefer real bearer tokens and otherwise use HttpOnly cookie', () => {
  assert.equal(getRequestToken({ headers: { authorization: 'Bearer abc' } }), 'abc');
  assert.equal(getRequestToken({ headers: { authorization: 'Bearer cookie-session', cookie: 'bw_session=secure-token' } }), 'secure-token');
});

test('newsletter unsubscribe tokens are signed and only a hash needs to be stored', () => {
  const subscriber = { _id: '507f1f77bcf86cd799439011', email: 'reader@example.com' };
  const token = createUnsubscribeToken(subscriber);
  assert.equal(verifyUnsubscribeToken(token, subscriber), true);
  assert.equal(verifyUnsubscribeToken(`${token}x`, subscriber), false);
  assert.notEqual(hashUnsubscribeToken(token), token);
});
