const ACTIONS = new Set(["warn", "timeout", "kick", "ban", "purge"]);

function createModerationCaseReporter(options = {}) {
  const endpoint = options.endpoint ?? process.env.FUSION_PANEL_API_URL;
  const secret = options.secret ?? process.env.FUSION_BOT_API_SECRET;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function record(entry) {
    if (!entry || typeof entry.guildId !== "string" || !/^\d{17,20}$/.test(entry.guildId)) {
      throw new TypeError("A valid Discord server ID is required.");
    }
    if (typeof entry.actorUserId !== "string" || !/^\d{17,20}$/.test(entry.actorUserId)) {
      throw new TypeError("A valid moderator ID is required.");
    }
    if (entry.targetUserId !== null && entry.targetUserId !== undefined &&
        (typeof entry.targetUserId !== "string" || !/^\d{17,20}$/.test(entry.targetUserId))) {
      throw new TypeError("A valid target user ID is required.");
    }
    if (!ACTIONS.has(entry.action)) throw new TypeError("Unsupported moderation action.");
    if ((entry.action === "purge" && entry.targetUserId != null) || (entry.action !== "purge" && (typeof entry.targetUserId !== "string" || !/^\\d{17,20}$/.test(entry.targetUserId)))) {
      throw new TypeError("A valid target user ID is required for this action.");
    }
    if (entry.durationSeconds != null && (!Number.isInteger(entry.durationSeconds) || entry.durationSeconds < 1 || entry.durationSeconds > 2_419_200)) {
      throw new TypeError("Duration must be between 1 second and 28 days.");
    }
    if (typeof entry.reason !== "string" || !entry.reason.trim() || entry.reason.length > 500) {
      throw new TypeError("A moderation reason is required and must be 500 characters or fewer.");
    }
    if (!endpoint || !secret) throw new Error("Moderation audit logging is not configured.");
    let url;
    try { url = new URL(endpoint); } catch { throw new Error("FUSION_PANEL_API_URL is invalid."); }
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Panel endpoint must use HTTPS.");

    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
      body: JSON.stringify({
        action: "bot_log_moderation_case",
        entry: {
          guildId: entry.guildId,
          actorUserId: entry.actorUserId,
          targetUserId: entry.targetUserId ?? null,
          action: entry.action,
          reason: entry.reason.trim(),
          durationSeconds: entry.durationSeconds ?? null,
          metadata: entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {}
        }
      }),
      signal: AbortSignal.timeout(8000)
    });
    let payload;
    try { payload = await response.json(); } catch { throw new Error("Moderation audit API returned an invalid response."); }
    if (!response.ok || payload.error) throw new Error(payload.error || "Moderation audit API returned HTTP " + response.status + ".");
    return { recorded: true, caseId: payload.caseId ?? null };
  }

  return { record };
}

module.exports = { createModerationCaseReporter, ACTIONS };
