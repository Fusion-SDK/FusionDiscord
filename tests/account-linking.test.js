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
