const { clearSessionCookie } = require('./utils/auth');

exports.handler = async () => ({
  statusCode: 302,
  headers: {
    Location: '/',
    'Set-Cookie': clearSessionCookie(),
  },
  body: '',
});
