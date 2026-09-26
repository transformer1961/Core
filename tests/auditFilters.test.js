const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAuditFilter } = require('../netlify/functions/utils/auditFilters');

test('audit filters support actor, target, result, and time bounds', () => {
  const filter = buildAuditFilter({ actorId: 'owner-1', targetType: 'command', targetId: 'cmd-1', action: 'command.failed', result: 'timeout', from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T23:59:59.000Z' });
  assert.equal(filter.actorId, 'owner-1');
  assert.equal(filter.targetType, 'command');
  assert.equal(filter.targetId, 'cmd-1');
  assert.equal(filter.action, 'command.failed');
  assert.equal(filter['details.result'], 'timeout');
  assert.ok(filter.createdAt.$gte instanceof Date);
  assert.ok(filter.createdAt.$lte instanceof Date);
});