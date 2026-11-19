const test = require("node:test");
const assert = require("node:assert/strict");
const { createAntiRaidMonitor } = require("../src/services/anti-raid");

const GUILD_A = "123456789012345678";
const GUILD_B = "223456789012345678";

test("anti-raid monitor detects a join spike inside the configured window", () => {
  const monitor = createAntiRaidMonitor({ threshold: 3, windowMs: 5000 });
  assert.equal(monitor.recordJoin(GUILD_A, 1000).detected, false);
  assert.equal(monitor.recordJoin(GUILD_A, 2000).detected, false);
  const result = monitor.recordJoin(GUILD_A, 3000);
  assert.equal(result.detected, true);
  assert.equal(result.count, 3);
});

test("anti-raid monitor expires joins outside the sliding window", () => {
  const monitor = createAntiRaidMonitor({ threshold: 3, windowMs: 5000 });
  monitor.recordJoin(GUILD_A, 1000);
  monitor.recordJoin(GUILD_A, 2000);
  const result = monitor.recordJoin(GUILD_A, 7001);
  assert.equal(result.detected, false);
  assert.equal(result.count, 1);
});

test("anti-raid monitor keeps guilds isolated", () => {
  const monitor = createAntiRaidMonitor({ threshold: 2, windowMs: 5000 });
  monitor.recordJoin(GUILD_A, 1000);
  assert.equal(monitor.recordJoin(GUILD_B, 1000).detected, false);
  assert.equal(monitor.recordJoin(GUILD_B, 1100).detected, true);
});

test("anti-raid monitor suppresses repeated alerts during cooldown", () => {
  const monitor = createAntiRaidMonitor({ threshold: 2, windowMs: 5000, alertCooldownMs: 3000 });
  monitor.recordJoin(GUILD_A, 1000);
  assert.equal(monitor.recordJoin(GUILD_A, 1100).detected, true);
  assert.equal(monitor.recordJoin(GUILD_A, 1200).suppressed, true);
  assert.equal(monitor.recordJoin(GUILD_A, 4500).detected, true);
});

test("anti-raid monitor rejects invalid guild IDs", () => {
  const monitor = createAntiRaidMonitor();
  assert.throws(() => monitor.recordJoin("not-a-guild", 1000), /valid Discord guild ID/);
});
