const test = require("node:test");
const assert = require("node:assert/strict");

function loadApi(env = {}) {
  delete process.env.FUSION_API_BASE_URL;
  delete process.env.FUSION_BOT_API_SECRET;
  Object.assign(process.env, env);
  delete require.cache[require.resolve("../src/services/fusion-api")];
  return require("../src/services/fusion-api");
}

test("account API refuses to run without its secret configuration", async () => {
  const api = loadApi();
  await assert.rejects(api.getStatus("12345678901234567"), /not configured/i);
});

test("account API requires HTTPS outside localhost", async () => {
  const api = loadApi({
    FUSION_API_BASE_URL: "http://example.com/function",
    FUSION_BOT_API_SECRET: "test-secret"
  });
  await assert.rejects(api.getStatus("12345678901234567"), /HTTPS/i);
});

test("challenge request sends the immutable Discord ID and bot secret", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ code: "ABCD234567", expires_at: "2030-01-01T00:10:00Z" }) };
  };

  const api = loadApi({
    FUSION_API_BASE_URL: "https://project.example/functions/v1/discord-link",
    FUSION_BOT_API_SECRET: "test-secret"
  });
  const result = await api.createChallenge("12345678901234567");

  assert.equal(result.code, "ABCD234567");
  assert.equal(request.url, "https://project.example/functions/v1/discord-link");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["x-fusion-bot-secret"], "test-secret");
  assert.deepEqual(JSON.parse(request.options.body), {
    action: "create_challenge",
    discord_user_id: "12345678901234567"
  });
});

test("account API translates backend rate limits into a safe user-facing error", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({
    ok: false,
    json: async () => ({ error: "rate_limited" })
  });
  const api = loadApi({
    FUSION_API_BASE_URL: "https://project.example/functions/v1/discord-link",
    FUSION_BOT_API_SECRET: "test-secret"
  });
  await assert.rejects(
    api.createChallenge("12345678901234567"),
    /Too many verification attempts/i
  );
});

test("account API rejects malformed backend responses", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({ ok: true, json: async () => { throw new Error("bad json"); } });
  const api = loadApi({
    FUSION_API_BASE_URL: "https://project.example/functions/v1/discord-link",
    FUSION_BOT_API_SECRET: "test-secret"
  });
  await assert.rejects(
    api.getStatus("12345678901234567"),
    /invalid response/i
  );
});

test("verified-role service assigns a role only when a configured guild role exists", async (t) => {
  const originalRoleId = process.env.FUSION_VERIFIED_ROLE_ID;
  t.after(() => {
    if (originalRoleId === undefined) delete process.env.FUSION_VERIFIED_ROLE_ID;
    else process.env.FUSION_VERIFIED_ROLE_ID = originalRoleId;
  });
  process.env.FUSION_VERIFIED_ROLE_ID = "verified-role";

  let added = false;
  const role = { id: "verified-role" };
  const member = {
    roles: {
      cache: { has: () => false },
      add: async (value) => { assert.equal(value, role); added = true; },
      remove: async () => { throw new Error("unexpected role removal"); }
    }
  };
  const interaction = {
    user: { id: "discord-user-id" },
    inGuild: () => true,
    guild: {
      members: { fetch: async () => member },
      roles: { fetch: async () => role }
    }
  };
  delete require.cache[require.resolve("../src/services/verified-role")];
  const { syncVerifiedRole } = require("../src/services/verified-role");
  const result = await syncVerifiedRole(interaction, true);
  assert.equal(result.updated, true);
  assert.equal(added, true);
});

test("verified-role service does not attempt role changes outside a guild", async () => {
  process.env.FUSION_VERIFIED_ROLE_ID = "verified-role";
  const { syncVerifiedRole } = require("../src/services/verified-role");
  const result = await syncVerifiedRole({ inGuild: () => false }, true);
  assert.deepEqual(result, { updated: false, reason: "not_configured" });
});

test("account verification stays disabled until the in-game UI is ready", async () => {
  const previous = process.env.FUSION_LINKING_ENABLED;
  delete process.env.FUSION_LINKING_ENABLED;
  delete require.cache[require.resolve("../src/commands/account-verify")];
  const command = require("../src/commands/account-verify");
  let reply = "";
  const interaction = {
    deferReply: async () => {},
    editReply: async (message) => { reply = message; }
  };
  await command.execute(interaction);
  if (previous === undefined) delete process.env.FUSION_LINKING_ENABLED;
  else process.env.FUSION_LINKING_ENABLED = previous;
  assert.match(reply, /not enabled yet/i);
  assert.match(reply, /in-game Link Discord screen/i);
});
