const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { normalizeReason, getModerationContext } = require("../services/moderation");
const { createModerationCaseReporter } = require("../services/moderation-audit");
const audit = createModerationCaseReporter();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName("member").setDescription("Member to ban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the ban").setMaxLength(500)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply("You need the Ban Members permission to use this command.");
    }
    try {
      const user = interaction.options.getUser("member", true);
      const reason = normalizeReason(interaction.options.getString("reason"));
      const { actor, target } = await getModerationContext(interaction.guild, interaction.user.id, user.id);
      if (!target.bannable) return interaction.editReply("Fusion cannot ban that member. Check the bot's role position and permissions.");
      await target.ban({ reason });
      let caseId = null;
      let auditWarning = "";
      try {
        const result = await audit.record({ guildId: interaction.guildId, actorUserId: actor.id, targetUserId: target.id, action: "ban", reason });
        caseId = result.caseId;
      } catch (error) { auditWarning = " The ban succeeded, but the audit record could not be saved: " + error.message; }
      return interaction.editReply("Banned <@" + target.id + ">." + (caseId ? " Case #" + caseId + "." : "") + auditWarning);
    } catch (error) {
      return interaction.editReply(error.message || "Could not ban that member.");
    }
  }
};
