# Fusion Discord

The official Discord bot for the Fusion community.

## Features

- Discord.js slash-command bot with creator-panel command controls.
- Moderator-initiated `/warn`, `/timeout`, `/kick`, `/ban`, and `/purge` commands with permission and role-hierarchy checks.
- Persistent moderation case history in the Fusion Control Panel, including moderator, target, reason, action, and timestamp.
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

Alerts can be sent to the configured per-server alert channel. The bot needs permission to view that channel and send messages. The monitors do not automatically punish members, delete messages, or change server permissions. Manual moderation commands are separate and require the matching Discord permission; they are never triggered by monitor alerts. Configure the corresponding privileged intents in the Discord Developer Portal before enabling the relevant feature. Grant only the permissions needed by the bot.

Anti-nuke signals are event-rate heuristics, not proof of malicious intent or actor attribution. A legitimate moderation event or server reorganization can trigger an alert. Keep a human moderator in the loop. Per-guild settings and alert-channel routing are managed in the companion Fusion-Bot-Panel repository. Automatic moderation and emergency lockdown remain disabled. Manual moderator actions are recorded as case entries through the protected panel API. The monitor-only alerts do not infer or claim an actor.

## Account linking

The account-linking flow is hard-disabled in the bot and panel. `/account-verify`, `/account-status`, and `/account-unlink` cannot be enabled through configuration. Do not change this release gate until the authenticated in-game Link Discord flow is implemented and tested. The bot never asks for Fusion passwords or session tokens.

## Setup

- Node.js 22+
- A Discord application and bot
- `npm install`
- Configure production values in the bot host's secret manager.
- Run `npm run deploy-commands` to register enabled commands.
- Run `npm start` to start the bot. Apply the panel migrations through `0007_fusion_moderation_cases.sql` and deploy the matching `panel-admin` Edge Function before using moderation case logging.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application ID |
| `DISCORD_GUILD_ID` | No | Development server ID |
| `FUSION_API_BASE_URL` | Yes for account commands | Supabase `discord-link` Edge Function URL |
| `FUSION_PANEL_API_URL` | Yes for panel controls | Supabase `panel-admin` Edge Function URL |
| `FUSION_BOT_API_SECRET` | Yes for backend features | Shared bot-to-backend secret |
| `FUSION_LINKING_ENABLED` | Not used | Account linking is hard-disabled in code until the authenticated in-game flow is released |
| `FUSION_ANTI_RAID_MONITOR` | No | Enable monitor-only join spike alerts |
| `FUSION_ANTI_NUKE_MONITOR` | No | Enable monitor-only server event spike alerts |
| `FUSION_AUTOMOD_MONITOR` | No | Enable monitor-only message pattern alerts |
| `FUSION_JOIN_GATE_MONITOR` | No | Enable monitor-only account-age alerts |

Never commit `.env`, bot tokens, Supabase service-role keys, or the shared backend secret.

## Manual moderation

| Command | Required Discord permission | Behavior |
| --- | --- | --- |
| `/warn` | Moderate Members | Records an internal warning case. |
| `/timeout` | Moderate Members | Applies a moderator-selected timeout from 1 second up to 28 days. |
| `/kick` | Kick Members | Removes the selected member. |
| `/ban` | Ban Members | Bans the selected member. |
| `/purge` | Manage Messages | Deletes 1–100 recent messages in the current text channel; messages older than Discord’s bulk-delete window are skipped. |

The bot checks role hierarchy and prevents moderators from targeting themselves, the server owner, or members with equal/higher roles. Fusion must also have the relevant bot permissions and a role above the target. Successful actions are written to the panel case history. If case logging fails after an action, the command reports that partial failure. Automatic punishments are not connected to the monitoring engines.

## Development

Run `npm run check` for syntax validation and `npm test` for unit tests.

## License

MIT. See [LICENSE](LICENSE).


## Automatic server discovery

When the bot starts, it sends the Discord servers it is currently in to the protected `panel-admin` Edge Function. It refreshes that directory every 60 seconds and immediately after joining or leaving a server. The panel displays server names, icons, and available member counts; administrators select a server from the list rather than entering IDs.

The bot sends only server metadata needed for the creator dashboard. Server IDs remain internal identifiers. Configure `FUSION_PANEL_API_URL` and `FUSION_BOT_API_SECRET` on the bot host. Apply the matching server-directory migration and deploy the updated Edge Function in Fusion-Bot-Panel.


## Shared server resource synchronization

The bot publishes each connected server's role and channel metadata to the protected Fusion panel API, alongside the existing server directory. Synchronization runs at startup, every 60 seconds, and after role or channel create/update/delete events (debounced to avoid event bursts).

The snapshot includes role names, colors, positions, permission bitfields, and managed/mentionable/hoist flags. Channel snapshots include names, channel types, category relationships, positions, topics, and age-restricted flags. It does not synchronize message contents or member lists. The panel uses the existing `FUSION_PANEL_API_URL` and `FUSION_BOT_API_SECRET` settings.

Apply the matching `0004_fusion_bot_guild_resources.sql` migration and redeploy the panel's `panel-admin` Edge Function before enabling this integration. The panel currently displays these snapshots read-only; Discord resource changes remain in Discord itself until a separately permission-checked and audited action API is released.
