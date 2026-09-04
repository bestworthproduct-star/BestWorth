const test = require('node:test');
const assert = require('node:assert/strict');

const { requireAdmin } = require('../middleware/authorize');
const { grantAllowsLevel } = require('../utils/worker-access-grants');

const actor = '507f1f77bcf86cd799439011';
const target = '507f1f77bcf86cd799439012';

test('view exceptions allow reading but never management', () => {
  const grant = { actor, target, level: 'view', revokedAt: null };
  assert.equal(grantAllowsLevel(grant, actor, target, 'view'), true);
  assert.equal(grantAllowsLevel(grant, actor, target, 'manage'), false);
});

test('manage exceptions allow both reading and management for the exact target', () => {
  const grant = { actor, target, level: 'manage', revokedAt: null };
  assert.equal(grantAllowsLevel(grant, actor, target, 'view'), true);
  assert.equal(grantAllowsLevel(grant, actor, target, 'manage'), true);
  assert.equal(grantAllowsLevel(grant, actor, '507f1f77bcf86cd799439013', 'view'), false);
  assert.equal(grantAllowsLevel(grant, '507f1f77bcf86cd799439014', target, 'view'), false);
});

test('revoked exceptions fail closed', () => {
  const grant = { actor, target, level: 'manage', revokedAt: new Date() };
  assert.equal(grantAllowsLevel(grant, actor, target, 'view'), false);
  assert.equal(grantAllowsLevel(null, actor, target, 'view'), false);
});

test('owner middleware blocks workers even if the frontend route is manually opened', () => {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  requireAdmin({ user: { role: 'worker', mustChangePassword: false } }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.code, 'ACCESS_DENIED');
});

test('owner middleware permits the owner', () => {
  let nextCalled = false;
  requireAdmin({ user: { role: 'admin', mustChangePassword: false } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
