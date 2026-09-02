const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { allowRateLimit, createSecret, getClientKey, hashSecret, writeAudit } = require('./utils/security');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function isOwner(event) {
  return ['owner', 'admin'].includes(getSession(event)?.role);
}

function canAccessBot(session, bot) {
  if (session.role === 'owner' || session.permissions?.includes('*')) return true;
  return bot.ownerIds?.includes(session.userId) || bot.guildIds?.some((guildId) => session.guildIds?.includes(guildId));
}

exports.handler = async (event) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(event.httpMethod)) {
    return json(405, { error: 'Method Not Allowed' });
  }
  const session = getSession(event);
  const requiredPermission = { GET: 'bot.read', POST: 'bot.register', PATCH: 'bot.approve', DELETE: 'bot.delete' }[event.httpMethod];
  if (!hasPermission(session, requiredPermission)) return json(403, { error: `${requiredPermission} permission required` });

  try {
    const db = await getDb();
    const bots = db.collection('bots');
    if (!await allowRateLimit(db, `registry:${getClientKey(event, session.userId)}`, 30, 60 * 1000)) return json(429, { error: 'Too many bot registry requests' });
    await bots.createIndex({ botId: 1 }, { unique: true });

    if (event.httpMethod === 'GET') {
      const filter = session.role === 'owner' || session.permissions?.includes('*')
        ? {}
        : { $or: [{ ownerIds: session.userId }, { guildIds: { $in: session.guildIds || [] } }] };
      const records = await bots.find(
        filter,
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

    if (event.httpMethod === 'PATCH') {
      if (!payload.botId) return json(400, { error: 'botId is required' });
      const targetBot = await bots.findOne({ botId: payload.botId });
      if (!targetBot || !canAccessBot(session, targetBot)) return json(404, { error: 'Bot not found' });
      if (['rotate', 'revoke'].includes(payload.action)) {
        if (!hasPermission(session, 'bot.delete')) return json(403, { error: 'bot.delete permission required for credential changes' });
        if (payload.action === 'revoke') {
          const revoked = await bots.updateOne({ botId: payload.botId }, { $set: { status: 'revoked', revokedAt: new Date(), updatedAt: new Date() }, $unset: { secretHash: '' } });
          if (!revoked.matchedCount) return json(404, { error: 'Bot not found' });
          await writeAudit(db, { actorId: session.userId, action: 'bot.revoked', targetType: 'bot', targetId: payload.botId });
          return json(200, { ok: true, botId: payload.botId, status: 'revoked' });
        }
        const secret = createSecret();
        const rotated = await bots.updateOne({ botId: payload.botId }, { $set: { secretHash: hashSecret(secret), status: 'pending', updatedAt: new Date(), rotatedAt: new Date() } });
        if (!rotated.matchedCount) return json(404, { error: 'Bot not found' });
        await writeAudit(db, { actorId: session.userId, action: 'bot.secret_rotated', targetType: 'bot', targetId: payload.botId });
        return json(200, { ok: true, botId: payload.botId, status: 'pending', secret, warning: 'Store this new secret on the bot host. Approval is required again.' });
      }
      if (!['active', 'denied'].includes(payload.status)) {
        return json(400, { error: 'status active or denied is required' });
      }
      const result = await bots.updateOne(
        { botId: payload.botId },
        { $set: { status: payload.status, reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() } }
      );
      if (!result.matchedCount) return json(404, { error: 'Bot not found' });
      await writeAudit(db, { actorId: session.userId, action: `bot.${payload.status === 'active' ? 'approved' : 'denied'}`, targetType: 'bot', targetId: payload.botId });
      return json(200, { ok: true, botId: payload.botId, status: payload.status });
    }

    if (event.httpMethod === 'POST') {
      if (!/^[a-z0-9][a-z0-9_-]{2,48}$/.test(payload.botId || '') || !payload.name?.trim()) {
        return json(400, { error: 'botId must be 3-49 lowercase characters and name is required' });
      }

      const secret = createSecret();
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

      await writeAudit(db, { actorId: session.userId, action: 'bot.registered', targetType: 'bot', targetId: record.botId, details: { name: record.name } });

      return json(201, {
        bot: { botId: record.botId, name: record.name, status: record.status },
        secret,
        warning: 'Store this secret in the bot host now. It will not be shown again.',
      });
    }

    if (!payload.botId) return json(400, { error: 'botId is required' });
    const result = await bots.deleteOne({ botId: payload.botId, ownerIds: session.userId });
    if (!result.deletedCount) return json(404, { error: 'Bot not found' });
    await writeAudit(db, { actorId: session.userId, action: 'bot.deleted', targetType: 'bot', targetId: payload.botId });
    return json(200, { ok: true, botId: payload.botId });
  } catch (error) {
    console.error('bot-registry error:', error);
    return json(500, { error: 'Failed to process bot registry request' });
  }
};
