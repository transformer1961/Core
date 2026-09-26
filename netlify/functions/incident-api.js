const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { authenticateBot, getHeader, isFreshRequestTimestamp } = require('./utils/bot-auth');
const { allowRateLimit, getClientKey, writeAudit } = require('./utils/security');
const { buildIncidentSummary, isValidTransition, normalizeIncidentState, getIncidentUpdateStatus, hasResolutionNotes } = require('./utils/incidentWorkflow');

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

  try {
    const db = await getDb();
    const incidents = db.collection('incidents');
    const session = getSession(event);
    const query = event.queryStringParameters || {};
    const botAuthBody = event.httpMethod === 'GET'
      ? JSON.stringify({ incidentId: query.incidentId || null })
      : (event.body || '');
    const bot = session ? null : await authenticateBot(event, botAuthBody, false);
    const authorizedRead = hasPermission(session, 'bot.read') || isOwner(session) || Boolean(bot);
    if (!authorizedRead) return json(403, { error: 'bot.read permission required' });
    const actorId = session?.userId || bot?.botId || 'system';
    if (bot && event.httpMethod !== 'GET') {
      const requestId = getHeader(event, 'x-sns-request-id');
      const timestamp = getHeader(event, 'x-sns-timestamp');
      if (!requestId || !isFreshRequestTimestamp(timestamp)) {
        return json(401, { error: 'Fresh signed request metadata is required' });
      }
      try {
        await db.collection('request_deduplication').insertOne({
          _id: `${bot.botId}:${requestId}`,
          botId: bot.botId,
          requestId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
      } catch (error) {
        if (error?.code === 11000) return json(409, { error: 'Duplicate or replayed request' });
        throw error;
      }
    }
    if (!await allowRateLimit(db, `incident:${getClientKey(event, session?.userId || 'anon')}`, 30, 60 * 1000)) {
      return json(429, { error: 'Too many incident requests' });
    }

    if (event.httpMethod === 'GET') {
      const filter = {};
      if (query.status && query.status !== 'all') filter.status = normalizeIncidentState(query.status);
      if (query.severity && query.severity !== 'all') filter.severity = query.severity;
      if (query.guildId) filter.guildId = query.guildId;
      if (query.incidentId) filter.incidentId = query.incidentId;
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
      if (!hasPermission(session, 'bot.approve') && !isOwner(session) && !bot) {
        return json(403, { error: 'bot.approve permission required to open incidents' });
      }
      if (!payload.title || !payload.reason) {
        return json(400, { error: 'title and reason are required' });
      }
      const initialStatus = normalizeIncidentState(payload.status || 'open');
      if (!['open', 'assigned', 'investigating', 'monitoring'].includes(initialStatus)) {
        return json(400, { error: 'Incidents must start in an active lifecycle state' });
      }

      const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;
      const record = {
        incidentId,
        title: payload.title,
        severity: payload.severity || 'medium',
        status: initialStatus,
        owner: payload.owner || actorId || 'unassigned',
        guildId: payload.guildId || null,
        reason: payload.reason,
        resolution: null,
        createdBy: actorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeline: [{ actor: actorId, action: 'created', note: payload.reason, createdAt: new Date() }],
      };

      await incidents.insertOne(record);
      await writeAudit(db, {
        actorId,
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

      if (!hasPermission(session, 'bot.approve') && !isOwner(session) && !bot) {
        return json(403, { error: 'bot.approve permission required to update incidents' });
      }

      const existing = await incidents.findOne({ incidentId: payload.incidentId });
      if (!existing) return json(404, { error: 'Incident not found' });

      const nextStatus = getIncidentUpdateStatus(existing.status, payload);
      if (nextStatus !== normalizeIncidentState(existing.status) && !isValidTransition(existing.status, nextStatus)) {
        return json(400, { error: `Invalid state transition from ${existing.status} to ${nextStatus}` });
      }
      if (nextStatus === 'resolved' && !hasResolutionNotes(existing.resolution, payload.resolution)) {
        return json(400, { error: 'Resolution notes are required before resolving an incident' });
      }
      if (nextStatus === 'resolved' && payload.notificationCommandId) {
        const notification = await db.collection('commands').findOne({
          commandId: payload.notificationCommandId,
          command: 'broadcast_notice',
        });
        if (!notification || notification.status !== 'completed') {
          return json(409, { error: 'Incident cannot resolve until the linked notification is delivered' });
        }
      }

      const update = { updatedAt: new Date() };
      if (nextStatus !== existing.status) update.status = nextStatus;
      if (payload.owner) update.owner = payload.owner;
      if (payload.severity) update.severity = payload.severity;
      if (payload.reason) update.reason = payload.reason;
      if (payload.resolution) update.resolution = payload.resolution;
      const timelineEntry = payload.note
        ? { actor: actorId, action: nextStatus !== existing.status ? nextStatus : 'updated', note: payload.note, createdAt: new Date() }
        : null;

      await incidents.updateOne({ incidentId: payload.incidentId }, { $set: update, ...(timelineEntry ? { $push: { timeline: timelineEntry } } : {}) });
      await writeAudit(db, {
        actorId,
        action: nextStatus !== existing.status ? `incident.${nextStatus}` : 'incident.updated',
        targetType: 'incident',
        targetId: payload.incidentId,
        details: { status: nextStatus, owner: payload.owner || existing.owner, note: payload.note || null, notificationCommandId: payload.notificationCommandId || null },
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
