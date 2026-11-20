const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_TIMEOUT_MS, parseDuration, normalizeReason, canModerateTarget } = require("../src/services/moderation");

test("parses supported single and compound timeout durations", () => {
  assert.equal(parseDuration("30m"), 1_800_000);
  assert.equal(parseDuration("2h"), 7_200_000);
  assert.equal(parseDuration("1h30m"), 5_400_000);
  assert.equal(parseDuration("1d"), 86_400_000);
});

test("rejects malformed, zero, and over-limit timeout durations", () => {
  for (const value of ["", "later", "1w", "1h 30m", "0m", "29d"]) {
    assert.throws(() => parseDuration(value));
  }
  assert.equal(parseDuration("28d"), MAX_TIMEOUT_MS);
});

test("normalizes empty reasons and enforces the reason limit", () => {
  assert.equal(normalizeReason("  "), "No reason provided.");
  assert.equal(normalizeReason(" spam "), "spam");
  assert.throws(() => normalizeReason("x".repeat(501)), /500 characters/);
});

test("prevents self, owner, equal-role, and higher-role moderation", () => {
  const actor = { id: "actor", roles: { highest: { position: 5 } } };
  const makeTarget = (id, position) => ({
    id,
    roles: { highest: { comparePositionTo: (other) => position - other.position } }
  });
  assert.equal(canModerateTarget(actor, makeTarget("self", 1), "owner"), true);
  assert.equal(canModerateTarget(actor, makeTarget("actor", 1), "owner"), false);
  assert.equal(canModerateTarget(actor, makeTarget("owner", 0), "owner"), false);
  assert.equal(canModerateTarget(actor, makeTarget("same", 5), "owner"), false);
  assert.equal(canModerateTarget(actor, makeTarget("higher", 6), "owner"), false);
  assert.equal(canModerateTarget(actor, makeTarget("lower", 2), "owner"), true);
});
