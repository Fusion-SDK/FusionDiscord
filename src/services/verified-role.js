async function syncVerifiedRole(interaction, linked) {
  const roleId = process.env.FUSION_VERIFIED_ROLE_ID;
  if (!roleId || !interaction.inGuild()) return { updated: false, reason: "not_configured" };
  const member = interaction.member;
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role || !member?.roles) return { updated: false, reason: "role_unavailable" };
  if (linked && !member.roles.cache.has(roleId)) {
    await member.roles.add(roleId, "Fusion account link confirmed by the Fusion verification backend.");
  } else if (!linked && member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId, "Fusion account link removed through Fusion verification.");
  }
  return { updated: true };
}
module.exports = { syncVerifiedRole };
