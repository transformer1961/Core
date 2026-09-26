const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadHandler(bot) {
  const modules = {
    db: require.resolve('../netlify/functions/utils/db'),
    auth: require.resolve('../netlify/functions/utils/auth'),
    security: require.resolve('../netlify/functions/utils/security'),
  };
  const previous = Object.fromEntries(Object.entries(modules).map(([name, modulePath]) => [name, require.cache[modulePath]]));
  const insertedCommands = [];
  const insertedAudits = [];
  const collections = {
    rate_limit_events: { deleteMany: async () => {}, countDocuments: async () => 0, insertOne: async () => {} },
    bots: { findOne: async () => bot },
    commands: { insertOne: async (command) => insertedCommands.push(command) },
    command_history: { insertOne: async () => {} },
    audit_logs: { insertOne: async (audit) => insertedAudits.push(audit) },
  };
  const db = { collection: (name) => collections[name] };

  require.cache[modules.db] = { id: modules.db, filename: modules.db, loaded: true, exports: { getDb: async () => db } };
  require.cache[modules.auth] = { id: modules.auth, filename: modules.auth, loaded: true, exports: { getSession: () => ({ userId: 'owner-1', role: 'owner', permissions: ['*'], guildIds: ['guild-1'] }), hasPermission: () => true } };
  require.cache[modules.security] = { id: modules.security, filename: modules.security, loaded: true, exports: { allowRateLimit: async () => true, getClientKey: () => 'test-client', isGloballyDisabled: async () => false, writeAudit: async (dbInstance, audit) => dbInstance.collection('audit_logs').insertOne(audit) } };

  const handlerPath = require.resolve('../netlify/functions/bot-commands');
  delete require.cache[handlerPath];
  const handler = require(handlerPath).handler;

  return {
    handler,
    insertedCommands,
    insertedAudits,
    restore() {
      delete require.cache[handlerPath];
      for (const [name, modulePath] of Object.entries(modules)) {
        if (previous[name]) require.cache[modulePath] = previous[name];
        else delete require.cache[modulePath];
      }
    },
  };
}

function postEvent() {
  return {
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ botId: 'watchtower', command: 'restart', reason: 'test' }),
  };
}

test('bot command handler denies a service with no configured permissions', async () => {
  const testContext = loadHandler({ botId: 'watchtower', status: 'active', ownerIds: ['owner-1'], permissions: [] });
  try {
    const response = await testContext.handler(postEvent());
    assert.equal(response.statusCode, 403);
    assert.equal(testContext.insertedCommands.length, 0);
  } finally {
    testContext.restore();
  }
});

test('bot command handler queues a command allowed by the service scope', async () => {
  const testContext = loadHandler({ botId: 'watchtower', status: 'active', ownerIds: ['owner-1'], permissions: ['restart'] });
  try {
    const response = await testContext.handler(postEvent());
    assert.equal(response.statusCode, 202);
    assert.equal(testContext.insertedCommands.length, 1);
    assert.equal(testContext.insertedCommands[0].command, 'restart');
    assert.equal(testContext.insertedAudits[0].action, 'command.queued');
  } finally {
    testContext.restore();
  }
});
