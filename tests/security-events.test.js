const test = require("node:test");
const assert = require("node:assert/strict");
const { createSecurityEventReporter } = require("../src/services/security-events");

test("security event reporter sends validated, minimal event metadata", async () => {
  let request;
  const reporter = createSecurityEventReporter({
    endpoint: "https://panel.example.test/functions/v1/panel-admin", secret: "test-secret",
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ ok: true }) }; }
  });
  const result = await reporter.report({ guildId: "12345678901234567", eventType: "anti_raid", summary: "Join spike detected" });
  assert.deepEqual(result, { recorded: true });
  assert.equal(request.options.headers["x-fusion-bot-secret"], "test-secret");
  const body = JSON.parse(request.options.body);
  assert.equal(body.action, "bot_log_security_event");
  assert.equal(body.event.guildId, "12345678901234567");
  assert.equal(body.event.eventType, "anti_raid");
  assert.equal("memberId" in body.event, false);
});

test("security event reporter rejects invalid guild IDs and event types", async () => {
  const reporter = createSecurityEventReporter({ endpoint: "https://panel.example.test", secret: "x", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(reporter.report({ guildId: "bad", eventType: "anti_raid", summary: "x" }), /server ID/);
  await assert.rejects(reporter.report({ guildId: "12345678901234567", eventType: "unknown", summary: "x" }), /event type/);
});
