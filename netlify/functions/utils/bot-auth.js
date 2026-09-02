const crypto = require('crypto');
const { getDb } = require('./db');

function getHeader(event, name) {
  return event.headers[name] || event.headers[name.toLowerCase()] || null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidSignature(rawBody, signature) {
  const secret = process.env.BOT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function authenticateBot(event, rawBody, checkGlobalDisable = true) {
  const botId = getHeader(event, 'x-sns-bot-id');
  const token = getHeader(event, 'x-sns-bot-token');
  const signature = getHeader(event, 'x-sns-signature');
  if (!botId || !token || !isValidSignature(rawBody, signature)) return null;

  const bot = await (await getDb()).collection('bots').findOne({
    botId,
    secretHash: hashToken(token),
    status: 'active',
  });
  if (bot && checkGlobalDisable && await require('./security').isGloballyDisabled(await getDb())) return null;
  return bot || null;
}

module.exports = { authenticateBot, getHeader };
