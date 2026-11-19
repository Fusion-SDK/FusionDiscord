const { SlashCommandBuilder } = require("discord.js");
const api = require("../services/fusion-api");
const { syncVerifiedRole } = require("../services/verified-role");

module.exports = {
  data: new SlashCommandBuilder().setName("account-status").setDescription("Check your Fusion account-link status."),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const result = await api.getStatus(interaction.user.id);
    await syncVerifiedRole(interaction, Boolean(result.linked), interaction.client.fusionConfig?.verification);
    if (!result.linked) return interaction.editReply("Your Discord account is not linked to a Fusion account. Run /account-verify to begin.");
    return interaction.editReply("Your Discord account is linked to Fusion. Your verified role has been synchronized when configured.");
  }
};
