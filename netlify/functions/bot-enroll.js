const crypto = require('crypto');
const { getDb } = require('./utils/db');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isEnrollmentKeyValid(event) {
  const actual = event.headers['x-sns-enrollment-key'] || event.headers['X-Sns-Enrollment-Key'];
  const expected = process.env.SNS_ENROLLMENT_KEY;
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

exports.handler = async (event) => {
  if (!['POST', 'GET'].includes(event.httpMethod)) return json(405, { error: 'Method Not Allowed' });
  if (!isEnrollmentKeyValid(event)) return json(401, { error: 'Enrollment authentication required' });

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  try {
    const bots = (await getDb()).collection('bots');
    if (event.httpMethod === 'POST') {
      if (!/^[a-z0-9][a-z0-9_-]{2,48}$/.test(payload.botId || '') || !payload.name?.trim()) {
        return json(400, { error: 'botId and name are required' });
      }
      const token = crypto.randomBytes(32).toString('base64url');
      const record = {
        botId: payload.botId,
        name: payload.name.trim(),
        ownerIds: [],
        secretHash: hashToken(token),
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
      return json(201, { botId: record.botId, status: record.status, token, warning: 'Store this token on the bot host. It will not be shown again.' });
    }

    if (!payload.botId || !payload.token) return json(400, { error: 'botId and token are required' });
    const bot = await bots.findOne({ botId: payload.botId, secretHash: hashToken(payload.token) }, { projection: { _id: 0, botId: 1, name: 1, status: 1 } });
    if (!bot) return json(401, { error: 'Invalid enrollment credentials' });
    return json(200, bot);
  } catch (error) {
    console.error('bot-enroll error:', error);
    return json(500, { error: 'Failed to process enrollment request' });
  }
};