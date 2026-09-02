const { getDb } = require('./utils/db');
const { getSession } = require('./utils/auth');

const allowedPermissions = new Set(['bot.read', 'bot.register', 'bot.approve', 'bot.command', 'bot.delete']);

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function isOwner(event) {
  return getSession(event)?.role === 'owner';
}

exports.handler = async (event) => {
  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) return json(405, { error: 'Method Not Allowed' });
  if (!isOwner(event)) return json(403, { error: 'Owner permission required' });

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  try {
    const access = (await getDb()).collection('access_controls');
    const session = getSession(event);
    await access.createIndex({ userId: 1 }, { unique: true });

    if (event.httpMethod === 'GET') {
      const records = await access.find({}, { projection: { _id: 0, userId: 1, role: 1, permissions: 1, enabled: 1, updatedAt: 1 } }).sort({ userId: 1 }).toArray();
      return json(200, { permissions: records });
    }

    if (!/^\d{5,25}$/.test(payload.userId || '') || payload.userId === session.userId) {
      return json(400, { error: 'A valid Discord user ID other than your own is required' });
    }

    if (event.httpMethod === 'DELETE') {
      await access.deleteOne({ userId: payload.userId });
      return json(200, { ok: true, userId: payload.userId, revoked: true });
    }

    const permissions = Array.isArray(payload.permissions)
      ? [...new Set(payload.permissions.filter((permission) => allowedPermissions.has(permission)))]
      : [];
    const record = {
      userId: payload.userId,
      role: payload.role === 'viewer' ? 'viewer' : 'admin',
      permissions,
      enabled: payload.enabled !== false,
      updatedAt: new Date(),
      updatedBy: session.userId,
    };
    await access.updateOne({ userId: record.userId }, { $set: record, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return json(200, { ok: true, permission: { userId: record.userId, role: record.role, permissions: record.permissions, enabled: record.enabled } });
  } catch (error) {
    console.error('access-control error:', error);
    return json(500, { error: 'Failed to update access controls' });
  }
};

module.exports.allowedPermissions = [...allowedPermissions];
