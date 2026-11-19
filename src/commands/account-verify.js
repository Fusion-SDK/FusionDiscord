const { SlashCommandBuilder } = require("discord.js");
const api = require("../services/fusion-api");
const { syncVerifiedRole } = require("../services/verified-role");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("account-verify")
    .setDescription("Start linking your Discord account to your Fusion account."),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (process.env.FUSION_LINKING_ENABLED !== "true") {
      return interaction.editReply(
        "Fusion account linking is not enabled yet. The authenticated in-game Link Discord screen is still in development, so verification cannot be completed yet."
      );
    }
    const status = await api.getStatus(interaction.user.id);
    if (status.linked) {
      await syncVerifiedRole(interaction, true, interaction.client.fusionConfig?.verification);
      return interaction.editReply("Your Discord account is already linked to Fusion.");
    }
    const challenge = await api.createChallenge(interaction.user.id);
    const expires = challenge.expires_at ? new Date(challenge.expires_at) : null;
    const expiryText = expires && !Number.isNaN(expires.valueOf())
      ? "This code expires at " + expires.toISOString() + " (UTC)."
      : "This code expires soon; request another if it expires.";
    return interaction.editReply([
      "**Link your Fusion account**",
      "1. Open Geometry Dash and sign in to your Fusion account.",
      "2. Open Fusion account settings and choose **Link Discord**.",
      "3. Enter this one-time code:",
      "",
      "**" + challenge.code + "**",
      "",
      expiryText,
      "Only enter this code inside the official Fusion client. Never share your password or session token.",
      "After the in-game confirmation, run /account-status to synchronize your verified role."
    ].join("\n"));
  }
};
