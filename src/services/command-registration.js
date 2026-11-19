const { REST, Routes } = require("discord.js");

function getEnabledCommandData(commands, config, linkingEnabled = false) {
  return commands
    .filter((command) => config.commands[command.data.name] === true)
    .filter((command) => command.data.name !== "account-verify" || linkingEnabled)
    .map((command) => command.data.toJSON());
}

async function registerEnabledCommands({ clientId, token, guildId, commands, config, linkingEnabled }) {
  const body = getEnabledCommandData(commands, config, linkingEnabled);
  const rest = new REST({ version: "10" }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body });
  return body.length;
}

module.exports = { getEnabledCommandData, registerEnabledCommands };
