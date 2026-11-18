# Fusion Discord

The official Discord bot for the Fusion community.

Fusion Discord is being developed to provide community utilities and secure linking between Discord identities and Fusion accounts.

## Current status

- [x] Discord.js client foundation
- [x] Slash-command deployment script
- [x] `/ping` health-check command
- [x] `/account-verify` verification entry point
- [ ] Secure Discord-to-Fusion account linking backend
- [ ] Fusion in-game code confirmation
- [ ] Verified-role synchronization
- [ ] Account status and unlink commands

**Important:** Account verification is not active yet. The current `/account-verify` command is informational only; it does not verify accounts or grant roles.

## Requirements

- Node.js 22 or newer
- A Discord application and bot created in the Discord Developer Portal
- A bot token and application/client ID

## Setup

1. Clone this repository.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`.
5. Invite the bot with the `bot` and `applications.commands` scopes.
6. Register commands: `npm run deploy-commands`.
7. Start the bot: `npm start`.

Set `DISCORD_GUILD_ID` to register commands only in a development server. Leave it blank to register globally.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot authentication token |
| `DISCORD_CLIENT_ID` | Yes | Discord application ID |
| `DISCORD_GUILD_ID` | No | Optional development server ID |

Never commit your real `.env` file, bot token, Supabase service-role key, or other credentials. Use your hosting provider's secret manager for production credentials.

## Account verification design

1. A user starts with `/account-verify`.
2. The bot identifies the member using their immutable Discord user ID, not their editable username.
3. A trusted backend creates a short-lived, single-use linking challenge.
4. The user signs in to Fusion and confirms the challenge through an authenticated Fusion interface.
5. The backend atomically links the Discord ID to the authenticated Fusion account.
6. The bot grants the configured verified role only after the backend confirms the link.

The bot must never ask users to send their Fusion password or session token in Discord. Pending codes should be random, short-lived, single-use, rate-limited, and stored as hashes. The Discord bot must not contain a Supabase service-role key.

The current Fusion client does not yet provide the in-game account-link confirmation interface, so the full flow cannot be activated until that client and its trusted backend endpoint exist.

## Development

Run syntax checks with `npm run check`.

## License

MIT. See [LICENSE](LICENSE).
