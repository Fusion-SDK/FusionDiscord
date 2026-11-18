# Fusion Discord

The official Discord bot for the Fusion community.

## Features

- Discord.js bot with slash commands.
- `/ping` health check.
- `/account-verify` requests a short-lived one-time code from the trusted Fusion backend.
- `/account-status` checks the backend link and synchronizes the configured verified role.
- `/account-unlink` removes the caller's Discord link and synchronizes role removal.

## Account-linking flow

1. A user runs `/account-verify` in the Fusion Discord server.
2. The bot sends the immutable Discord user ID to the trusted backend and displays a short-lived code ephemerally.
3. The user signs in to Fusion in Geometry Dash and enters the code in the official in-game account settings.
4. The authenticated Fusion client sends the code to the backend. The backend binds the authenticated Fusion user ID to the Discord ID associated with the code.
5. The user runs `/account-status`; the bot asks the backend for the authoritative link state and assigns the configured verified role.
6. `/account-unlink` lets the same Discord identity remove its link.

The code is single-use, expires after a short period, is stored only as a hash, and is rate-limited by the backend. Discord usernames are not used as identity proof. The bot never asks for Fusion passwords or session tokens.

**Activation requirements:** deploy the Supabase migration and Edge Function in the Fusion backend, configure the function secrets, configure the bot environment variables, invite the bot with Manage Roles, and place the verified role below the bot's highest role. The Geometry Dash client still needs an authenticated in-game Link Discord screen; that UI is not yet implemented in the current client.

## Setup

- Node.js 22+
- A Discord application and bot
- `npm install`
- Copy `.env.example` to `.env` and configure the Discord credentials.
- Run `npm run deploy-commands` to register slash commands.
- Run `npm start` to start the bot.

Set `DISCORD_GUILD_ID` for fast guild-only command registration during development. Leave it blank for global registration.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application ID |
| `DISCORD_GUILD_ID` | No | Development server ID |
| `FUSION_API_BASE_URL` | Yes for account commands | Supabase Edge Function URL |
| `FUSION_BOT_API_SECRET` | Yes for account commands | Shared bot-to-backend secret |
| `FUSION_VERIFIED_ROLE_ID` | No | Role ID assigned after backend confirmation |

Never commit `.env`, bot tokens, Supabase service-role keys, or the shared backend secret. Store production credentials in the host's secret manager.

## Development

Run `npm run check` for JavaScript syntax validation and `npm test` for mocked account-linking service and role-sync tests.

## License

MIT. See [LICENSE](LICENSE).
