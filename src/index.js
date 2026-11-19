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

const antiRaidEnabled = process.env.FUSION_ANTI_RAID_MONITOR === "true";
const antiNukeEnabled = process.env.FUSION_ANTI_NUKE_MONITOR === "true";
const autoModEnabled = process.env.FUSION_AUTOMOD_MONITOR === "true";
const joinGateEnabled = process.env.FUSION_JOIN_GATE_MONITOR === "true";
const intents = [GatewayIntentBits.Guilds];
if (antiRaidEnabled || joinGateEnabled) intents.push(GatewayIntentBits.GuildMembers);
if (autoModEnabled) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);

const client = new Client({ intents });
const { createAntiRaidMonitor } = require("./services/anti-raid");
const { createAntiNukeMonitor } = require("./services/anti-nuke");
const { createAutoModMonitor } = require("./services/auto-mod");
const { inspectMember } = require("./services/join-gate");
const antiRaid = createAntiRaidMonitor();
const antiNuke = createAntiNukeMonitor();
const autoMod = createAutoModMonitor();
client.commands = new Collection();
client.fusionConfig = DEFAULT_CONFIG;

const commandsDirectory = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsDirectory).filter((name) => name.endsWith(".js"))) {
  const command = require(path.join(commandsDirectory, file));
  if (!command.data || typeof command.execute !== "function") throw new Error("Invalid command module: " + file);
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
  await syncSlashCommands(client.fusionConfig);
  setInterval(refreshPanelConfig, 60_000).unref();
});

client.on(Events.GuildMemberAdd, (member) => {
  if (antiRaidEnabled) {
    const result = antiRaid.recordJoin(member.guild.id);
    if (result.detected) console.warn("[ANTI-RAID] Join spike in guild " + member.guild.id + ": " + result.count + " joins/" + result.windowMs + "ms.");
  }
  if (joinGateEnabled) {
    const result = inspectMember(member);
    if (result.flagged) console.warn("[JOIN-GATE] New member flagged in guild " + member.guild.id + ": " + result.reasons.join(", ") + ".");
  }
});

client.on(Events.MessageCreate, (message) => {
  if (!autoModEnabled || !message.guild) return;
  const flags = autoMod.inspect(message);
  if (flags.length) console.warn("[AUTOMOD] Message flagged in guild " + message.guild.id + " by user " + message.author.id + ": " + flags.join(", ") + ".");
});

const antiNukeEvents = [
  [Events.ChannelCreate, "channelCreate"],
  [Events.ChannelDelete, "channelDelete"],
  [Events.GuildRoleCreate, "roleCreate"],
  [Events.GuildRoleDelete, "roleDelete"],
  [Events.GuildBanAdd, "memberBan"],
  [Events.WebhooksUpdate, "webhookUpdate"]
];
for (const [eventName, action] of antiNukeEvents) {
  client.on(eventName, (target) => {
    if (!antiNukeEnabled) return;
    const guild = target.guild ?? target;
    if (!guild?.id) return;
    const result = antiNuke.record(guild.id, action);
    if (result.detected) console.warn("[ANTI-NUKE] Repeated " + action + " events in guild " + guild.id + ": " + result.count + "/" + result.windowMs + "ms. Monitor-only; no automatic action taken.");
  });
}

client.on(Events.GuildDelete, (guild) => {
  antiRaid.clearGuild(guild.id);
  antiNuke.clearGuild(guild.id);
  autoMod.clearGuild(guild.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  if (client.fusionConfig.commands[interaction.commandName] !== true) {
    return interaction.reply({ content: "That command is currently disabled by the Fusion bot administrator.", ephemeral: true }).catch(() => {});
  }
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error("Command /" + interaction.commandName + " failed:", error);
    const response = { content: "Something went wrong while running that command. Please try again later.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to log in to Discord:", error);
  process.exit(1);
});
