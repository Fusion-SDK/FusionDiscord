function createGuildDirectorySync(options = {}) {
  const endpoint = options.endpoint ?? process.env.FUSION_PANEL_API_URL;
  const secret = options.secret ?? process.env.FUSION_BOT_API_SECRET;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function sync(guilds) {
    if (!endpoint || !secret) throw new Error("FUSION_PANEL_API_URL and FUSION_BOT_API_SECRET are required for server discovery.");
    let url;
    try { url = new URL(endpoint); } catch { throw new Error("FUSION_PANEL_API_URL is invalid."); }
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Panel configuration endpoint must use HTTPS.");
    const entries = [...guilds].map((guild) => ({
      id: guild.id,
      name: guild.name,
      iconUrl: typeof guild.iconURL === "function" ? guild.iconURL({ size: 128 }) : null,
      memberCount: Number.isInteger(guild.memberCount) ? guild.memberCount : null,
      joinedAt: guild.joinedAt instanceof Date ? guild.joinedAt.toISOString() : null
    }));
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
      body: JSON.stringify({ action: "bot_sync_guilds", guilds: entries }),
      signal: AbortSignal.timeout(15000)
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Could not synchronize Discord servers.");
    return payload.synchronized;
  }

  return { sync };
}

module.exports = { createGuildDirectorySync };
