const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { allowRateLimit, getClientKey } = require('./utils/security');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
  const session = getSession(event);
  if (!hasPermission(session, 'bot.read')) return json(403, { error: 'bot.read permission required' });

  try {
    const db = await getDb();
    if (!await allowRateLimit(db, `history:${getClientKey(event, session.userId)}`, 60, 60 * 1000)) return json(429, { error: 'Too many history requests' });
    const query = event.queryStringParameters || {};
    const filter = {};
    if (query.botId && /^[a-z0-9][a-z0-9_-]{2,48}$/.test(query.botId)) filter.botId = query.botId;
    if (session.role !== 'owner' && !session.permissions?.includes('*') && session.guildIds?.length) {
      const scopedBots = await db.collection('bots').find({ guildIds: { $in: session.guildIds } }, { projection: { _id: 0, botId: 1 } }).toArray();
      filter.botId = { $in: scopedBots.map((bot) => bot.botId) };
    }
    const history = await db.collection('command_history').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
    return json(200, { history });
  } catch (error) {
    console.error('command-history error:', error);
    return json(500, { error: 'Failed to load command history' });
  }
};
