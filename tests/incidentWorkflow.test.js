const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INCIDENT_STATES,
  normalizeIncidentState,
  isValidTransition,
  buildIncidentSummary,
} = require('../netlify/functions/utils/incidentWorkflow');

test('incident states are normalized to the canonical SNS lifecycle', () => {
  assert.equal(normalizeIncidentState('OPEN'), 'open');
  assert.equal(normalizeIncidentState('assigned'), 'assigned');
  assert.equal(normalizeIncidentState('unknown-state'), 'open');
  assert.ok(INCIDENT_STATES.includes('open'));
});

test('transitions reject invalid or reversed progress', () => {
  assert.equal(isValidTransition('open', 'assigned'), true);
  assert.equal(isValidTransition('assigned', 'resolved'), true);
  assert.equal(isValidTransition('resolved', 'open'), false);
  assert.equal(isValidTransition('open', 'closed'), false);
});

test('incident summaries expose the fields used by the owner panel and audit trail', () => {
  const summary = buildIncidentSummary({
    incidentId: 'INC-1001',
    title: 'Webhook spike',
    severity: 'high',
    status: 'assigned',
    owner: 'ops-team',
    guildId: 'guild-42',
    reason: 'Repeated failed sign-ins',
  });

  assert.deepEqual(summary, {
    id: 'INC-1001',
    title: 'Webhook spike',
    severity: 'high',
    status: 'assigned',
    owner: 'ops-team',
    guildId: 'guild-42',
    reason: 'Repeated failed sign-ins',
  });
});
