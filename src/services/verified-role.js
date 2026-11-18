async function syncVerifiedRole(interaction, linked) {
  const roleId = process.env.FUSION_VERIFIED_ROLE_ID;
  if (!roleId || !interaction.inGuild()) return { updated: false, reason: "not_configured" };

  const [member, role] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.roles.fetch(roleId)
  ]);
  if (!role) return { updated: false, reason: "role_unavailable" };

  if (linked && !member.roles.cache.has(roleId)) {
    await member.roles.add(role, "Fusion account link confirmed by the Fusion verification backend.");
  } else if (!linked && member.roles.cache.has(roleId)) {
    await member.roles.remove(role, "Fusion account link removed through Fusion verification.");
  }
  return { updated: true };
}
module.exports = { syncVerifiedRole };
