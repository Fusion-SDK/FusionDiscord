const test = require("node:test");
const assert = require("node:assert/strict");

test("panel config accepts the known command flags and verification settings", () => {
  const { validateConfig } = require("../src/services/panel-config");
  const config = validateConfig({
    commands: { ping: true, "account-verify": false, "account-status": true, "account-unlink": false },
    verification: { enabled: false, verifiedRoleId: null }
  });
  assert.equal(config.commands.ping, true);
  assert.equal(config.commands["account-unlink"], false);
});

test("panel config rejects missing or non-boolean command flags", () => {
  const { validateConfig } = require("../src/services/panel-config");
  assert.throws(() => validateConfig({
    commands: { ping: true },
    verification: { enabled: false, verifiedRoleId: null }
  }), /invalid command setting/i);
});

test("panel config rejects malformed role IDs", () => {
  const { validateConfig } = require("../src/services/panel-config");
  assert.throws(() => validateConfig({
    commands: { ping: true, "account-verify": false, "account-status": true, "account-unlink": true },
    verification: { enabled: true, verifiedRoleId: "not-a-discord-id" }
  }), /invalid verification settings/i);
});

test("panel config request uses the bot secret and bot_get_config action", async (t) => {
  const previousUrl = process.env.FUSION_PANEL_API_URL;
  const previousSecret = process.env.FUSION_BOT_API_SECRET;
  const originalFetch = global.fetch;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.FUSION_PANEL_API_URL;
    else process.env.FUSION_PANEL_API_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.FUSION_BOT_API_SECRET;
    else process.env.FUSION_BOT_API_SECRET = previousSecret;
    global.fetch = originalFetch;
  });
  process.env.FUSION_PANEL_API_URL = "https://project.example/functions/v1/panel-admin";
  process.env.FUSION_BOT_API_SECRET = "test-secret";
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        config: {
          commands: { ping: true, "account-verify": false, "account-status": true, "account-unlink": true },
          verification: { enabled: false, verifiedRoleId: null }
        }
      })
    };
  };
  delete require.cache[require.resolve("../src/services/panel-config")];
  const { loadPanelConfig } = require("../src/services/panel-config");
  const config = await loadPanelConfig();
  assert.equal(request.url, process.env.FUSION_PANEL_API_URL);
  assert.equal(request.options.headers["x-fusion-bot-secret"], "test-secret");
  assert.deepEqual(JSON.parse(request.options.body), { action: "bot_get_config" });
  assert.equal(config.commands.ping, true);
});
