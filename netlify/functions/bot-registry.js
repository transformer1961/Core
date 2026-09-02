const crypto = require('crypto');
const { getDb } = require('./utils/db');
const { getSession } = require('./utils/auth');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function isOwner(event) {
  return getSession(event)?.role === 'owner';
}

function createBotSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

exports.handler = async (event) => {
  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) {
    return json(405, { error: 'Method Not Allowed' });
  }
  if (!isOwner(event)) return json(401, { error: 'Owner authentication required' });

  try {
    const bots = (await getDb()).collection('bots');
    const session = getSession(event);
    await bots.createIndex({ botId: 1 }, { unique: true });

    if (event.httpMethod === 'GET') {
      const records = await bots.find(
        { ownerIds: session.userId },
        { projection: { _id: 0, botId: 1, name: 1, status: 1, guildIds: 1, createdAt: 1, lastSeenAt: 1 } }
      ).sort({ name: 1 }).toArray();
      return json(200, { bots: records });
    }

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }

    if (event.httpMethod === 'POST') {
      if (!/^[a-z0-9][a-z0-9_-]{2,48}$/.test(payload.botId || '') || !payload.name?.trim()) {
        return json(400, { error: 'botId must be 3-49 lowercase characters and name is required' });
      }

      const secret = createBotSecret();
      const record = {
        botId: payload.botId,
        name: payload.name.trim(),
        ownerIds: [session.userId],
        secretHash: hashSecret(secret),
        status: 'pending',
        guildIds: [],
        createdAt: new Date(),
        lastSeenAt: null,
      };

      try {
        await bots.insertOne(record);
      } catch (error) {
        if (error.code === 11000) return json(409, { error: 'That botId is already registered' });
        throw error;
      }

      return json(201, {
        bot: { botId: record.botId, name: record.name, status: record.status },
        secret,
        warning: 'Store this secret in the bot host now. It will not be shown again.',
      });
    }

    if (!payload.botId) return json(400, { error: 'botId is required' });
    const result = await bots.deleteOne({ botId: payload.botId, ownerIds: session.userId });
    if (!result.deletedCount) return json(404, { error: 'Bot not found' });
    return json(200, { ok: true, botId: payload.botId });
  } catch (error) {
    console.error('bot-registry error:', error);
    return json(500, { error: 'Failed to process bot registry request' });
  }
};
