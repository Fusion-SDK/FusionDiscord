const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { normalizeReason, getModerationContext } = require("../services/moderation");
const { createModerationCaseReporter } = require("../services/moderation-audit");
const audit = createModerationCaseReporter();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Record a warning for a server member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("member").setDescription("Member to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the warning").setMaxLength(500)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.editReply("You need the Moderate Members permission to use this command.");
    }
    try {
      const user = interaction.options.getUser("member", true);
      const reason = normalizeReason(interaction.options.getString("reason"));
      const { actor, target } = await getModerationContext(interaction.guild, interaction.user.id, user.id);
      let caseId = null;
      let auditWarning = "";
      try {
        const result = await audit.record({ guildId: interaction.guildId, actorUserId: actor.id, targetUserId: target.id, action: "warn", reason });
        caseId = result.caseId;
      } catch (error) { auditWarning = " The warning was issued, but the audit record could not be saved: " + error.message; }
      return interaction.editReply("Warning recorded for <@" + target.id + ">." + (caseId ? " Case #" + caseId + "." : "") + auditWarning);
    } catch (error) {
      return interaction.editReply(error.message || "Could not record that warning.");
    }
  }
};
