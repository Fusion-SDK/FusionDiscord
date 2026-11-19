const DEFAULT_WINDOW_MS = 8_000;
const DEFAULT_MESSAGE_LIMIT = 6;
const DEFAULT_MENTION_LIMIT = 5;

function createAutoModMonitor(options = {}) {
  const windowMs = Number.isInteger(options.windowMs) && options.windowMs >= 1000 ? options.windowMs : DEFAULT_WINDOW_MS;
  const messageLimit = Number.isInteger(options.messageLimit) && options.messageLimit >= 3 ? options.messageLimit : DEFAULT_MESSAGE_LIMIT;
  const mentionLimit = Number.isInteger(options.mentionLimit) && options.mentionLimit >= 2 ? options.mentionLimit : DEFAULT_MENTION_LIMIT;
  const activity = new Map();

  function inspect(message, timestamp = Date.now()) {
    if (!message || !message.guildId || !message.author?.id || message.author.bot) return [];
    if (!Number.isFinite(timestamp)) throw new TypeError("Timestamp must be finite.");
    const key = message.guildId + ":" + message.author.id;
    const previous = (activity.get(key) ?? []).filter((item) => item.timestamp > timestamp - windowMs);
    const content = String(message.content ?? "").trim().toLowerCase();
    previous.push({ timestamp, content });
    activity.set(key, previous);

    const flags = [];
    if (previous.length >= messageLimit) flags.push("message_spam");
    if (content && previous.filter((item) => item.content === content).length >= 3) flags.push("repeated_message");
    const mentionCount = Number(message.mentions?.users?.size ?? 0) + Number(message.mentions?.roles?.size ?? 0);
    if (mentionCount >= mentionLimit) flags.push("mention_flood");
    return flags;
  }

  function clearGuild(guildId) {
    for (const key of activity.keys()) if (key.startsWith(guildId + ":")) activity.delete(key);
  }

  return { inspect, clearGuild };
}

module.exports = { createAutoModMonitor, DEFAULT_WINDOW_MS, DEFAULT_MESSAGE_LIMIT, DEFAULT_MENTION_LIMIT };
