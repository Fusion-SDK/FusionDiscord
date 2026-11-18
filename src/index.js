require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");

const requiredEnv = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error("Missing required environment variables: " + missingEnv.join(", "));
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDirectory = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsDirectory).filter((name) => name.endsWith(".js"))) {
  const command = require(path.join(commandsDirectory, file));
  if (!command.data || typeof command.execute !== "function") {
    throw new Error("Invalid command module: " + file);
  }
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log("Fusion Discord is online as " + readyClient.user.tag);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

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
