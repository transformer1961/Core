# SNS Core

SNS Core is a bot-operations and monitoring platform for Discord bots and guild owners. It combines a public status site with a restricted owner dashboard and a secure webhook ingestion layer for bot telemetry.

## What it does

- Receives signed heartbeat and event updates from bot processes
- Stores aggregate bot health in MongoDB
- Exposes public stats for homepage and status pages
- Provides a restricted owner/admin panel for guild and bot owners
- Lets future bots and services integrate through a shared webhook contract

## Project structure

- public/ — static marketing and dashboard pages
- netlify/functions/ — serverless API functions
- netlify/functions/utils/db.js — MongoDB connection helper
- netlify.toml — Netlify config and API redirects

## Required environment variables

Create a local .env file or set these variables in Netlify:

- BOT_WEBHOOK_SECRET
- MONGODB_URI
- MONGODB_DB_NAME

See .env.example for values.

## Public API

- GET /api/bot/stats
  - Returns aggregate public health data only
- POST /api/webhooks/bot-event
  - Accepts signed bot heartbeats and events

## Bot integration contract

Each connected bot should send a signed POST payload with an x-sns-signature header. The signature is computed over the raw request body using BOT_WEBHOOK_SECRET.

### Heartbeat example

{
  "type": "heartbeat",
  "online": true,
  "guilds": 12,
  "uptimeSeconds": 48213,
  "latencyMs": 42,
  "activeIncidents": 0,
  "incidentsHandledTotal": 137,
  "keplerStatus": "armed"
}

### Event example

{
  "type": "event",
  "guildId": "1234567890",
  "event": "kepler_triggered",
  "message": "Kepler Protocol activated for your server.",
  "sentBy": "system"
}

## Local development

1. Install dependencies
   npm install
2. Start Netlify dev server
   npm run dev
3. Open the site on the localhost port exposed by Netlify

## Next steps for expansion

- Add authentication for owner/admin access
- Add per-guild dashboards and role-based controls
- Add bot registration and API key management
- Add modular connectors for other bot ecosystems
- Add alert delivery channels like Discord DMs, email, and webhooks
- Add audit logs and admin actions history

## Notes

This project is structured to be a shared ops platform for multiple bots, not a single-bot-only app. The webhook and status layer is intentionally generic so it can be connected to additional bot services over time.
