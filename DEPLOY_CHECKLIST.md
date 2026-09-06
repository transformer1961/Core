# SNS Core — Deploy & Enroll Checklist

One page to get the whole system live. Work top to bottom. Everything marked
**🔑 secret** gets pasted into a host's environment, never committed to git.

> ⚠️ **Do the rotation step first** — several tokens were shared in chat during
> development and must be treated as compromised.

---

## 0. Rotate everything that was leaked (do this first)

| Secret | Where to regenerate | Where it lives after |
|---|---|---|
| Discord bot tokens (SNS Core, Tunes, Third, Watchtower) | Discord Developer Portal → Bot → Reset Token | each bot host `.env` (`DISCORD_TOKEN`, `TUNES_DISCORD_TOKEN`, …) |
| `BOT_WEBHOOK_SECRET` | generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | Netlify **and** every bot host `.env` (must match) |
| `SENTINEL_SNS_BOT_TOKEN` / other bot tokens | re-enroll the bot (step 3) or rotate in the owner panel | that bot's `.env` |
| `DASHBOARD_PASSWORD` (Watchtower) | pick a strong 16+ char password | sentinel-bot `.env` |
| `MONGODB_URI` password | MongoDB Atlas → Database Users | Netlify + SNSCore `.env` |
| `SESSION_SECRET`, `SNS_ENROLLMENT_KEY`, `SNS_ADMIN_KEY` | generate 32-byte base64url (command above) | Netlify only |

---

## 1. Core (Netlify) — environment variables

Netlify dashboard → your site → **Site configuration → Environment variables**.
These are what the functions actually read (verified against the code).

| Variable | Required | What it's for |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `MONGODB_DB_NAME` | ➖ | DB name, defaults to `sns_core` |
| `SESSION_SECRET` | ✅ 🔑 | Encrypts the login session cookie (AES-256-GCM). Long random string. |
| `DISCORD_CLIENT_ID` | ✅ | Discord OAuth app — client id |
| `DISCORD_CLIENT_SECRET` | ✅ 🔑 | Discord OAuth app — client secret |
| `DISCORD_REDIRECT_URI` | ✅ | `https://core.sentinelnetworksystems.com/api/auth/callback` — must exactly match the app's OAuth2 redirect |
| `SNS_OWNER_IDS` | ✅ | Comma-separated Discord user IDs with full owner access |
| `BOT_WEBHOOK_SECRET` | ✅ 🔑 | Shared HMAC secret for bot→Core calls. **Must be identical on every bot host.** |
| `SNS_ENROLLMENT_KEY` | ✅ 🔑 | Header key for the one-time enroll endpoint |
| `SNS_STAFF_IDS` | ➖ | Comma-separated Discord IDs that get admin (`*`) |
| `SNS_ALLOWED_GUILD_IDS` | ➖ | If set, guild *owners* of these guilds get owner access |
| `SNS_ADMIN_KEY` | ➖ 🔑 | Header key to run owner-panel commands via API/scripts |

`NODE_ENV` / `CONTEXT` are set by Netlify automatically — they switch cookies to `Secure` in production.

**Then deploy** (push to the connected branch, or `netlify deploy --prod`).

---

## 2. Discord Developer Portal — OAuth redirect

For the OAuth app used by the **website** (not the bots):
1. Applications → your app → **OAuth2 → Redirects**.
2. Add `https://core.sentinelnetworksystems.com/api/auth/callback`.
3. Copy **Client ID / Client Secret** into the Netlify vars above.

---

## 3. Enroll each bot → approve → paste token

Repeat per bot. The bot won't authenticate until it's **approved**.

1. **Register** — owner panel → *Register a bot*, or POST to `/api/bot/enroll` with header
   `x-sns-enrollment-key: $SNS_ENROLLMENT_KEY` and body `{ "botId": "...", "name": "..." }`.
   You get back a **token shown once** — copy it.
2. **Approve** — owner panel → find the bot → **Approve**. (Status goes `pending → active`.)
3. **Paste into the bot's `.env`:**

| Bot | `.env` file | Set these |
|---|---|---|
| SNS Core | `SNSCore/.env` | `SNS_CORE_BOT_ID`, `SNS_CORE_BOT_TOKEN` |
| SNS Tunes | `SNSCore/.env` | `SNS_TUNES_BOT_ID`, `SNS_TUNES_BOT_TOKEN` |
| SNS Third | `SNSCore/.env` | `SNS_THIRD_BOT_ID`, `SNS_THIRD_BOT_TOKEN` |
| SNS Watchtower | `sentinel-bot/.env` | `SENTINEL_SNS_BOT_ID`, `SENTINEL_SNS_BOT_TOKEN` |

> The `*_BOT_ID` must **exactly match** the `botId` you enrolled (lowercase, e.g. `sentinel_guard`).
> Watchtower's enrolled ID is `sentinel_guard`.

---

## 4. Bot host environment (each `.env`)

Already laid out in 3 sections. The Core-connection block needs **three** things filled per bot:
`*_BOT_ID` + `*_BOT_TOKEN` (from step 3) + the shared `BOT_WEBHOOK_SECRET`.

SNSCore also needs `SNS_CORE_COMMAND_URL` and `SNS_CORE_WEBHOOK_URL` (both already set to
`https://core.sentinelnetworksystems.com/...`). Watchtower only needs `SNS_CORE_WEBHOOK_URL`.

Anything left blank is safely skipped at startup.

---

## 5. Verify it's alive

1. Start a bot (`npm start` in `SNSCore`, `node index.js` in `sentinel-bot`).
2. Look for the Core gateway line in the console (e.g. `connected to Core as ...` / heartbeat).
3. Owner panel → **Refresh data** → the bot shows **online** under *Bot health*, and the
   *Security posture* card reads **All clear**.
4. `/status.html` shows live aggregate numbers once a heartbeat lands.

If a bot shows **pending**, you enrolled but didn't approve (step 3.2). If **offline**, the
`*_BOT_TOKEN` / `BOT_WEBHOOK_SECRET` is wrong or the bot process isn't running.
