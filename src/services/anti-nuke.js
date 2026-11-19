const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_THRESHOLD = 4;
const ACTIONS = new Set(["channelCreate", "channelDelete", "roleCreate", "roleDelete", "memberBan", "webhookUpdate"]);

function createAntiNukeMonitor(options = {}) {
  const windowMs = Number.isInteger(options.windowMs) && options.windowMs >= 1000 ? options.windowMs : DEFAULT_WINDOW_MS;
  const threshold = Number.isInteger(options.threshold) && options.threshold >= 2 ? options.threshold : DEFAULT_THRESHOLD;
  const eventsByGuild = new Map();

  function record(guildId, action, timestamp = Date.now()) {
    if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) throw new TypeError("A valid Discord guild ID is required.");
    if (!ACTIONS.has(action)) throw new TypeError("Unsupported security audit action.");
    if (!Number.isFinite(timestamp)) throw new TypeError("Timestamp must be finite.");
    const key = guildId + ":" + action;
    const recent = (eventsByGuild.get(key) ?? []).filter((time) => time > timestamp - windowMs);
    recent.push(timestamp);
    eventsByGuild.set(key, recent);
    return { detected: recent.length >= threshold, count: recent.length, threshold, windowMs, action };
  }

  function clearGuild(guildId) {
    for (const key of eventsByGuild.keys()) if (key.startsWith(guildId + ":")) eventsByGuild.delete(key);
  }

  return { record, clearGuild };
}

module.exports = { createAntiNukeMonitor, ACTIONS, DEFAULT_WINDOW_MS, DEFAULT_THRESHOLD };
