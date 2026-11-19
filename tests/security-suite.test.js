const test = require("node:test");
const assert = require("node:assert/strict");
const { createAntiNukeMonitor } = require("../src/services/anti-nuke");
const { createAutoModMonitor } = require("../src/services/auto-mod");
const { inspectMember } = require("../src/services/join-gate");

const GUILD = "123456789012345678";

test("anti-nuke monitor detects repeated destructive audit events per action", () => {
  const monitor = createAntiNukeMonitor({ threshold: 3, windowMs: 5000 });
  assert.equal(monitor.record(GUILD, "channelDelete", 1000).detected, false);
  assert.equal(monitor.record(GUILD, "channelDelete", 2000).detected, false);
  assert.equal(monitor.record(GUILD, "channelDelete", 3000).detected, true);
  assert.equal(monitor.record(GUILD, "roleDelete", 3000).detected, false);
});

test("anti-nuke monitor expires old events and rejects unsupported actions", () => {
  const monitor = createAntiNukeMonitor({ threshold: 2, windowMs: 1000 });
  monitor.record(GUILD, "roleCreate", 1000);
  assert.equal(monitor.record(GUILD, "roleCreate", 2001).detected, false);
  assert.throws(() => monitor.record(GUILD, "unknown", 3000), /Unsupported/);
});

test("automod monitor detects spam, repeated messages, and mention floods", () => {
  const monitor = createAutoModMonitor({ messageLimit: 3, mentionLimit: 2 });
  const message = (content, users = 0) => ({
    guildId: GUILD, author: { id: "323456789012345678", bot: false }, content,
    mentions: { users: { size: users }, roles: { size: 0 } }
  });
  assert.deepEqual(monitor.inspect(message("same"), 1000), []);
  assert.deepEqual(monitor.inspect(message("same"), 1100), []);
  assert.deepEqual(monitor.inspect(message("same", 2), 1200), ["message_spam", "repeated_message", "mention_flood"]);
});

test("automod ignores bots and direct messages", () => {
  const monitor = createAutoModMonitor({ messageLimit: 3 });
  assert.deepEqual(monitor.inspect({ guildId: null, author: { id: "1" } }), []);
  assert.deepEqual(monitor.inspect({ guildId: GUILD, author: { id: "1", bot: true } }), []);
});

test("join gate flags young accounts and optional bot accounts", () => {
  const now = 10_000_000;
  const member = { user: { createdTimestamp: now - 1000, bot: true } };
  assert.deepEqual(inspectMember(member, { minAccountAgeMs: 5000, flagBots: true }, now).reasons, ["bot_account", "new_account"]);
  assert.equal(inspectMember(member, { minAccountAgeMs: 500 }, now).flagged, false);
});
