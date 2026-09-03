const { getDb } = require('./utils/db');
const { getSession, hasPermission } = require('./utils/auth');
const { allowRateLimit, getClientKey, writeAudit } = require('./utils/security');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) return json(405, { error: 'Method Not Allowed' });
  const session = getSession(event);
  if (!hasPermission(session, 'bot.command')) return json(403, { error: 'bot.command permission required' });

  let payload = {};
  try { payload = event.body ? JSON.parse(event.body) : {}; } catch { return json(400, { error: 'Invalid JSON' }); }

  try {
    const db = await getDb();
    if (!await allowRateLimit(db, `templates:${getClientKey(event, session.userId)}`, 30, 60 * 1000)) return json(429, { error: 'Too many template requests' });
    const templates = db.collection('notification_templates');

    if (event.httpMethod === 'GET') {
      const records = await templates.find({ ownerId: session.userId }, { projection: { _id: 0, templateId: 1, name: 1, message: 1, audience: 1, channel: 1, createdAt: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(50).toArray();
      return json(200, { templates: records });
    }

    if (event.httpMethod === 'DELETE') {
      if (!payload.templateId) return json(400, { error: 'templateId is required' });
      const result = await templates.deleteOne({ templateId: payload.templateId, ownerId: session.userId });
      if (!result.deletedCount) return json(404, { error: 'Template not found' });
      await writeAudit(db, { actorId: session.userId, action: 'notification_template.deleted', targetType: 'template', targetId: payload.templateId });
      return json(200, { ok: true, templateId: payload.templateId });
    }

    if (!payload.name?.trim() || !payload.message?.trim()) return json(400, { error: 'name and message are required' });
    const record = {
      templateId: payload.templateId || require('crypto').randomUUID(),
      ownerId: session.userId,
      name: payload.name.trim().slice(0, 80),
      message: payload.message.trim().slice(0, 4000),
      audience: payload.audience || 'All protected guilds',
      channel: payload.channel || 'System alert',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await templates.updateOne({ templateId: record.templateId, ownerId: session.userId }, { $set: record, $setOnInsert: { createdAt: record.createdAt } }, { upsert: true });
    await writeAudit(db, { actorId: session.userId, action: 'notification_template.saved', targetType: 'template', targetId: record.templateId, details: { name: record.name } });
    return json(201, { template: { templateId: record.templateId, name: record.name, message: record.message, audience: record.audience, channel: record.channel } });
  } catch (error) {
    console.error('notification-templates error:', error);
    return json(500, { error: 'Failed to process notification template' });
  }
};
