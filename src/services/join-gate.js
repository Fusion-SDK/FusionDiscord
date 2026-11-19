const DEFAULT_MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function inspectMember(member, options = {}, now = Date.now()) {
  if (!member?.user?.createdTimestamp || !Number.isFinite(now)) return { flagged: false, reasons: [] };
  const minAgeMs = Number.isInteger(options.minAccountAgeMs) && options.minAccountAgeMs >= 0
    ? options.minAccountAgeMs
    : DEFAULT_MIN_ACCOUNT_AGE_MS;
  const reasons = [];
  if (member.user.bot && options.flagBots === true) reasons.push("bot_account");
  if (now - member.user.createdTimestamp < minAgeMs) reasons.push("new_account");
  return { flagged: reasons.length > 0, reasons, accountAgeMs: Math.max(0, now - member.user.createdTimestamp) };
}

module.exports = { inspectMember, DEFAULT_MIN_ACCOUNT_AGE_MS };
