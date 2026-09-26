const { hasServiceCommandPermission } = require('./servicePermissions');

function canAccessBot(session, bot) {
  return session?.role === 'owner'
    || session?.permissions?.includes('*')
    || bot.ownerIds?.includes(session?.userId)
    || bot.guildIds?.some((guildId) => session?.guildIds?.includes(guildId));
}

function authorizeQueuedCommand({ session, bot, command, guildId, adminKeyValid = false }) {
  if (!adminKeyValid && !canAccessBot(session, bot)) return 'bot.command permission is not valid for this bot';
  if (!hasServiceCommandPermission(bot, command)) return 'The target service is not approved for this command';
  if (!adminKeyValid && guildId && session?.guildIds?.length && !session.guildIds.includes(guildId)) return 'bot.command permission required for this guild';
  return null;
}

module.exports = { authorizeQueuedCommand, canAccessBot };