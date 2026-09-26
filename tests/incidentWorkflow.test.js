const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INCIDENT_STATES,
  normalizeIncidentState,
  isValidTransition,
  getIncidentUpdateStatus,
  hasResolutionNotes,
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

test('owner assignment advances an open incident to assigned', () => {
  assert.equal(getIncidentUpdateStatus('open', { owner: 'ops-team' }), 'assigned');
  assert.equal(getIncidentUpdateStatus('investigating', { owner: 'ops-team' }), 'investigating');
  assert.equal(getIncidentUpdateStatus('open', { status: 'monitoring', owner: 'ops-team' }), 'monitoring');
});

test('resolving requires a non-empty resolution note', () => {
  assert.equal(hasResolutionNotes(null, ''), false);
  assert.equal(hasResolutionNotes('Existing resolution', ''), true);
  assert.equal(hasResolutionNotes(null, '  Credential rotation completed  '), true);
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
    resolution: 'Credential rotation completed',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:05:00.000Z',
    timeline: [{ actor: 'ops-team', action: 'created', note: 'Repeated failed sign-ins' }],
  });

  assert.deepEqual(summary, {
    id: 'INC-1001',
    title: 'Webhook spike',
    severity: 'high',
    status: 'assigned',
    owner: 'ops-team',
    guildId: 'guild-42',
    reason: 'Repeated failed sign-ins',
    resolution: 'Credential rotation completed',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:05:00.000Z',
    timeline: [{ actor: 'ops-team', action: 'created', note: 'Repeated failed sign-ins' }],
  });
});
