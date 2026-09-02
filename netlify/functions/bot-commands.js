const crypto = require('crypto');
const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { authenticateBot, getHeader } = require('./utils/bot-auth');

const allowedCommands = new Set(['enable', 'disable', 'restart', 'shutdown', 'trigger_lockdown']);

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
      if (!isAdmin(event)) return json(401, { error: 'Admin authentication required' });
      if (!payload.botId || !allowedCommands.has(payload.command)) {
        return json(400, { error: 'botId and a supported command are required' });
      }

      const commands = (await getDb()).collection('commands');

      const command = {
        commandId: crypto.randomUUID(),
        botId: payload.botId,
        command: payload.command,
        reason: payload.reason || null,
        requestedBy: payload.requestedBy || 'owner-panel',
        status: 'queued',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        updatedAt: new Date(),
      };
      await commands.insertOne(command);
      return json(202, { ok: true, commandId: command.commandId, status: command.status });
    }

    if (!await authenticateBot(event, rawBody)) return json(401, { error: 'Bot authentication required' });
    const botId = getHeader(event, 'x-sns-bot-id');
  const commands = (await getDb()).collection('commands');

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
      return json(200, { command });
    }

    if (!payload.commandId || !['running', 'completed', 'failed'].includes(payload.status)) {
      return json(400, { error: 'commandId and a valid status are required' });
    }

    const result = await commands.findOneAndUpdate(
      { commandId: payload.commandId, botId },
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
    return json(200, { ok: true, commandId: payload.commandId, status: result.status });
  } catch (error) {
    console.error('bot-commands error:', error);
    return json(500, { error: 'Failed to process bot command' });
  }
};
