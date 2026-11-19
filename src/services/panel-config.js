const DEFAULT_CONFIG = Object.freeze({
  commands: Object.freeze({
    ping: true,
    "account-verify": false,
    "account-status": true,
    "account-unlink": true
  }),
  verification: Object.freeze({ enabled: false, verifiedRoleId: null })
});

let currentConfig = structuredClone(DEFAULT_CONFIG);

function validateConfig(input) {
  if (!input || typeof input !== "object" || !input.commands || typeof input.commands !== "object") {
    throw new Error("Panel returned an invalid command configuration.");
  }
  const commands = {};
  for (const name of Object.keys(DEFAULT_CONFIG.commands)) {
    if (typeof input.commands[name] !== "boolean") {
      throw new Error("Panel returned an invalid setting for command: " + name);
    }
    commands[name] = input.commands[name];
  }
  const verification = input.verification;
  if (!verification || typeof verification.enabled !== "boolean") {
    throw new Error("Panel returned invalid verification settings.");
  }
  const roleId = verification.verifiedRoleId;
  if (roleId !== null && (typeof roleId !== "string" || !/^\d{17,20}$/.test(roleId))) {
    throw new Error("Panel returned an invalid verified role ID.");
  }
  return { commands, verification: { enabled: verification.enabled, verifiedRoleId: roleId } };
}

async function fetchPanelConfig() {
  const url = process.env.FUSION_PANEL_API_URL;
  const secret = process.env.FUSION_BOT_API_SECRET;
  if (!url || !secret) throw new Error("Panel configuration is not connected. Set FUSION_PANEL_API_URL and FUSION_BOT_API_SECRET.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("FUSION_PANEL_API_URL is invalid."); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Panel configuration endpoint must use HTTPS.");
  }

  const response = await fetch(parsed.toString(), {
    method: "POST",
    headers: { "content-type": "application/json", "x-fusion-bot-secret": secret },
    body: JSON.stringify({ action: "bot_get_config" }),
    signal: AbortSignal.timeout(8000)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error("Panel configuration endpoint returned invalid JSON."); }
  if (!response.ok || data.error) throw new Error("Panel configuration request failed.");
  const nextConfig = validateConfig(data.config);
  return nextConfig;
}

async function refreshPanelConfig() {
  const next = await fetchPanelConfig();
  const changed = JSON.stringify(currentConfig) !== JSON.stringify(next);
  currentConfig = next;
  return { config: getPanelConfig(), changed };
}

function getPanelConfig() {
  return structuredClone(currentConfig);
}

function isCommandEnabled(name) {
  return currentConfig.commands[name] === true;
}

function resetPanelConfigForTests() {
  currentConfig = structuredClone(DEFAULT_CONFIG);
}

module.exports = {
  DEFAULT_CONFIG,
  fetchPanelConfig,
  refreshPanelConfig,
  getPanelConfig,
  isCommandEnabled,
  resetPanelConfigForTests
};
