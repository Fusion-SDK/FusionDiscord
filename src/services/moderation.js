const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
const DURATION_UNITS = Object.freeze({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 });

function parseDuration(input) {
  const value = String(input ?? "").trim().toLowerCase();
  const matches = [...value.matchAll(/(\d+)(s|m|h|d)/g)];
  if (!matches.length || matches.map((match) => match[0]).join("") !== value) {
    throw new Error("Use a duration such as 30m, 2h, 1d, or 1h30m.");
  }
  const duration = matches.reduce((total, match) => total + Number(match[1]) * DURATION_UNITS[match[2]], 0);
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > MAX_TIMEOUT_MS) {
    throw new Error("Timeout duration must be between 1 second and 28 days.");
  }
  return duration;
}

function normalizeReason(input) {
  const reason = typeof input === "string" && input.trim() ? input.trim() : "No reason provided.";
  if (reason.length > 500) throw new Error("Reason must be 500 characters or fewer.");
  return reason;
}

function canModerateTarget(actor, target, guildOwnerId) {
  if (!actor?.id || !target?.id || actor.id === target.id || target.id === guildOwnerId) return false;
  if (actor.id === guildOwnerId) return true;
  const actorRole = actor.roles?.highest;
  const targetRole = target.roles?.highest;
  if (!actorRole || !targetRole || typeof targetRole.comparePositionTo !== "function") return false;
  return targetRole.comparePositionTo(actorRole) < 0;
}

async function getModerationContext(guild, actorId, targetUserId) {
  const [actor, target] = await Promise.all([
    guild.members.fetch(actorId),
    guild.members.fetch(targetUserId)
  ]);
  if (!canModerateTarget(actor, target, guild.ownerId)) {
    throw new Error("You cannot moderate yourself, the server owner, or a member with an equal or higher role.");
  }
  return { actor, target };
}

module.exports = { MAX_TIMEOUT_MS, parseDuration, normalizeReason, canModerateTarget, getModerationContext };
