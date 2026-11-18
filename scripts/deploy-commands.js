require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set.");
  process.exit(1);
}

const commandsDirectory = path.join(__dirname, "..", "src", "commands");
const commands = fs.readdirSync(commandsDirectory)
  .filter((file) => file.endsWith(".js"))
  .map((file) => require(path.join(commandsDirectory, file)).data.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function main() {
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log("Registered " + commands.length + " slash command(s).");
}

main().catch((error) => {
  console.error("Failed to register slash commands:", error);
  process.exit(1);
});
