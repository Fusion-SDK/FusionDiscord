const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_GUILD_SECURITY, validateGuildSecurity, createGuildSecurityClient } = require("../src/services/guild-security");

const GUILD = "123456789012345678";

test("guild security validator accepts the panel defaults", () => {
  assert.deepEqual(validateGuildSecurity(DEFAULT_GUILD_SECURITY), DEFAULT_GUILD_SECURITY);
});

test("guild security validator rejects invalid channel IDs and thresholds", () => {
  const invalid = structuredClone(DEFAULT_GUILD_SECURITY);
  invalid.antiRaid.joinThreshold = 1;
  assert.throws(() => validateGuildSecurity(invalid), /anti-raid/);
  const badChannel = structuredClone(DEFAULT_GUILD_SECURITY);
  badChannel.autoMod.alertChannelId = "not-an-id";
  assert.throws(() => validateGuildSecurity(badChannel), /AutoMod/);
});

test("guild security client requests settings with the bot secret and caches results", async () => {
  let calls = 0;
  const client = createGuildSecurityClient({
    endpoint: "https://example.supabase.co/functions/v1/panel-admin",
    secret: "test-secret",
    cacheTtlMs: 1000,
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.headers["x-fusion-bot-secret"], "test-secret");
      const body = JSON.parse(options.body);
      assert.equal(body.action, "bot_get_guild_security");
      assert.equal(body.guildId, GUILD);
      return { ok: true, json: async () => ({ guildId: GUILD, config: DEFAULT_GUILD_SECURITY }) };
    }
  });
  assert.deepEqual(await client.get(GUILD, 100), DEFAULT_GUILD_SECURITY);
  assert.deepEqual(await client.get(GUILD, 200), DEFAULT_GUILD_SECURITY);
  assert.equal(calls, 1);
});

test("guild security client rejects mismatched server responses", async () => {
  const client = createGuildSecurityClient({
    endpoint: "https://example.supabase.co/functions/v1/panel-admin",
    secret: "test-secret",
    fetchImpl: async () => ({ ok: true, json: async () => ({ guildId: "223456789012345678", config: DEFAULT_GUILD_SECURITY }) })
  });
  await assert.rejects(client.get(GUILD), /different server/);
});
