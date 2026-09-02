// Example connector pattern for external bots to send status and events
// This file is not the production server; it is a template for any bot service
// that needs to integrate with the SNS Core webhook layer.

const crypto = require('crypto');

function signPayload(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function sendHeartbeat({ url, secret, payload }) {
  const raw = JSON.stringify(payload);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sns-signature': signPayload(raw, secret),
    },
    body: raw,
  });

  return { ok: response.ok, status: response.status, body: await response.text() };
}

async function sendEvent({ url, secret, payload }) {
  const raw = JSON.stringify(payload);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sns-signature': signPayload(raw, secret),
    },
    body: raw,
  });

  return { ok: response.ok, status: response.status, body: await response.text() };
}

module.exports = { sendHeartbeat, sendEvent };

// Example usage:
// const { sendHeartbeat } = require('./bot-connector.example');
// sendHeartbeat({
//   url: 'https://example.netlify.app/api/webhooks/bot-event',
//   secret: process.env.BOT_WEBHOOK_SECRET,
//   payload: {
//     type: 'heartbeat',
//     online: true,
//     guilds: 12,
//     uptimeSeconds: 600,
//     latencyMs: 42,
//     activeIncidents: 0,
//     incidentsHandledTotal: 7,
//     keplerStatus: 'armed'
//   }
// });
