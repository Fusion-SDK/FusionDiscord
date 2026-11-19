# Fusion Discord

The official Discord bot for the Fusion community.

## Features

- Discord.js bot with slash commands.
- Creator-panel command controls: enabled commands are registered with Discord and checked again when invoked.
- Bot settings are fetched securely from the Fusion `panel-admin` Edge Function every 60 seconds.
- `/ping` health check.
- Optional anti-raid join-spike monitor (monitor-only; no automatic punishments).
- Account-linking commands remain gated until the authenticated in-game confirmation UI exists.

## Creator panel integration

Configure these environment variables on the machine or hosting service that runs the bot:

- `FUSION_PANEL_API_URL`: the Supabase Edge Function URL ending in `/functions/v1/panel-admin`.
- `FUSION_BOT_API_SECRET`: the same private secret configured for the `panel-admin` Edge Function.

The bot calls the function's `bot_get_config` action. The secret is sent only from the bot server; it is never placed in the dashboard frontend. The bot refreshes settings every 60 seconds, keeps its last-known settings if the panel is temporarily unavailable, and updates Discord's registered slash commands when settings change. It also checks the setting at execution time, so a disabled command cannot run during Discord's command-cache delay.

Run `npm run deploy-commands` to perform an immediate command-registration sync from the panel. This requires the panel URL and bot secret to be configured.

The dashboard's verification toggle and role ID are stored in the panel. The bot uses the configured role ID for account role synchronization. The account-linking flow itself remains disabled unless `FUSION_LINKING_ENABLED=true`; do not enable it until the authenticated in-game Link Discord screen is implemented and tested.

## Account-linking flow

1. A user runs `/account-verify` in the Fusion Discord server.
2. The bot sends the immutable Discord user ID to the trusted backend and displays a short-lived code ephemerally.
3. The user signs in to Fusion in Geometry Dash and enters the code in the official in-game account settings.
4. The authenticated Fusion client sends the code to the backend. The backend binds the authenticated Fusion user ID to the Discord ID associated with the code.
5. The user runs `/account-status`; the bot asks the backend for the authoritative link state and assigns the configured verified role.
6. `/account-unlink` lets the same Discord identity remove its link.

The code is single-use, expires after a short period, is stored only as a hash, and is rate-limited by the backend. Discord usernames are not used as identity proof. The bot never asks for Fusion passwords or session tokens.

## Setup

- Node.js 22+
- A Discord application and bot
- `npm install`
- Copy `.env.example` to `.env` and add local development values.
- Configure production values in the bot host's secret manager.
- Run `npm run deploy-commands` to register enabled slash commands.
- Run `npm start` to start the bot.

Set `DISCORD_GUILD_ID` for fast guild-only command registration during development. Leave it blank for global registration.

## Anti-raid monitoring (foundation)

The first anti-raid milestone is a monitor-only join-spike detector. It tracks joins independently per Discord server, uses a sliding time window, and rate-limits repeat alerts. It does not kick, ban, timeout, or change server permissions.

To enable the monitor, set `FUSION_ANTI_RAID_MONITOR=true` on the bot host and enable the **Server Members Intent** in the Discord Developer Portal for the bot application. This privileged intent is required to receive member-join events. The initial threshold is 6 joins in 10 seconds; per-server dashboard controls and alert-channel routing are the next integration step.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application ID |
| `DISCORD_GUILD_ID` | No | Development server ID |
| `FUSION_API_BASE_URL` | Yes for account commands | Supabase `discord-link` Edge Function URL |
| `FUSION_PANEL_API_URL` | Yes for panel controls | Supabase `panel-admin` Edge Function URL |
| `FUSION_BOT_API_SECRET` | Yes for account commands and panel controls | Shared bot-to-backend secret |
| `FUSION_LINKING_ENABLED` | No | Must remain false until the in-game linking UI is ready |
| `FUSION_ANTI_RAID_MONITOR` | No | Set to `true` to enable monitor-only join-spike alerts in bot logs |
| `FUSION_VERIFIED_ROLE_ID` | No | Legacy fallback role ID; panel role setting takes precedence |

Never commit `.env`, bot tokens, Supabase service-role keys, or the shared backend secret.

## Development

Run `npm run check` for JavaScript syntax validation and `npm test` for unit tests. Keep `FUSION_LINKING_ENABLED=false` until the in-game confirmation UI is deployed.

## License

MIT. See [LICENSE](LICENSE).
