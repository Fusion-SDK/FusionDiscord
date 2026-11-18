const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("account-verify")
    .setDescription("Start linking your Discord account to your Fusion account."),
  async execute(interaction) {
    // Verification is not simulated. The secure backend and Fusion in-game
    // confirmation flow must exist before this command can verify anyone.
    await interaction.reply({
      content: [
        "**Fusion account verification**",
        "Account linking is not available yet. The verification service is still being built.",
        "You do not need to share your Fusion password or login codes in Discord."
      ].join("\n"),
      ephemeral: true
    });
  }
};
