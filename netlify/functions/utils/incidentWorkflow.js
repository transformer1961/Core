const INCIDENT_STATES = ['open', 'assigned', 'investigating', 'monitoring', 'resolved', 'closed'];

function normalizeIncidentState(value) {
  const state = String(value ?? '').trim().toLowerCase();
  if (INCIDENT_STATES.includes(state)) return state;
  if (state === 'acknowledged') return 'assigned';
  if (state === 'active') return 'open';
  if (state === 'done') return 'resolved';
  return 'open';
}

function isValidTransition(from, to) {
  const current = normalizeIncidentState(from);
  const next = normalizeIncidentState(to);

  const allowed = {
    open: ['assigned', 'investigating', 'monitoring'],
    assigned: ['investigating', 'monitoring', 'resolved'],
    investigating: ['monitoring', 'resolved'],
    monitoring: ['resolved'],
    resolved: ['closed'],
    closed: [],
  };

  return allowed[current]?.includes(next) === true;
}

function getIncidentUpdateStatus(existingStatus, payload = {}) {
  if (payload.status) return normalizeIncidentState(payload.status);
  return payload.owner && normalizeIncidentState(existingStatus) === 'open'
    ? 'assigned'
    : normalizeIncidentState(existingStatus);
}

function hasResolutionNotes(existingResolution, nextResolution) {
  return Boolean(String(nextResolution || existingResolution || '').trim());
}

function buildIncidentSummary(incident = {}) {
  return {
    id: incident.incidentId || incident.id,
    title: incident.title,
    severity: incident.severity,
    status: normalizeIncidentState(incident.status),
    owner: incident.owner,
    guildId: incident.guildId,
    reason: incident.reason,
    resolution: incident.resolution || null,
    createdAt: incident.createdAt || null,
    updatedAt: incident.updatedAt || null,
    timeline: Array.isArray(incident.timeline) ? incident.timeline : [],
  };
}

module.exports = {
  INCIDENT_STATES,
  normalizeIncidentState,
  isValidTransition,
  getIncidentUpdateStatus,
  hasResolutionNotes,
  buildIncidentSummary,
};
