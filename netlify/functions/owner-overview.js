// netlify/functions/owner-overview.js
// GET /api/owner/overview
// Single aggregate read for the Owner Panel: per-bot health, live stats,
// the real event feed, queued commands, and a computed security posture.
// Everything comes from collections other functions already write — read-only.
//
// Requires a signed-in session with bot.read permission (owner passes).

const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { allowRateLimit, getClientKey, isGloballyDisabled } = require('./utils/security');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function getHealth(bot) {
  if (['pending', 'denied', 'revoked'].includes(bot.status)) return bot.status;
  if (!bot.lastSeenAt) return 'offline';
  const ageMs = Date.now() - new Date(bot.lastSeenAt).getTime();
  if (ageMs <= 90 * 1000) return 'online';
  if (ageMs <= 5 * 60 * 1000) return 'stale';
  return 'offline';
}

function summarizeSession(session) {
  return {
    role: session.role || 'member',
    userId: session.userId || null,
    permissions: session.permissions || [],
    guildCount: (session.guildIds || []).length,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const session = getSession(event);
  if (!hasPermission(session, 'bot.read')) {
    return json(403, { error: 'bot.read permission required' });
  }

  try {
    const db = await getDb();
    if (!await allowRateLimit(db, `overview:${getClientKey(event, session.userId)}`, 60, 60 * 1000)) {
      return json(429, { error: 'Too many overview requests' });
    }

    // Owners see everything; scoped staff only see their own guilds' bots.
    const scoped = session.role !== 'owner' && !session.permissions?.includes('*');
    const botFilter = scoped
      ? { $or: [{ ownerIds: session.userId }, { guildIds: { $in: session.guildIds || [] } }] }
      : {};

    const [bots, statuses, events, queuedCount, disabled] = await Promise.all([
      db.collection('bots')
        .find(botFilter, { projection: { _id: 0, botId: 1, name: 1, status: 1, guildIds: 1, createdAt: 1, lastSeenAt: 1 } })
        .sort({ name: 1 })
        .limit(200)
        .toArray(),
      db.collection('bot_status')
        .find({}, { projection: { _id: 1, online: 1, guilds: 1, uptimeSeconds: 1, latencyMs: 1, activeIncidents: 1, incidentsHandledTotal: 1, keplerStatus: 1, updatedAt: 1 } })
        .limit(200)
        .toArray(),
      db.collection('guild_events')
        .find({}, { projection: { _id: 0, guildId: 1, event: 1, message: 1, sentBy: 1, timestamp: 1 } })
        .sort({ timestamp: -1 })
        .limit(25)
        .toArray(),
      db.collection('commands').countDocuments({ status: 'queued', expiresAt: { $gt: new Date() } }),
      isGloballyDisabled(db),
    ]);

    const statusById = new Map(statuses.map((doc) => [doc._id, doc]));

    const botSummaries = bots.map((bot) => {
      const status = statusById.get(bot.botId) || null;
      return {
        botId: bot.botId,
        name: bot.name,
        status: bot.status,
        health: getHealth(bot),
        lastSeenAt: bot.lastSeenAt || null,
        online: status?.online ?? false,
        guilds: status?.guilds ?? 0,
        uptimeSeconds: status?.uptimeSeconds ?? 0,
        latencyMs: status?.latencyMs ?? null,
        activeIncidents: status?.activeIncidents ?? 0,
        incidentsHandledTotal: status?.incidentsHandledTotal ?? 0,
        keplerStatus: status?.keplerStatus ?? 'unknown',
      };
    });

    const counts = {
      total: bots.length,
      online: botSummaries.filter((b) => b.health === 'online').length,
      stale: botSummaries.filter((b) => b.health === 'stale').length,
      offline: botSummaries.filter((b) => b.health === 'offline').length,
      pending: botSummaries.filter((b) => b.status === 'pending').length,
      totalGuilds: botSummaries.reduce((sum, b) => sum + (b.guilds || 0), 0),
      activeIncidents: botSummaries.reduce((sum, b) => sum + (b.activeIncidents || 0), 0),
      incidentsHandledTotal: botSummaries.reduce((sum, b) => sum + (b.incidentsHandledTotal || 0), 0),
    };

    // Posture checks — the panel highlights whichever are failing.
    const checks = {
      globallyDisabled: disabled,
      pendingApprovals: counts.pending,
      staleBots: counts.stale,
      offlineActiveBots: botSummaries.filter((b) => b.status === 'active' && b.health === 'offline').length,
      queuedCommands: queuedCount,
    };

    return json(200, {
      generatedAt: new Date().toISOString(),
      session: summarizeSession(session),
      bots: botSummaries,
      counts,
      events,
      security: checks,
    });
  } catch (error) {
    console.error('owner-overview error:', error);
    return json(500, { error: 'Failed to load owner overview' });
  }
};
