const test = require("node:test");
const assert = require("node:assert/strict");
const { createModerationCaseReporter } = require("../src/services/moderation-audit");

test("moderation reporter sends authenticated case metadata to the panel", async () => {
  let request;
  const reporter = createModerationCaseReporter({
    endpoint: "https://project.example/functions/v1/panel-admin",
    secret: "private-test-secret",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ caseId: 42 }) };
    }
  });
  const result = await reporter.record({
    guildId: "12345678901234567",
    actorUserId: "12345678901234568",
    targetUserId: "12345678901234569",
    action: "timeout",
    reason: "Repeated spam",
    durationSeconds: 900
  });
  assert.equal(result.caseId, 42);
  assert.equal(request.options.headers["x-fusion-bot-secret"], "private-test-secret");
  const body = JSON.parse(request.options.body);
  assert.equal(body.action, "bot_log_moderation_case");
  assert.equal(body.entry.action, "timeout");
  assert.equal(body.entry.durationSeconds, 900);
});

test("moderation reporter rejects invalid IDs and unsupported actions", async () => {
  const reporter = createModerationCaseReporter({
    endpoint: "https://project.example/functions/v1/panel-admin",
    secret: "secret",
    fetchImpl: async () => ({ ok: true, json: async () => ({ caseId: 1 }) })
  });
  await assert.rejects(() => reporter.record({ guildId: "bad" }), /server ID/);
  await assert.rejects(() => reporter.record({
    guildId: "12345678901234567", actorUserId: "12345678901234568",
    action: "unban", reason: "test"
  }), /Unsupported moderation action/);
});
