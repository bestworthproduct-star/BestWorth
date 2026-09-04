const test = require('node:test');
const assert = require('node:assert/strict');

const { appearsInCreatorChain, collectDescendants, isDescendantOf } = require('../utils/worker-lineage');

const owner = { _id: 'owner', role: 'admin' };
const userA = { _id: 'a', role: 'worker', createdBy: owner._id };
const userB = { _id: 'b', role: 'worker', createdBy: owner._id };
const userC = { _id: 'c', role: 'worker', createdBy: userA._id };
const userD = { _id: 'd', role: 'worker', createdBy: userB._id };
const userE = { _id: 'e', role: 'worker', createdBy: userC._id };
const records = new Map([owner, userA, userB, userC, userD, userE].map((user) => [user._id, user]));
const findUserById = async (id) => records.get(String(id)) || null;

test('workers can reach direct children and deeper descendants in their own branch', async () => {
  assert.equal(await isDescendantOf(userA, userC, findUserById), true);
  assert.equal(await isDescendantOf(userA, userE, findUserById), true);
  assert.equal(await isDescendantOf(userC, userE, findUserById), true);
});

test('siblings and workers from separate branches cannot reach one another', async () => {
  assert.equal(await isDescendantOf(userA, userB, findUserById), false);
  assert.equal(await isDescendantOf(userC, userD, findUserById), false);
  assert.equal(await isDescendantOf(userD, userC, findUserById), false);
});

test('workers cannot reach themselves, parents, grandparents or broken lineages', async () => {
  assert.equal(await isDescendantOf(userC, userC, findUserById), false);
  assert.equal(await isDescendantOf(userC, userA, findUserById), false);
  assert.equal(await isDescendantOf(userE, userA, findUserById), false);
  assert.equal(await isDescendantOf(userA, { _id: 'orphan', role: 'worker', createdBy: 'missing' }, findUserById), false);
});

test('corrupt circular lineages fail closed', async () => {
  const cycleX = { _id: 'x', role: 'worker', createdBy: 'y' };
  const cycleY = { _id: 'y', role: 'worker', createdBy: 'x' };
  const cyclicRecords = new Map([[cycleX._id, cycleX], [cycleY._id, cycleY]]);
  assert.equal(await isDescendantOf(userA, cycleX, async (id) => cyclicRecords.get(String(id)) || null), false);
  assert.equal(await isDescendantOf(cycleX, cycleY, async (id) => cyclicRecords.get(String(id)) || null), false);
});

test('ancestor detection still blocks exceptions when the wider lineage is broken', async () => {
  const brokenParent = { _id: 'broken-parent', role: 'worker', createdBy: 'missing-root' };
  const brokenChild = { _id: 'broken-child', role: 'worker', createdBy: brokenParent._id };
  const brokenRecords = new Map([[brokenParent._id, brokenParent], [brokenChild._id, brokenChild]]);
  const lookup = async (id) => brokenRecords.get(String(id)) || null;
  assert.equal(await isDescendantOf(brokenParent, brokenChild, lookup), false);
  assert.equal(await appearsInCreatorChain(brokenParent, brokenChild, lookup), true);
  assert.equal(await appearsInCreatorChain(brokenChild, brokenParent, lookup), false);
});

test('worker lists contain only descendants from the requested branch', async () => {
  const descendants = await collectDescendants(userA, async (parentIds) => (
    [...records.values()].filter((user) => user.role === 'worker' && parentIds.includes(String(user.createdBy)))
  ));
  assert.deepEqual(descendants.map((user) => user._id).sort(), ['c', 'e']);
});
