// netlify/functions/bot-event-webhook.js
// POST /api/webhooks/bot-event
// SNS Core (the bot process) pushes heartbeats + events here.
// Authenticated via HMAC-SHA256 signature, NOT an open endpoint —
// this controls what shows up publicly on /status, so treat the secret
// with the same care as your other API keys.
//
// Required env var: BOT_WEBHOOK_SECRET
//
// Expected header:  x-sns-signature: <hex hmac of raw body using BOT_WEBHOOK_SECRET>
//
// Expected body shapes —
//
// Heartbeat / stats update:
// {
//   "type": "heartbeat",
//   "online": true,
//   "guilds": 12,
//   "uptimeSeconds": 48213,
//   "latencyMs": 42,
//   "activeIncidents": 0,
//   "incidentsHandledTotal": 137,
//   "keplerStatus": "armed"
// }
//
// Discrete event (incident, kepler trigger, mod action):
// {
//   "type": "event",
//   "guildId": "1234567890",
//   "event": "kepler_triggered",
//   "message": "Kepler Protocol activated for your server.",
//   "sentBy": "system"
// }

const { getDb } = require('./utils/db');
const { authenticateBot, getHeader, isFreshRequestTimestamp } = require('./utils/bot-auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.BOT_WEBHOOK_SECRET) {
    console.error('BOT_WEBHOOK_SECRET is not set');
    return { statusCode: 500, body: 'Server misconfigured' };
  }

  const rawBody = event.body || '';

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  try {
    const db = await getDb();
    const headerBotId = getHeader(event, 'x-sns-bot-id');
    const requestId = getHeader(event, 'x-sns-request-id');
    const timestamp = getHeader(event, 'x-sns-timestamp');
    if (!headerBotId || !requestId || !isFreshRequestTimestamp(timestamp) || !await authenticateBot(event, rawBody, false)) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Registered bot authentication required' }) };
    }

    try {
      await db.collection('request_deduplication').insertOne({
        _id: `${headerBotId}:${requestId}`,
        botId: headerBotId,
        requestId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    } catch (error) {
      if (error?.code === 11000) return { statusCode: 409, body: JSON.stringify({ error: 'Duplicate or replayed request' }) };
      throw error;
    }

    const botId = payload.botId || headerBotId;
    if (botId !== headerBotId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'botId must match x-sns-bot-id' }) };
    }

    if (payload.type === 'heartbeat') {
      await db.collection('bot_status').updateOne(
        { _id: botId },
        {
          $set: {
            botId,
            online: payload.online ?? true,
            guilds: payload.guilds ?? 0,
            uptimeSeconds: payload.uptimeSeconds ?? 0,
            latencyMs: payload.latencyMs ?? null,
            activeIncidents: payload.activeIncidents ?? 0,
            incidentsHandledTotal: payload.incidentsHandledTotal ?? 0,
            keplerStatus: payload.keplerStatus ?? 'unknown',
            lastDeploy: payload.lastDeploy ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
      const heartbeatBot = await db.collection('bots').updateOne(
        { botId, status: 'active' },
        { $set: { lastSeenAt: new Date() } }
      );
      if (!heartbeatBot.matchedCount) {
        return { statusCode: 409, body: JSON.stringify({ error: 'Bot is no longer active' }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, type: 'heartbeat' }) };
    }

    if (payload.type === 'event') {
      if (!payload.guildId || !payload.event) {
        return { statusCode: 400, body: JSON.stringify({ error: 'guildId and event are required' }) };
      }

      await db.collection('guild_events').insertOne({
        guildId: payload.guildId,
        event: payload.event, // e.g. "kepler_triggered", "kepler_disarmed", "mod_action", "incident"
        message: payload.message || null,
        sentBy: payload.sentBy || 'system', // "system" | watchdog user id
        channels: payload.channels || ['dashboard'], // dashboard | discord_dm | email
        timestamp: new Date().toISOString(),
      });

      // Kepler state changes also update the global/guild-facing status.
      if (payload.event === 'kepler_triggered' || payload.event === 'kepler_disarmed') {
        await db.collection('guild_status').updateOne(
          { guildId: payload.guildId },
          {
            $set: {
              keplerStatus: payload.event === 'kepler_triggered' ? 'triggered' : 'disarmed',
              updatedAt: new Date().toISOString(),
            },
          },
          { upsert: true }
        );
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true, type: 'event' }) };
    }

    if (payload.type === 'blacklist_update') {
      const validScopes = ['user', 'server'];
      const validActions = ['add', 'remove', 'lift', 'appeal'];
      if (!validScopes.includes(payload.scope) || !validActions.includes(payload.action) || !payload.subjectId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'scope, action, and subjectId are required' }) };
      }

      const collection = payload.scope === 'user' ? 'blacklist_entries' : 'server_blacklist_entries';
      const entry = payload.entry && typeof payload.entry === 'object' ? payload.entry : {};
      const safeEntry = payload.scope === 'user'
        ? {
            userId: payload.subjectId,
            reason: entry.reason || null,
            addedBy: entry.addedBy || null,
            addedAt: entry.addedAt || null,
            source: payload.source || 'sentinel-bot',
            updatedAt: new Date().toISOString()
          }
        : {
            serverId: payload.subjectId,
            serverName: entry.serverName || 'Unknown',
            reason: entry.reason || null,
            addedBy: entry.addedBy || null,
            addedById: entry.addedById || null,
            addedAt: entry.addedAt || null,
            memberCount: Number(entry.memberCount) || 0,
            ownerId: entry.ownerId || null,
            status: entry.status || (payload.action === 'lift' ? 'LIFTED' : 'ACTIVE'),
            appealNotes: Array.isArray(entry.appealNotes) ? entry.appealNotes : [],
            liftedAt: entry.liftedAt || null,
            liftedBy: entry.liftedBy || null,
            liftReason: entry.liftReason || null,
            source: payload.source || 'sentinel-bot',
            updatedAt: new Date().toISOString()
          };

      if (payload.scope === 'user' && payload.action === 'remove') {
        await db.collection(collection).deleteOne({ _id: payload.subjectId });
      } else {
        await db.collection(collection).updateOne(
          { _id: payload.subjectId },
          { $set: safeEntry },
          { upsert: true }
        );
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true, type: 'blacklist_update', scope: payload.scope, action: payload.action }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown payload type' }) };
  } catch (err) {
    console.error('bot-event-webhook error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process event' }) };
  }
};
