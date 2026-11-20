const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { normalizeReason, getModerationContext } = require("../services/moderation");
const { createModerationCaseReporter } = require("../services/moderation-audit");
const audit = createModerationCaseReporter();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName("member").setDescription("Member to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the kick").setMaxLength(500)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.editReply("You need the Kick Members permission to use this command.");
    }
    try {
      const user = interaction.options.getUser("member", true);
      const reason = normalizeReason(interaction.options.getString("reason"));
      const { actor, target } = await getModerationContext(interaction.guild, interaction.user.id, user.id);
      if (!target.kickable) return interaction.editReply("Fusion cannot kick that member. Check the bot's role position and permissions.");
      await target.kick(reason);
      let caseId = null;
      let auditWarning = "";
      try {
        const result = await audit.record({ guildId: interaction.guildId, actorUserId: actor.id, targetUserId: target.id, action: "kick", reason });
        caseId = result.caseId;
      } catch (error) { auditWarning = " The kick succeeded, but the audit record could not be saved: " + error.message; }
      return interaction.editReply("Kicked <@" + target.id + ">." + (caseId ? " Case #" + caseId + "." : "") + auditWarning);
    } catch (error) {
      return interaction.editReply(error.message || "Could not kick that member.");
    }
  }
};
