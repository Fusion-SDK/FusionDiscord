const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether Fusion Discord is responding."),
  async execute(interaction) {
    await interaction.reply({
      content: "Pong! Gateway latency: " + interaction.client.ws.ping + " ms.",
      ephemeral: true
    });
  }
};
