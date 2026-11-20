const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { normalizeReason } = require("../services/moderation");
const { createModerationCaseReporter } = require("../services/moderation-audit");
const audit = createModerationCaseReporter();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete up to 100 recent messages in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) => option.setName("amount").setDescription("Number of recent messages (1–100)").setMinValue(1).setMaxValue(100).setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the cleanup").setMaxLength(500)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply("You need the Manage Messages permission to use this command.");
    }
    if (!interaction.channel?.isTextBased() || typeof interaction.channel.bulkDelete !== "function") {
      return interaction.editReply("This command only works in a server text channel.");
    }
    try {
      const amount = interaction.options.getInteger("amount", true);
      const reason = normalizeReason(interaction.options.getString("reason"));
      let deletedCount = 0;
      if (amount === 1) {
        const recent = await interaction.channel.messages.fetch({ limit: 1 });
        const latest = recent.first();
        if (latest && Date.now() - latest.createdTimestamp < 14 * 24 * 60 * 60 * 1000) {
          await latest.delete();
          deletedCount = 1;
        }
      } else {
        const deleted = await interaction.channel.bulkDelete(amount, true);
        deletedCount = deleted.size;
      }
      let caseId = null;
      let auditWarning = "";
      try {
        const result = await audit.record({
          guildId: interaction.guildId,
          actorUserId: interaction.user.id,
          targetUserId: null,
          action: "purge",
          reason,
          metadata: { channelId: interaction.channelId, deletedCount }
        });
        caseId = result.caseId;
      } catch (error) { auditWarning = " Messages were removed, but the audit record could not be saved: " + error.message; }
      return interaction.editReply("Removed " + deletedCount + " recent message(s)." + (caseId ? " Case #" + caseId + "." : "") + auditWarning);
    } catch (error) {
      return interaction.editReply(error.message || "Could not purge messages.");
    }
  }
};
