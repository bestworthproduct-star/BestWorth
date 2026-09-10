const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canDelegatePermissions,
  hasPermission,
  normalizePermissions,
  serializeUser
} = require('../utils/permissions');

const delegatedManager = {
  _id: '507f1f77bcf86cd799439011',
  role: 'worker',
  permissions: {
    overview: 'view',
    catalog: 'manage',
    leadership: 'none',
    inquiries: 'view',
    media: 'none',
    cms: 'none',
    workers: 'manage'
  }
};

test('owner automatically has manage access to the worker module', () => {
  assert.equal(hasPermission({ role: 'admin' }, 'workers', 'manage'), true);
  assert.equal(normalizePermissions('admin').workers, 'manage');
});

test('worker module follows none, view and manage permission levels', () => {
  assert.equal(hasPermission({ role: 'worker', permissions: { workers: 'none' } }, 'workers'), false);
  assert.equal(hasPermission({ role: 'worker', permissions: { workers: 'view' } }, 'workers'), true);
  assert.equal(hasPermission({ role: 'worker', permissions: { workers: 'view' } }, 'workers', 'manage'), false);
  assert.equal(hasPermission(delegatedManager, 'workers', 'manage'), true);
});

test('delegated managers cannot grant access above their own authority', () => {
  assert.equal(canDelegatePermissions(delegatedManager, {
    overview: 'view', catalog: 'manage', leadership: 'none', inquiries: 'view',
    media: 'none', cms: 'none', workers: 'none'
  }), true);

  assert.equal(canDelegatePermissions(delegatedManager, {
    overview: 'view', catalog: 'manage', leadership: 'view', inquiries: 'view',
    media: 'none', cms: 'none', workers: 'none'
  }), false);
});

test('only the owner can appoint or change delegated worker managers', () => {
  assert.equal(canDelegatePermissions(delegatedManager, {
    overview: 'view', catalog: 'none', leadership: 'none', inquiries: 'none',
    media: 'none', cms: 'none', workers: 'view'
  }), false);

  const existing = { overview: 'view', catalog: 'none', leadership: 'none', inquiries: 'none', media: 'none', cms: 'none', workers: 'view' };
  assert.equal(canDelegatePermissions(delegatedManager, existing, existing), true);
  assert.equal(canDelegatePermissions({ role: 'admin' }, { ...existing, workers: 'manage' }, existing), true);
});

test('serialized accounts include the display-only company job title', () => {
  const result = serializeUser({ ...delegatedManager, username: 'manager', jobTitle: 'Operations Manager', createdBy: '507f1f77bcf86cd799439012' });
  assert.equal(result.jobTitle, 'Operations Manager');
  assert.equal(result.createdBy, '507f1f77bcf86cd799439012');
  assert.equal(result.role, 'worker');
});

test('serialized accounts expose only the authenticated user guide progress', () => {
  const completedAt = new Date('2026-09-10T09:00:00.000Z');
  const result = serializeUser({
    ...delegatedManager,
    username: 'manager',
    adminGuideVersionSeen: 1,
    adminGuideCompletedAt: completedAt
  });

  assert.equal(result.adminGuideVersionSeen, 1);
  assert.equal(result.adminGuideCompletedAt, completedAt);

  const newAccount = serializeUser({ ...delegatedManager, username: 'new-worker' });
  assert.equal(newAccount.adminGuideVersionSeen, 0);
  assert.equal(newAccount.adminGuideCompletedAt, null);
});
