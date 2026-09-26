const test = require('node:test');
const assert = require('node:assert/strict');

const { getBotHealth } = require('../netlify/functions/utils/serviceLifecycle');

test('administrative service states remain visible in health summaries', () => {
  assert.equal(getBotHealth({ status: 'pending' }), 'pending');
  assert.equal(getBotHealth({ status: 'suspended' }), 'suspended');
  assert.equal(getBotHealth({ status: 'revoked' }), 'revoked');
});

test('active services report offline when they have no heartbeat', () => {
  assert.equal(getBotHealth({ status: 'active' }), 'offline');
});