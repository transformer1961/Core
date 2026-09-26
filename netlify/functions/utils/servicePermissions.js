const SERVICE_COMMANDS = ['enable', 'disable', 'restart', 'shutdown', 'deploy_update', 'trigger_lockdown', 'broadcast_notice'];

function normalizeServicePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  const normalized = [...new Set(permissions.filter((permission) => SERVICE_COMMANDS.includes(permission) || permission === '*'))];
  return normalized.includes('*') ? ['*'] : normalized;
}

function hasServiceCommandPermission(bot = {}, command) {
  if (!Array.isArray(bot.permissions) || bot.permissions.length === 0) return false;
  return bot.permissions.includes('*') || bot.permissions.includes(command);
}

module.exports = { SERVICE_COMMANDS, hasServiceCommandPermission, normalizeServicePermissions };