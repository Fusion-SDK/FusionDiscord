const DEFAULT_JOIN_THRESHOLD = 6;
const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_ALERT_COOLDOWN_MS = 30_000;

function createAntiRaidMonitor(options = {}) {
  const threshold = Number.isInteger(options.threshold) && options.threshold >= 2
    ? options.threshold
    : DEFAULT_JOIN_THRESHOLD;
  const windowMs = Number.isInteger(options.windowMs) && options.windowMs >= 1000
    ? options.windowMs
    : DEFAULT_WINDOW_MS;
  const alertCooldownMs = Number.isInteger(options.alertCooldownMs) && options.alertCooldownMs >= 0
    ? options.alertCooldownMs
    : DEFAULT_ALERT_COOLDOWN_MS;
  const joinsByGuild = new Map();
  const lastAlertByGuild = new Map();

  function recordJoin(guildId, timestamp = Date.now()) {
    if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) {
      throw new TypeError("A valid Discord guild ID is required.");
    }
    if (!Number.isFinite(timestamp)) throw new TypeError("Join timestamp must be finite.");

    const cutoff = timestamp - windowMs;
    const recent = (joinsByGuild.get(guildId) ?? []).filter((joinedAt) => joinedAt > cutoff);
    recent.push(timestamp);
    joinsByGuild.set(guildId, recent);

    if (recent.length < threshold) {
      return { detected: false, count: recent.length, threshold, windowMs };
    }

    const lastAlert = lastAlertByGuild.get(guildId) ?? Number.NEGATIVE_INFINITY;
    if (timestamp - lastAlert < alertCooldownMs) {
      return { detected: false, suppressed: true, count: recent.length, threshold, windowMs };
    }

    lastAlertByGuild.set(guildId, timestamp);
    return { detected: true, count: recent.length, threshold, windowMs };
  }

  function clearGuild(guildId) {
    joinsByGuild.delete(guildId);
    lastAlertByGuild.delete(guildId);
  }

  return { recordJoin, clearGuild };
}

module.exports = {
  createAntiRaidMonitor,
  DEFAULT_JOIN_THRESHOLD,
  DEFAULT_WINDOW_MS,
  DEFAULT_ALERT_COOLDOWN_MS
};
