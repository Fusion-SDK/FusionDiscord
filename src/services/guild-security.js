const DEFAULT_GUILD_SECURITY = Object.freeze({
  antiRaid: Object.freeze({ enabled: false, joinThreshold: 6, windowSeconds: 10, alertChannelId: null }),
  antiNuke: Object.freeze({ enabled: false, eventThreshold: 4, windowSeconds: 10, alertChannelId: null }),
  autoMod: Object.freeze({ enabled: false, messageLimit: 6, windowSeconds: 8, mentionLimit: 5, alertChannelId: null }),
  joinGate: Object.freeze({ enabled: false, minimumAccountAgeDays: 7, flagBots: false, alertChannelId: null }),
  lockdown: Object.freeze({ enabled: false, logChannelId: null })
});

function validateGuildSecurity(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid server security settings.");
  const validSnowflake = (value) => value === null || (typeof value === "string" && /^\d{17,20}$/.test(value));
  const bounded = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const { antiRaid, antiNuke, autoMod, joinGate, lockdown } = input;
  if (!antiRaid || typeof antiRaid.enabled !== "boolean" || !bounded(antiRaid.joinThreshold, 2, 100) ||
      !bounded(antiRaid.windowSeconds, 3, 300) || !validSnowflake(antiRaid.alertChannelId)) throw new Error("Invalid anti-raid settings.");
  if (!antiNuke || typeof antiNuke.enabled !== "boolean" || !bounded(antiNuke.eventThreshold, 2, 100) ||
      !bounded(antiNuke.windowSeconds, 3, 300) || !validSnowflake(antiNuke.alertChannelId)) throw new Error("Invalid anti-nuke settings.");
  if (!autoMod || typeof autoMod.enabled !== "boolean" || !bounded(autoMod.messageLimit, 3, 50) ||
      !bounded(autoMod.windowSeconds, 3, 120) || !bounded(autoMod.mentionLimit, 2, 50) ||
      !validSnowflake(autoMod.alertChannelId)) throw new Error("Invalid AutoMod settings.");
  if (!joinGate || typeof joinGate.enabled !== "boolean" || !bounded(joinGate.minimumAccountAgeDays, 0, 365) ||
      typeof joinGate.flagBots !== "boolean" || !validSnowflake(joinGate.alertChannelId)) throw new Error("Invalid join-gate settings.");
  if (!lockdown || typeof lockdown.enabled !== "boolean" || !validSnowflake(lockdown.logChannelId)) throw new Error("Invalid lockdown settings.");
  return {
    antiRaid: { enabled: antiRaid.enabled, joinThreshold: antiRaid.joinThreshold, windowSeconds: antiRaid.windowSeconds, alertChannelId: antiRaid.alertChannelId },
    antiNuke: { enabled: antiNuke.enabled, eventThreshold: antiNuke.eventThreshold, windowSeconds: antiNuke.windowSeconds, alertChannelId: antiNuke.alertChannelId },
    autoMod: { enabled: autoMod.enabled, messageLimit: autoMod.messageLimit, windowSeconds: autoMod.windowSeconds, mentionLimit: autoMod.mentionLimit, alertChannelId: autoMod.alertChannelId },
    joinGate: { enabled: joinGate.enabled, minimumAccountAgeDays: joinGate.minimumAccountAgeDays, flagBots: joinGate.flagBots, alertChannelId: joinGate.alertChannelId },
    lockdown: { enabled: lockdown.enabled, logChannelId: lockdown.logChannelId }
  };
}

function createGuildSecurityClient(options = {}) {
  const endpoint = options.endpoint ?? process.env.FUSION_PANEL_API_URL;
  const secret = options.secret ?? process.env.FUSION_BOT_API_SECRET;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheTtlMs = options.cacheTtlMs ?? 30_000;
  const cache = new Map();

  async function get(guildId, now = Date.now()) {
    if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) throw new TypeError("A valid Discord server ID is required.");
    const cached = cache.get(guildId);
    if (cached && now - cached.loadedAt < cacheTtlMs) return cached.config;
    if (!endpoint || !secret) {
      if (cached) return cached.config;
      return DEFAULT_GUILD_SECURITY;
    }
    let url;
    try { url = new URL(endpoint); } catch { throw new Error("FUSION_PANEL_API_URL is invalid."); }
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Panel configuration endpoint must use HTTPS.");
    try {
      const response = await fetchImpl(url.toString(), {
        method: "POST",
        headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
        body: JSON.stringify({ action: "bot_get_guild_security", guildId }),
        signal: AbortSignal.timeout(8000)
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error("Could not load server security settings.");
      if (payload.guildId !== guildId) throw new Error("Panel returned settings for a different server.");
      const config = validateGuildSecurity(payload.config);
      cache.set(guildId, { config, loadedAt: now });
      return config;
    } catch (error) {
      if (cached) return cached.config;
      throw error;
    }
  }

  function clear(guildId) { cache.delete(guildId); }
  return { get, clear };
}

module.exports = { DEFAULT_GUILD_SECURITY, validateGuildSecurity, createGuildSecurityClient };
