const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { allowRateLimit, getClientKey, writeAudit } = require('./utils/security');
const { buildIncidentSummary, isValidTransition, normalizeIncidentState } = require('./utils/incidentWorkflow');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function isOwner(session) {
  return session?.role === 'owner' || session?.permissions?.includes('*');
}

exports.handler = async (event) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(event.httpMethod)) {
    return json(405, { error: 'Method Not Allowed' });
  }

  const session = getSession(event);
  if (!hasPermission(session, 'bot.read') && !isOwner(session)) {
    return json(403, { error: 'bot.read permission required' });
  }

  try {
    const db = await getDb();
    const incidents = db.collection('incidents');
    if (!await allowRateLimit(db, `incident:${getClientKey(event, session?.userId || 'anon')}`, 30, 60 * 1000)) {
      return json(429, { error: 'Too many incident requests' });
    }

    if (event.httpMethod === 'GET') {
      const query = event.queryStringParameters || {};
      const filter = {};
      if (query.status) filter.status = normalizeIncidentState(query.status);
      if (query.guildId) filter.guildId = query.guildId;
      const records = await incidents.find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
      return json(200, { incidents: records.map((incident) => buildIncidentSummary(incident)) });
    }

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    if (event.httpMethod === 'POST') {
      if (!hasPermission(session, 'bot.approve') && !isOwner(session)) {
        return json(403, { error: 'bot.approve permission required to open incidents' });
      }
      if (!payload.title || !payload.reason) {
        return json(400, { error: 'title and reason are required' });
      }

      const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;
      const record = {
        incidentId,
        title: payload.title,
        severity: payload.severity || 'medium',
        status: 'open',
        owner: payload.owner || session.userId || 'unassigned',
        guildId: payload.guildId || null,
        reason: payload.reason,
        resolution: null,
        createdBy: session.userId || 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        timeline: [{ actor: session.userId || 'system', action: 'created', note: payload.reason, createdAt: new Date() }],
      };

      await incidents.insertOne(record);
      await writeAudit(db, {
        actorId: session.userId || 'system',
        action: 'incident.created',
        targetType: 'incident',
        targetId: incidentId,
        details: { title: record.title, guildId: record.guildId, severity: record.severity },
      });

      return json(201, { incident: buildIncidentSummary(record) });
    }

    if (event.httpMethod === 'PATCH') {
      if (!payload.incidentId) {
        return json(400, { error: 'incidentId is required' });
      }

      const existing = await incidents.findOne({ incidentId: payload.incidentId });
      if (!existing) return json(404, { error: 'Incident not found' });

      const nextStatus = payload.status ? normalizeIncidentState(payload.status) : existing.status;
      if (payload.status && !isValidTransition(existing.status, nextStatus)) {
        return json(400, { error: `Invalid state transition from ${existing.status} to ${nextStatus}` });
      }

      const update = { updatedAt: new Date() };
      if (payload.status) update.status = nextStatus;
      if (payload.owner) update.owner = payload.owner;
      if (payload.severity) update.severity = payload.severity;
      if (payload.reason) update.reason = payload.reason;
      if (payload.resolution) update.resolution = payload.resolution;
      if (payload.note) {
        update.$push = { timeline: { actor: session.userId || 'system', action: payload.status || 'updated', note: payload.note, createdAt: new Date() } };
      }

      await incidents.updateOne({ incidentId: payload.incidentId }, { $set: update, ...(payload.note ? { $push: { timeline: { actor: session.userId || 'system', action: payload.status || 'updated', note: payload.note, createdAt: new Date() } } } : {}) });
      await writeAudit(db, {
        actorId: session.userId || 'system',
        action: payload.status ? `incident.${payload.status}` : 'incident.updated',
        targetType: 'incident',
        targetId: payload.incidentId,
        details: { status: nextStatus, owner: payload.owner || existing.owner, note: payload.note || null },
      });

      const updated = await incidents.findOne({ incidentId: payload.incidentId });
      return json(200, { incident: buildIncidentSummary(updated) });
    }

    if (event.httpMethod === 'DELETE') {
      if (!payload.incidentId) return json(400, { error: 'incidentId is required' });
      if (!hasPermission(session, 'bot.delete') && !isOwner(session)) {
        return json(403, { error: 'bot.delete permission required' });
      }
      const result = await incidents.deleteOne({ incidentId: payload.incidentId });
      if (!result.deletedCount) return json(404, { error: 'Incident not found' });
      await writeAudit(db, { actorId: session.userId || 'system', action: 'incident.deleted', targetType: 'incident', targetId: payload.incidentId });
      return json(200, { ok: true, incidentId: payload.incidentId });
    }
  } catch (error) {
    console.error('incident-api error:', error);
    return json(500, { error: 'Failed to process incident request' });
  }
};
