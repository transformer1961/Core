const { getDb } = require('./utils/db');
const { getSession } = require('./utils/auth');
const { allowRateLimit, getClientKey } = require('./utils/security');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
  const session = getSession(event);
  if (session?.role !== 'owner') return json(403, { error: 'Owner permission required' });

  try {
    const db = await getDb();
    if (!await allowRateLimit(db, `audit:${getClientKey(event, session.userId)}`, 60, 60 * 1000)) return json(429, { error: 'Too many audit requests' });
    const query = event.queryStringParameters || {};
    const filter = {};
    if (query.targetType && /^[a-z_]{1,30}$/.test(query.targetType)) filter.targetType = query.targetType;
    if (query.action && /^[a-z_.]{1,50}$/.test(query.action)) filter.action = query.action;
    const records = await db.collection('audit_logs')
      .find(filter, { projection: { _id: 0, actorId: 1, action: 1, targetType: 1, targetId: 1, details: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return json(200, { records });
  } catch (error) {
    console.error('audit-log error:', error);
    return json(500, { error: 'Failed to load audit log' });
  }
};
