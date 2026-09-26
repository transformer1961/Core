function getBotHealth(bot = {}) {
  if (['pending', 'denied', 'suspended', 'revoked'].includes(bot.status)) return bot.status;
  if (!bot.lastSeenAt) return 'offline';
  const ageMs = Date.now() - new Date(bot.lastSeenAt).getTime();
  if (ageMs <= 90 * 1000) return 'online';
  if (ageMs <= 5 * 60 * 1000) return 'stale';
  return 'offline';
}

module.exports = { getBotHealth };