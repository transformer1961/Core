const { cookie, encryptSession, getAuthorization, getDiscordConfig, parseCookies, stateCookieName, verifyState, sessionCookieName } = require('./utils/auth');

function redirect(path) {
  return { statusCode: 302, headers: { Location: path }, body: '' };
}

exports.handler = async (event) => {
  try {
    const { clientId, clientSecret, redirectUri } = getDiscordConfig();
    const params = new URLSearchParams(event.queryStringParameters || {});
    const stateToken = parseCookies(event)[stateCookieName];
    const state = verifyState(stateToken);
    if (!state || !params.get('state') || params.get('state') !== stateToken) return redirect('/owner.html?auth=invalid-state');
    if (!params.get('code')) return redirect('/owner.html?auth=missing-code');

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: params.get('code'),
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) return redirect('/owner.html?auth=token-failed');

    const token = await tokenResponse.json();
    const discordHeaders = { Authorization: `${token.token_type} ${token.access_token}` };
    const [userResponse, guildResponse] = await Promise.all([
      fetch('https://discord.com/api/users/@me', { headers: discordHeaders }),
      fetch('https://discord.com/api/users/@me/guilds', { headers: discordHeaders }),
    ]);
    if (!userResponse.ok || !guildResponse.ok) return redirect('/owner.html?auth=profile-failed');

    const user = await userResponse.json();
    const guilds = await guildResponse.json();
    const authorization = await getAuthorization(user.id, guilds);
    if (!authorization) return redirect('/owner.html?auth=not-approved');

    const session = encryptSession({
      userId: user.id,
      username: user.username,
      globalName: user.global_name || user.username,
      avatar: user.avatar || null,
      role: authorization.role,
      permissions: authorization.permissions,
      guildIds: authorization.guildIds || [],
    });
    return {
      statusCode: 302,
      headers: {
        Location: '/owner.html?auth=success',
      },
      multiValueHeaders: {
        'Set-Cookie': [cookie(sessionCookieName, session, 8 * 60 * 60), cookie(stateCookieName, '', 0)],
      },
      body: '',
    };
  } catch (error) {
    console.error('auth-callback error:', error);
    return redirect('/owner.html?auth=failed');
  }
};
