const test = require("node:test");
const assert = require("node:assert/strict");
const { createGuildResourceSync } = require("../src/services/guild-resource-sync");

test("resource sync publishes role and channel metadata through the protected endpoint", async () => {
  let request;
  const sync = createGuildResourceSync({
    endpoint: "https://example.supabase.co/functions/v1/panel-admin",
    secret: "test-secret",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true, synchronized: 1 }) };
    }
  });
  const guild = {
    id: "123456789012345678",
    roles: { cache: new Map([["r1", {
      id: "223456789012345678", name: "Moderator", color: 12345, position: 3,
      permissions: { bitfield: 1024n }, managed: false, mentionable: true, hoist: true
    }]]) },
    channels: { cache: new Map([["c1", {
      id: "323456789012345678", name: "general", type: 0, parentId: null,
      position: 1, topic: "Community chat", nsfw: false
    }]]) }
  };
  assert.equal(await sync.sync([guild]), 1);
  assert.equal(request.options.headers["x-fusion-bot-secret"], "test-secret");
  const body = JSON.parse(request.options.body);
  assert.equal(body.action, "bot_sync_guild_resources");
  assert.equal(body.guilds[0].guildId, guild.id);
  assert.equal(body.guilds[0].roles[0].name, "Moderator");
  assert.equal(body.guilds[0].roles[0].permissions, "1024");
  assert.equal(body.guilds[0].channels[0].name, "general");
  assert.equal(body.guilds[0].channels[0].topic, "Community chat");
});

test("resource sync requires endpoint and secret", async () => {
  const sync = createGuildResourceSync({ endpoint: "", secret: "" });
  await assert.rejects(sync.sync([]), /required/);
});

test("resource sync rejects failed API responses", async () => {
  const sync = createGuildResourceSync({
    endpoint: "https://example.supabase.co/functions/v1/panel-admin",
    secret: "test-secret",
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: "Unauthorized." }) })
  });
  await assert.rejects(sync.sync([]), /Unauthorized/);
});
