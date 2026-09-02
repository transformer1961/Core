const { getSession } = require('./utils/auth');

exports.handler = async (event) => {
  const session = getSession(event);
  if (!session) return { statusCode: 401, body: JSON.stringify({ authenticated: false }) };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        globalName: session.globalName,
        avatar: session.avatar,
        role: session.role,
        permissions: session.permissions || [],
      },
    }),
  };
};
