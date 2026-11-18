const { SlashCommandBuilder } = require("discord.js");
const api = require("../services/fusion-api");
const { syncVerifiedRole } = require("../services/verified-role");

module.exports = {
  data: new SlashCommandBuilder().setName("account-unlink").setDescription("Unlink your Discord account from Fusion."),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await api.unlink(interaction.user.id);
    await syncVerifiedRole(interaction, false);
    return interaction.editReply("Your Discord account has been unlinked from Fusion. You can link it again at any time.");
  }
};
