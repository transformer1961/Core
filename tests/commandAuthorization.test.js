const test = require('node:test');
const assert = require('node:assert/strict');

const { authorizeQueuedCommand } = require('../netlify/functions/utils/commandAuthorization');

const bot = { ownerIds: ['owner-1'], guildIds: ['guild-1'], permissions: ['restart'] };

test('command authorization requires access to the target bot', () => {
  assert.equal(authorizeQueuedCommand({ session: { userId: 'other' }, bot, command: 'restart' }), 'bot.command permission is not valid for this bot');
});

test('command authorization enforces service scope and guild scope', () => {
  const session = { userId: 'owner-1', guildIds: ['guild-1'] };
  assert.equal(authorizeQueuedCommand({ session, bot, command: 'shutdown' }), 'The target service is not approved for this command');
  assert.equal(authorizeQueuedCommand({ session, bot, command: 'restart', guildId: 'guild-2' }), 'bot.command permission required for this guild');
  assert.equal(authorizeQueuedCommand({ session, bot, command: 'restart', guildId: 'guild-1' }), null);
});