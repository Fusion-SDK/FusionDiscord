const test = require("node:test");
const assert = require("node:assert/strict");
const { createGuildDirectorySync } = require("../src/services/guild-directory");

test("guild directory sync sends server details using the bot secret", async () => {
  let request;
  const sync = createGuildDirectorySync({
    endpoint: "https://example.supabase.co/functions/v1/panel-admin",
    secret: "test-secret",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true, synchronized: 1 }) };
    }
  });
  const joinedAt = new Date("2026-11-19T12:00:00.000Z");
  const count = await sync.sync([{
    id: "123456789012345678",
    name: "Fusion Test Server",
    iconURL: () => "https://cdn.discordapp.com/icons/123456789012345678/icon.png",
    memberCount: 42,
    joinedAt
  }]);
  assert.equal(count, 1);
  assert.equal(request.options.headers["x-fusion-bot-secret"], "test-secret");
  const body = JSON.parse(request.options.body);
  assert.equal(body.action, "bot_sync_guilds");
  assert.equal(body.guilds[0].id, "123456789012345678");
  assert.equal(body.guilds[0].name, "Fusion Test Server");
  assert.equal(body.guilds[0].memberCount, 42);
  assert.equal(body.guilds[0].joinedAt, joinedAt.toISOString());
});

test("guild directory sync requires the panel endpoint and bot secret", async () => {
  const sync = createGuildDirectorySync({ endpoint: "", secret: "" });
  await assert.rejects(sync.sync([]), /required/);
});

test("guild directory sync rejects failed API responses", async () => {
  const sync = createGuildDirectorySync({
    endpoint: "https://example.supabase.co/functions/v1/panel-admin",
    secret: "test-secret",
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: "Unauthorized." }) })
  });
  await assert.rejects(sync.sync([]), /Unauthorized/);
});
