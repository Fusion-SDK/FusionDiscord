const EVENT_TYPES = new Set(["anti_raid", "anti_nuke", "auto_mod", "join_gate", "lockdown"]);

function createSecurityEventReporter(options = {}) {
  const endpoint = options.endpoint ?? process.env.FUSION_PANEL_API_URL;
  const secret = options.secret ?? process.env.FUSION_BOT_API_SECRET;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function report(event) {
    if (!event || typeof event.guildId !== "string" || !/^\d{17,20}$/.test(event.guildId)) {
      throw new TypeError("A valid Discord server ID is required.");
    }
    if (!EVENT_TYPES.has(event.eventType)) throw new TypeError("Unsupported security event type.");
    if (typeof event.summary !== "string" || !event.summary.trim() || event.summary.length > 240) {
      throw new TypeError("A short security event summary is required.");
    }
    if (!endpoint || !secret) return { skipped: true };
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Panel endpoint must use HTTPS.");
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
      body: JSON.stringify({ action: "bot_log_security_event", event: {
        guildId: event.guildId, eventType: event.eventType,
        summary: event.summary.trim(), severity: "warning"
      } }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Security event API returned HTTP " + response.status + ".");
    const payload = await response.json();
    if (payload.error) throw new Error("Security event API rejected the event.");
    return { recorded: true };
  }

  return { report };
}

module.exports = { createSecurityEventReporter, EVENT_TYPES };
