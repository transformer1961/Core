const crypto = require('crypto');

const sessionCookieName = 'sns_session';
const stateCookieName = 'sns_oauth_state';
const sessionLifetimeSeconds = 60 * 60 * 8;
const stateLifetimeSeconds = 10 * 60;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64url(value) {
  return Buffer.from(value, 'base64url');
}

function getSessionSecret() {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  return crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
}

function signState(payload) {
  const encoded = base64url(JSON.stringify({ ...payload, exp: Date.now() + stateLifetimeSeconds * 1000 }));
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(token) {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const payload = JSON.parse(fromBase64url(encoded).toString('utf8'));
  return payload.exp > Date.now() ? payload : null;
}

function encryptSession(payload) {
  const key = getSessionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ ...payload, exp: Date.now() + sessionLifetimeSeconds * 1000 }), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSession(token) {
  if (!token) return null;
  try {
    const [ivText, tagText, encryptedText] = token.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getSessionSecret(), fromBase64url(ivText));
    decipher.setAuthTag(fromBase64url(tagText));
    const decrypted = Buffer.concat([
      decipher.update(fromBase64url(encryptedText)),
      decipher.final(),
    ]).toString('utf8');
    const payload = JSON.parse(decrypted);
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function parseCookies(event) {
  const header = event.headers.cookie || event.headers.Cookie || '';
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=')));
}

function getSession(event) {
  return decryptSession(parseCookies(event)[sessionCookieName]);
}

function hasPermission(session, permission, guildId = null) {
  if (session?.role === 'owner' || session?.permissions?.includes('*')) return true;
  if (!session?.permissions?.includes(permission)) return false;
  return !guildId || !session.guildIds?.length || session.guildIds.includes(guildId);
}

function cookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production' ? '; Secure' : '';
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function clearSessionCookie() {
  return cookie(sessionCookieName, '', 0);
}

function getDiscordConfig() {
  const required = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'];
  const missing = required.filter((name) => !process.env[name]);
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (missing.length) throw new Error(`Missing auth configuration: ${missing.join(', ')}`);
  return {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
  };
}

async function getAuthorization(userId, guilds = []) {
  const ownerIds = (process.env.SNS_OWNER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (ownerIds.includes(userId)) return { role: 'owner', permissions: ['*'] };

  const staffIds = (process.env.SNS_STAFF_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (staffIds.includes(userId)) return { role: 'admin', permissions: ['*'] };

  const allowedGuildIds = (process.env.SNS_ALLOWED_GUILD_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (allowedGuildIds.length > 0 && guilds.some((guild) => allowedGuildIds.includes(guild.id) && guild.owner)) {
    return { role: 'owner', permissions: ['*'] };
  }

  const { getDb } = require('./db');
  const record = await (await getDb()).collection('access_controls').findOne({ userId, enabled: true });
  return record ? { role: record.role, permissions: record.permissions || [], guildIds: record.guildIds || [] } : null;
}

async function getUserRole(userId, guilds = []) {
  return (await getAuthorization(userId, guilds))?.role || null;
}

async function isApprovedOwner(userId, guilds = []) {
  return Boolean(await getAuthorization(userId, guilds));
}

module.exports = {
  clearSessionCookie,
  cookie,
  decryptSession,
  encryptSession,
  getDiscordConfig,
  getAuthorization,
  getUserRole,
  getSession,
  hasPermission,
  isApprovedOwner,
  parseCookies,
  signState,
  stateCookieName,
  sessionCookieName,
  verifyState,
};
