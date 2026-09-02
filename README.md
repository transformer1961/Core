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
- SNS_ADMIN_KEY
- SESSION_SECRET
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_REDIRECT_URI
- SNS_OWNER_IDS (or SNS_ALLOWED_GUILD_IDS)
- MONGODB_URI
- MONGODB_DB_NAME

See .env.example for values.

## Public API

- GET /api/bot/stats
  - Returns aggregate public health data only
- POST /api/webhooks/bot-event
  - Accepts signed bot heartbeats and events
- POST /api/bot/commands
  - Queues an owner command using the private `x-sns-admin-key` header
- GET /api/bot/commands
  - Lets a bot claim its next command using `x-sns-bot-id` and an HMAC signature
- PATCH /api/bot/commands
  - Lets a bot report `running`, `completed`, or `failed` for a claimed command
- GET /api/bots
  - Lists bots registered to the signed-in owner
- POST /api/bots
  - Registers a bot and returns its secret once
- DELETE /api/bots
  - Removes a bot from the signed-in owner's registry
- GET /api/auth/discord
  - Starts Discord OAuth sign-in
- GET /api/auth/callback
  - Completes OAuth and creates the owner session
- GET /api/auth/me
  - Returns the current signed-in owner session
- GET /api/auth/logout
  - Clears the owner session

### Discord OAuth setup

Create a Discord application and add the exact `DISCORD_REDIRECT_URI` value to the application's OAuth2 redirect URLs. Add your Discord user ID to `SNS_OWNER_IDS`, or add guild IDs to `SNS_ALLOWED_GUILD_IDS` and sign in as their owner. Keep `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `SNS_ADMIN_KEY`, and `BOT_WEBHOOK_SECRET` in Netlify environment variables only.

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

### Command lifecycle

SNS Core queues commands for a specific `botId`; the bot connector claims one command at a time, executes it through the bot host supervisor, and reports the result. Commands expire after five minutes so an offline bot cannot execute an old shutdown or restart request when it returns.

The initial queue uses `SNS_ADMIN_KEY` for server-side owner integration and `BOT_WEBHOOK_SECRET` for the bot transport. Do not expose either value in browser JavaScript. Discord OAuth and per-bot credential storage should be added before production owner access.

### Bot registration

After signing in, an owner can register a bot with `POST /api/bots` using a lowercase `botId` and display `name`. SNS Core stores a SHA-256 hash of the generated secret and returns the raw secret only in the registration response. Store that secret in the bot's Railway variables; it cannot be recovered from SNS Core.

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
