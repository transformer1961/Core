const crypto = require('crypto');
const { cookie, getDiscordConfig, signState, stateCookieName } = require('./utils/auth');

exports.handler = async () => {
  try {
    const { clientId, redirectUri } = getDiscordConfig();
    const state = signState({ nonce: crypto.randomUUID() });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    return {
      statusCode: 302,
      headers: {
        Location: `https://discord.com/oauth2/authorize?${params}`,
        'Set-Cookie': cookie(stateCookieName, state, 600),
      },
      body: '',
    };
  } catch (error) {
    console.error('auth-discord error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Discord sign-in is not configured' }) };
  }
};
