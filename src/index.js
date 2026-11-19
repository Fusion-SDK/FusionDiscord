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
const { inspectMember } = require("./services/join-gate");\nconst { createGuildSecurityClient } = require("./services/guild-security");
const antiRaid = createAntiRaidMonitor();
const antiNuke = createAntiNukeMonitor();
const autoMod = createAutoModMonitor();\nconst guildSecurity = createGuildSecurityClient();\nconst antiRaidByGuild = new Map();\nconst antiNukeByGuild = new Map();\nconst autoModByGuild = new Map();\nconst securityConfigKeys = new Map();\n\nfunction monitorFor(map, guildId, config, factory, key) {\n  const fingerprint = JSON.stringify(config);\n  if (securityConfigKeys.get(key + ":" + guildId) !== fingerprint) {\n    map.set(guildId, factory());\n    securityConfigKeys.set(key + ":" + guildId, fingerprint);\n  }\n  return map.get(guildId);\n}\n\nasync function sendSecurityAlert(guildId, channelId, content) {\n  if (!channelId) return;\n  try {\n    const channel = await client.channels.fetch(channelId);\n    if (channel?.isTextBased() && typeof channel.send === "function") {\n      await channel.send({ content, allowedMentions: { parse: [] } });\n    }\n  } catch (error) {\n    console.error("[SECURITY] Could not send alert for guild " + guildId + ":", error.message);\n  }\n}
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

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const config = await guildSecurity.get(member.guild.id);
    if (antiRaidEnabled && config.antiRaid.enabled) {
      const monitor = monitorFor(antiRaidByGuild, member.guild.id, config.antiRaid,
        () => createAntiRaidMonitor({ threshold: config.antiRaid.joinThreshold, windowMs: config.antiRaid.windowSeconds * 1000 }), "raid");
      const result = monitor.recordJoin(member.guild.id);
      if (result.detected) await sendSecurityAlert(member.guild.id, config.antiRaid.alertChannelId,
        "⚠️ Anti-Raid: detected " + result.count + " joins within " + config.antiRaid.windowSeconds + " seconds. No automatic action was taken.");
    }
    if (joinGateEnabled && config.joinGate.enabled) {
      const result = inspectMember(member, {
        minAccountAgeMs: config.joinGate.minimumAccountAgeDays * 24 * 60 * 60 * 1000,
        flagBots: config.joinGate.flagBots
      });
      if (result.flagged) await sendSecurityAlert(member.guild.id, config.joinGate.alertChannelId,
        "⚠️ Join Gate: a new member matched: " + result.reasons.join(", ") + ". No automatic action was taken.");
    }
  } catch (error) {
    console.error("[SECURITY] Join checks failed for guild " + member.guild.id + ":", error.message);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!autoModEnabled || !message.guild) return;
  try {
    const config = await guildSecurity.get(message.guild.id);
    if (!config.autoMod.enabled) return;
    const monitor = monitorFor(autoModByGuild, message.guild.id, config.autoMod,
      () => createAutoModMonitor({
        messageLimit: config.autoMod.messageLimit,
        windowMs: config.autoMod.windowSeconds * 1000,
        mentionLimit: config.autoMod.mentionLimit
      }), "automod");
    const flags = monitor.inspect(message);
    if (flags.length) await sendSecurityAlert(message.guild.id, config.autoMod.alertChannelId,
      "⚠️ AutoMod: detected " + flags.join(", ") + " from a server member. No automatic action was taken.");
  } catch (error) {
    console.error("[SECURITY] AutoMod check failed for guild " + message.guild.id + ":", error.message);
  }
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
  client.on(eventName, async (target) => {
    if (!antiNukeEnabled) return;
    const guild = target.guild ?? target;
    if (!guild?.id) return;
    try {
      const config = await guildSecurity.get(guild.id);
      if (!config.antiNuke.enabled) return;
      const monitor = monitorFor(antiNukeByGuild, guild.id, config.antiNuke,
        () => createAntiNukeMonitor({ threshold: config.antiNuke.eventThreshold, windowMs: config.antiNuke.windowSeconds * 1000 }), "nuke");
      const result = monitor.record(guild.id, action);
      if (result.detected) await sendSecurityAlert(guild.id, config.antiNuke.alertChannelId,
        "⚠️ Anti-Nuke: repeated " + action + " events detected (" + result.count + " in " + config.antiNuke.windowSeconds + " seconds). Review the server audit log. No automatic action was taken.");
    } catch (error) {
      console.error("[SECURITY] Anti-Nuke check failed for guild " + guild.id + ":", error.message);
    }
  });
}

client.on(Events.GuildDelete, (guild) => {
  antiRaid.clearGuild(guild.id);
  antiNuke.clearGuild(guild.id);
  autoMod.clearGuild(guild.id);\n  guildSecurity.clear(guild.id);\n  antiRaidByGuild.delete(guild.id);\n  antiNukeByGuild.delete(guild.id);\n  autoModByGuild.delete(guild.id);\n  for (const key of securityConfigKeys.keys()) if (key.endsWith(":" + guild.id)) securityConfigKeys.delete(key);
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
