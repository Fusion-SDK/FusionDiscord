function createGuildResourceSync(options = {}) {
  const endpoint = options.endpoint ?? process.env.FUSION_PANEL_API_URL;
  const secret = options.secret ?? process.env.FUSION_BOT_API_SECRET;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function sync(guilds) {
    if (!endpoint || !secret) throw new Error("FUSION_PANEL_API_URL and FUSION_BOT_API_SECRET are required for resource synchronization.");
    let url;
    try { url = new URL(endpoint); } catch { throw new Error("FUSION_PANEL_API_URL is invalid."); }
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Panel configuration endpoint must use HTTPS.");

    const snapshots = [...guilds].map((guild) => ({
      guildId: guild.id,
      roles: [...guild.roles.cache.values()].map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
        managed: role.managed,
        mentionable: role.mentionable,
        hoist: role.hoist
      })),
      channels: [...guild.channels.cache.values()].map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId ?? null,
        position: channel.position ?? 0,
        topic: typeof channel.topic === "string" ? channel.topic : null,
        nsfw: Boolean(channel.nsfw)
      }))
    }));

    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
      body: JSON.stringify({ action: "bot_sync_guild_resources", guilds: snapshots }),
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Could not synchronize Discord server resources.");
    return payload.synchronized ?? snapshots.length;
  }

  return { sync };
}

module.exports = { createGuildResourceSync };
