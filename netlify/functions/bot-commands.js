const crypto = require('crypto');
const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { authenticateBot, getHeader } = require('./utils/bot-auth');
const { allowRateLimit, getClientKey, isGloballyDisabled, writeAudit } = require('./utils/security');

const allowedCommands = new Set(['enable', 'disable', 'restart', 'shutdown', 'deploy_update', 'trigger_lockdown', 'broadcast_notice']);

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function timingSafeEqualText(actual, expected) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function isAdmin(event) {
  const session = getSession(event);
  return hasPermission(session, 'bot.command') || timingSafeEqualText(getHeader(event, 'x-sns-admin-key'), process.env.SNS_ADMIN_KEY);
}

exports.handler = async (event) => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) {
    return json(405, { error: 'Method Not Allowed' });
  }

  const rawBody = event.body || '';
  let payload = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
  }

  try {
    if (event.httpMethod === 'POST') {
      const session = getSession(event);
      const adminKeyValid = timingSafeEqualText(getHeader(event, 'x-sns-admin-key'), process.env.SNS_ADMIN_KEY);
      if (!hasPermission(session, 'bot.command') && !adminKeyValid) return json(401, { error: 'Admin authentication required' });
      if (!payload.botId || !allowedCommands.has(payload.command)) {
        return json(400, { error: 'botId and a supported command are required' });
      }
      if (!adminKeyValid && !hasPermission(session, 'bot.command', payload.guildId || null)) return json(403, { error: 'bot.command permission required for this guild' });
      const db = await getDb();
      if (!await allowRateLimit(db, `command:${getClientKey(event, session?.userId || 'admin-key')}`, 20, 60 * 1000)) return json(429, { error: 'Too many command requests' });
      if (payload.confirmed !== true && ['shutdown', 'trigger_lockdown'].includes(payload.command)) return json(409, { error: 'Explicit confirmation is required for this command' });
      const bot = await db.collection('bots').findOne({ botId: payload.botId, status: 'active' }, { projection: { _id: 0, botId: 1, guildIds: 1, ownerIds: 1 } });
      if (!bot) return json(409, { error: 'Bot must be registered and approved before receiving commands' });
      const canAccessBot = session?.role === 'owner' || session?.permissions?.includes('*') || bot.ownerIds?.includes(session.userId) || bot.guildIds?.some((guildId) => session.guildIds?.includes(guildId));
      if (!adminKeyValid && !canAccessBot) return json(403, { error: 'bot.command permission is not valid for this bot' });

      const commands = db.collection('commands');

      const command = {
        commandId: crypto.randomUUID(),
        botId: payload.botId,
        command: payload.command,
        guildId: payload.guildId || null,
        message: payload.message || null,
        audience: payload.audience || null,
        channel: payload.channel || null,
        reason: payload.reason || null,
        requestedBy: payload.requestedBy || 'owner-panel',
        status: 'queued',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        updatedAt: new Date(),
      };
      await commands.insertOne(command);
      await db.collection('command_history').insertOne({ commandId: command.commandId, botId: command.botId, command: command.command, status: 'queued', actorId: session?.userId || 'admin-key', createdAt: new Date() });
      await writeAudit(db, { actorId: session?.userId || 'admin-key', action: 'command.queued', targetType: 'bot', targetId: command.botId, details: { commandId: command.commandId, command: command.command, guildId: command.guildId, reason: command.reason } });
      return json(202, { ok: true, commandId: command.commandId, status: command.status });
    }

    if (!await authenticateBot(event, rawBody)) return json(401, { error: 'Bot authentication required' });
    const botId = getHeader(event, 'x-sns-bot-id');
    const db = await getDb();
    const commands = db.collection('commands');

    if (event.httpMethod === 'GET') {
      const command = await commands.findOneAndUpdate(
        {
          botId,
          status: 'queued',
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { status: 'received', receivedAt: new Date(), updatedAt: new Date() },
        },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
      );

      if (!command) return json(200, { command: null });
      await db.collection('command_history').insertOne({ commandId: command.commandId, botId, command: command.command, status: 'received', actorId: botId, createdAt: new Date() });
      return json(200, { command });
    }

    if (!payload.commandId || !['running', 'completed', 'failed'].includes(payload.status)) {
      return json(400, { error: 'commandId and a valid status are required' });
    }

    const transitionFilter = payload.status === 'running'
      ? { status: 'received' }
      : { status: { $in: ['received', 'running'] } };

    const result = await commands.findOneAndUpdate(
      { commandId: payload.commandId, botId, ...transitionFilter },
      {
        $set: {
          status: payload.status,
          result: payload.result || null,
          error: payload.error || null,
          updatedAt: new Date(),
          completedAt: payload.status === 'completed' || payload.status === 'failed' ? new Date() : null,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) return json(404, { error: 'Command not found for this bot' });
    await db.collection('command_history').insertOne({ commandId: payload.commandId, botId, command: result.command, status: payload.status, actorId: botId, result: payload.result || null, error: payload.error || null, createdAt: new Date() });
    await writeAudit(db, { actorId: botId, action: `command.${payload.status}`, targetType: 'command', targetId: payload.commandId, details: { result: payload.result || null, error: payload.error || null } });
    return json(200, { ok: true, commandId: payload.commandId, status: result.status });
  } catch (error) {
    console.error('bot-commands error:', error);
    return json(500, { error: 'Failed to process bot command' });
  }
};
