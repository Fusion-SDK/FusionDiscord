const DEFAULT_CONFIG = Object.freeze({
  commands: Object.freeze({
    ping: true,
    "account-verify": false,
    "account-status": true,
    "account-unlink": true
  }),
  verification: Object.freeze({ enabled: false, verifiedRoleId: null })
});

const COMMAND_NAMES = Object.keys(DEFAULT_CONFIG.commands);

function validateConfig(config) {
  if (!config || typeof config !== "object" || !config.commands || !config.verification) {
    throw new Error("Panel returned an invalid configuration.");
  }
  const commands = {};
  for (const name of COMMAND_NAMES) {
    if (typeof config.commands[name] !== "boolean") {
      throw new Error("Panel returned an invalid command setting: " + name);
    }
    commands[name] = config.commands[name];
  }
  const { enabled, verifiedRoleId } = config.verification;
  if (typeof enabled !== "boolean" ||
      (verifiedRoleId !== null && (typeof verifiedRoleId !== "string" || !/^\\d{17,20}$/.test(verifiedRoleId)))) {
    throw new Error("Panel returned invalid verification settings.");
  }
  return { commands, verification: { enabled, verifiedRoleId } };
}

async function loadPanelConfig() {
  const url = process.env.FUSION_PANEL_API_URL;
  const secret = process.env.FUSION_BOT_API_SECRET;
  if (!url || !secret) throw new Error("Panel configuration URL or bot secret is missing.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("Panel configuration URL is invalid."); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Panel configuration endpoint must use HTTPS.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
    body: JSON.stringify({ action: "bot_get_config" }),
    signal: AbortSignal.timeout(8000)
  });
  let payload;
  try { payload = await response.json(); } catch {
    throw new Error("Panel returned an invalid response.");
  }
  if (!response.ok || payload.error) {
    throw new Error("Panel configuration request failed (HTTP " + response.status + ").");
  }
  return validateConfig(payload.config);
}

module.exports = { DEFAULT_CONFIG, loadPanelConfig, validateConfig };
