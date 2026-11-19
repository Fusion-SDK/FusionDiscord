# Fusion Discord

The official Discord bot for the Fusion community.

## Features

- Discord.js slash-command bot with creator-panel command controls.
- Secure settings polling from the Fusion `panel-admin` Edge Function.
- Account-linking commands remain gated until the authenticated in-game confirmation UI exists.
- Opt-in security monitoring foundations: anti-raid, anti-nuke event spikes, AutoMod signals, and join-gate account-age checks.
- Monitoring is **alert-only** in this release. It does not automatically punish members, delete messages, change roles, or lock server channels.

## Creator panel

Set `FUSION_PANEL_API_URL` to the Supabase `panel-admin` Edge Function URL and `FUSION_BOT_API_SECRET` to the matching private secret on the bot host. The bot refreshes configuration every 60 seconds and keeps last-known settings if the endpoint is temporarily unavailable. Never place the bot token, service-role key, or bot secret in frontend variables.

## Security monitoring

Each monitor is configured independently for each Discord server in the Fusion Control Panel. The bot polls each server's settings and caches them briefly. The environment switches below only request the required Discord gateway intents; the per-server dashboard toggles determine where a monitor runs.

| Variable | Required Discord intent | Purpose |
| --- | --- | --- |
| `FUSION_ANTI_RAID_MONITOR=true` | Server Members Intent | Detect join spikes (default: 6 joins in 10 seconds). |
| `FUSION_JOIN_GATE_MONITOR=true` | Server Members Intent | Flag newly created accounts; default age threshold is 7 days. |
| `FUSION_ANTI_NUKE_MONITOR=true` | Guilds | Detect bursts of channel/role creation or deletion, bans, and webhook updates. |
| `FUSION_AUTOMOD_MONITOR=true` | Guild Messages + Message Content intents | Flag message bursts, repeated messages, and mention floods. |

Alerts can be sent to the configured per-server alert channel. The bot needs permission to view that channel and send messages. The monitors do not automatically punish members, delete messages, or change server permissions. Configure the corresponding privileged intents in the Discord Developer Portal before enabling the relevant feature. Grant only the permissions needed by the bot.

Anti-nuke signals are event-rate heuristics, not proof of malicious intent or actor attribution. A legitimate moderation event or server reorganization can trigger an alert. Keep a human moderator in the loop. Per-guild settings and alert-channel routing are managed in the companion Fusion-Bot-Panel repository. Audit-log actor attribution and explicit response controls remain future integration work.

## Account linking

The account-linking flow remains disabled unless `FUSION_LINKING_ENABLED=true`. Do not enable it until the authenticated in-game Link Discord screen is implemented and tested. The bot never asks for Fusion passwords or session tokens.

## Setup

- Node.js 22+
- A Discord application and bot
- `npm install`
- Configure production values in the bot host's secret manager.
- Run `npm run deploy-commands` to register enabled commands.
- Run `npm start` to start the bot.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application ID |
| `DISCORD_GUILD_ID` | No | Development server ID |
| `FUSION_API_BASE_URL` | Yes for account commands | Supabase `discord-link` Edge Function URL |
| `FUSION_PANEL_API_URL` | Yes for panel controls | Supabase `panel-admin` Edge Function URL |
| `FUSION_BOT_API_SECRET` | Yes for backend features | Shared bot-to-backend secret |
| `FUSION_LINKING_ENABLED` | No | Keep false until in-game linking UI is ready |
| `FUSION_ANTI_RAID_MONITOR` | No | Enable monitor-only join spike alerts |
| `FUSION_ANTI_NUKE_MONITOR` | No | Enable monitor-only server event spike alerts |
| `FUSION_AUTOMOD_MONITOR` | No | Enable monitor-only message pattern alerts |
| `FUSION_JOIN_GATE_MONITOR` | No | Enable monitor-only account-age alerts |

Never commit `.env`, bot tokens, Supabase service-role keys, or the shared backend secret.

## Development

Run `npm run check` for syntax validation and `npm test` for unit tests.

## License

MIT. See [LICENSE](LICENSE).


## Automatic server discovery

When the bot starts, it sends the Discord servers it is currently in to the protected `panel-admin` Edge Function. It refreshes that directory every 60 seconds and immediately after joining or leaving a server. The panel displays server names, icons, and available member counts; administrators select a server from the list rather than entering IDs.

The bot sends only server metadata needed for the creator dashboard. Server IDs remain internal identifiers. Configure `FUSION_PANEL_API_URL` and `FUSION_BOT_API_SECRET` on the bot host. Apply the matching server-directory migration and deploy the updated Edge Function in Fusion-Bot-Panel.
