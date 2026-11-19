require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require("discord.js");
const { DEFAULT_CONFIG, loadPanelConfig } = require("./services/panel-config");

const requiredEnv = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error("Missing required environment variables: " + missingEnv.join(", "));
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const { createAntiRaidMonitor } = require("./services/anti-raid");
const antiRaidMonitor = createAntiRaidMonitor();
const antiRaidMonitorEnabled = process.env.FUSION_ANTI_RAID_MONITOR === "true";
client.commands = new Collection();
client.fusionConfig = DEFAULT_CONFIG;

const commandsDirectory = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsDirectory).filter((name) => name.endsWith(".js"))) {
  const command = require(path.join(commandsDirectory, file));
  if (!command.data || typeof command.execute !== "function") {
    throw new Error("Invalid command module: " + file);
  }
  client.commands.set(command.data.name, command);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const commandRoute = process.env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

async function syncSlashCommands(config) {
  const enabled = [...client.commands.values()]
    .filter((command) => config.commands[command.data.name] === true)
    .map((command) => command.data.toJSON());
  await rest.put(commandRoute, { body: enabled });
  console.log("Synchronized " + enabled.length + " enabled slash command(s) from the Fusion panel.");
}

let refreshingConfig = false;
async function refreshPanelConfig() {
  if (refreshingConfig) return;
  refreshingConfig = true;
  try {
    const nextConfig = await loadPanelConfig();
    const changed = JSON.stringify(nextConfig) !== JSON.stringify(client.fusionConfig);
    client.fusionConfig = nextConfig;
    if (changed) {
      console.log("Fusion panel configuration updated.");
      await syncSlashCommands(nextConfig);
    }
  } catch (error) {
    console.error("Could not refresh Fusion panel configuration; keeping the last-known settings:", error.message);
  } finally {
    refreshingConfig = false;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log("Fusion Discord is online as " + readyClient.user.tag);
  await refreshPanelConfig();
  // Ensure Discord command registration is correct even if the panel is temporarily unavailable.
  await syncSlashCommands(client.fusionConfig);
  setInterval(refreshPanelConfig, 60_000).unref();
});

client.on(Events.GuildMemberAdd, (member) => {\n  if (!antiRaidMonitorEnabled) return;\n  const result = antiRaidMonitor.recordJoin(member.guild.id);\n  if (result.detected) {\n    console.warn(`[ANTI-RAID MONITOR] Join spike detected in guild ${member.guild.id}: ${result.count} joins within ${result.windowMs}ms. No automatic action was taken.`);\n  }\n});\n\nclient.on(Events.GuildDelete, (guild) => antiRaidMonitor.clearGuild(guild.id));\n\nclient.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (client.fusionConfig.commands[interaction.commandName] !== true) {
    return interaction.reply({
      content: "That command is currently disabled by the Fusion bot administrator.",
      ephemeral: true
    }).catch(() => {});
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error("Command /" + interaction.commandName + " failed:", error);
    const response = {
      content: "Something went wrong while running that command. Please try again later.",
      ephemeral: true
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to log in to Discord:", error);
  process.exit(1);
});
