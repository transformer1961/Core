const { getDb } = require('./utils/db');
const { isGloballyDisabled } = require('./utils/security');

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return json(200, {
      status: 'ok',
      database: 'ok',
      globallyDisabled: await isGloballyDisabled(db),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('health error:', error.message);
    return json(503, { status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
};