require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const { loadPanelConfig, isCommandEnabled } = require("../src/services/panel-config");

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set.");
  process.exit(1);
}

const commandsDirectory = path.join(__dirname, "..", "src", "commands");
const commandModules = fs.readdirSync(commandsDirectory)
  .filter((file) => file.endsWith(".js"))
  .map((file) => require(path.join(commandsDirectory, file)));
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function main() {
  if (!process.env.FUSION_PANEL_API_URL) {
    throw new Error("Set FUSION_PANEL_API_URL so command registration follows the creator panel settings.");
  }
  const config = await loadPanelConfig();
  const commands = commandModules
    .filter((command) => isCommandEnabled(config, command.data.name))
    .map((command) => command.data.toJSON());
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log("Registered " + commands.length + " enabled slash command(s) from the Fusion panel.");
}

main().catch((error) => {
  console.error("Failed to register slash commands:", error);
  process.exit(1);
});
