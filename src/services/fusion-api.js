const BASE_URL = process.env.FUSION_API_BASE_URL;
const BOT_SECRET = process.env.FUSION_BOT_API_SECRET;

function configurationError() {
  if (!BASE_URL || !BOT_SECRET) throw new Error("Fusion verification service is not configured.");
  let parsed;
  try { parsed = new URL(BASE_URL); } catch { throw new Error("Fusion verification service URL is invalid."); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("Fusion verification service must use HTTPS.");
}

async function request(action, payload = {}) {
  configurationError();
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-fusion-bot-secret": BOT_SECRET },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(8000)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error("Verification service returned an invalid response."); }
  if (!response.ok || data.error) {
    const messages = {
      already_linked: "This Discord account is already linked to a Fusion account.",
      rate_limited: "Too many verification attempts. Please wait before trying again.",
      not_linked: "This Discord account is not linked.",
      account_already_linked: "That Fusion account or Discord account is already linked elsewhere."
    };
    throw new Error(messages[data.error] || "The verification service could not complete that request.");
  }
  return data;
}

module.exports = {
  createChallenge: (discordUserId) => request("create_challenge", { discord_user_id: discordUserId }),
  getStatus: (discordUserId) => request("status", { discord_user_id: discordUserId }),
  unlink: (discordUserId) => request("unlink", { discord_user_id: discordUserId })
};
