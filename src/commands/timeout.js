const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { parseDuration, normalizeReason, getModerationContext } = require("../services/moderation");
const { createModerationCaseReporter } = require("../services/moderation-audit");
const audit = createModerationCaseReporter();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily timeout a server member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("Member to timeout").setRequired(true))
    .addStringOption((option) => option.setName("duration").setDescription("For example: 15m, 2h, or 1d").setRequired(true).setMaxLength(20))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the timeout").setMaxLength(500)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.editReply("You need the Moderate Members permission to use this command.");
    }
    try {
      const user = interaction.options.getUser("member", true);
      const durationMs = parseDuration(interaction.options.getString("duration", true));
      const reason = normalizeReason(interaction.options.getString("reason"));
      const { actor, target } = await getModerationContext(interaction.guild, interaction.user.id, user.id);
      if (!target.moderatable) return interaction.editReply("Fusion cannot timeout that member. Check the bot's role position and permissions.");
      await target.timeout(durationMs, reason);
      let caseId = null;
      let auditWarning = "";
      try {
        const result = await audit.record({ guildId: interaction.guildId, actorUserId: actor.id, targetUserId: target.id, action: "timeout", reason, durationSeconds: Math.ceil(durationMs / 1000) });
        caseId = result.caseId;
      } catch (error) { auditWarning = " The timeout succeeded, but the audit record could not be saved: " + error.message; }
      return interaction.editReply("Timed out <@" + target.id + "> for " + interaction.options.getString("duration", true) + "." + (caseId ? " Case #" + caseId + "." : "") + auditWarning);
    } catch (error) {
      return interaction.editReply(error.message || "Could not timeout that member.");
    }
  }
};
