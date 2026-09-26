const test = require('node:test');
const assert = require('node:assert/strict');

const { hasServiceCommandPermission, normalizeServicePermissions } = require('../netlify/functions/utils/servicePermissions');

test('unscoped services fail closed', () => {
  assert.equal(hasServiceCommandPermission({}, 'restart'), false);
  assert.equal(hasServiceCommandPermission({ permissions: [] }, 'restart'), false);
});

test('configured service permissions restrict queued commands', () => {
  const bot = { permissions: ['enable', 'restart'] };
  assert.equal(hasServiceCommandPermission(bot, 'restart'), true);
  assert.equal(hasServiceCommandPermission(bot, 'shutdown'), false);
  assert.equal(hasServiceCommandPermission({ permissions: ['*'] }, 'shutdown'), true);
});

test('service permission updates accept only supported commands', () => {
  assert.deepEqual(normalizeServicePermissions(['restart', 'unknown', 'restart']), ['restart']);
  assert.deepEqual(normalizeServicePermissions(['*', 'shutdown']), ['*']);
});