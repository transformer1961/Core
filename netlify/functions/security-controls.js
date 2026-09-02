const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { allowRateLimit, getClientKey, isGloballyDisabled, setGlobalDisabled, writeAudit } = require('./utils/security');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method Not Allowed' });
  const session = getSession(event);
  if (!hasPermission(session, 'system.control')) return json(403, { error: 'system.control permission required' });

  try {
    const db = await getDb();
    if (!await allowRateLimit(db, `security:${getClientKey(event, session.userId)}`, 10, 60 * 1000)) return json(429, { error: 'Too many security-control requests' });

    if (event.httpMethod === 'GET') return json(200, { disabled: await isGloballyDisabled(db) });

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    if (typeof payload.disabled !== 'boolean') return json(400, { error: 'disabled must be boolean' });
    await setGlobalDisabled(db, payload.disabled, session.userId);
    if (payload.disabled) {
      await db.collection('commands').updateMany(
        { status: 'queued' },
        { $set: { status: 'expired', expiredAt: new Date(), updatedAt: new Date() } }
      );
    }
    await writeAudit(db, { actorId: session.userId, action: payload.disabled ? 'system.disabled' : 'system.enabled', targetType: 'system', targetId: 'global' });
    return json(200, { ok: true, disabled: payload.disabled });
  } catch (error) {
    console.error('security-controls error:', error);
    return json(500, { error: 'Failed to update security controls' });
  }
};
