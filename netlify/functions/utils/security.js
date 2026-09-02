const crypto = require('crypto');

function getClientKey(event, fallback = 'unknown') {
  return event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for']?.split(',')[0]?.trim() || fallback;
}

async function writeAudit(db, { actorId = 'system', action, targetType, targetId = null, details = {}, requestKey = null }) {
  await db.collection('audit_logs').insertOne({
    actorId,
    action,
    targetType,
    targetId,
    details,
    requestKey,
    createdAt: new Date(),
  });
}

async function allowRateLimit(db, key, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const events = db.collection('rate_limit_events');
  await events.deleteMany({ key, createdAt: { $lt: new Date(windowStart) } });
  const count = await events.countDocuments({ key, createdAt: { $gte: new Date(windowStart) } });
  if (count >= limit) return false;
  await events.insertOne({ key, createdAt: new Date(now) });
  return true;
}

async function setGlobalDisabled(db, disabled, actorId) {
  await db.collection('system_controls').updateOne(
    { _id: 'global' },
    { $set: { disabled, updatedAt: new Date(), updatedBy: actorId } },
    { upsert: true }
  );
}

async function isGloballyDisabled(db) {
  const state = await db.collection('system_controls').findOne({ _id: 'global' });
  return state?.disabled === true;
}

function createSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

module.exports = { allowRateLimit, createSecret, getClientKey, hashSecret, isGloballyDisabled, setGlobalDisabled, writeAudit };
