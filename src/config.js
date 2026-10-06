import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function loadConfig(env = process.env) {
  const token = (env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (env.PHONE_NUMBER_ID || "").trim();

  return {
    port: Number(env.PORT || 3000),
    verifyToken: (env.VERIFY_TOKEN || "").trim(),
    token,
    phoneNumberId,
    ownerPhone: digits(env.OWNER_PHONE),
    appSecret: (env.APP_SECRET || "").trim(),
    templateName: (env.WHATSAPP_TEMPLATE_NAME || "").trim(),
    templateLang: (env.WHATSAPP_TEMPLATE_LANG || "en_US").trim(),
    graphVersion: (env.GRAPH_API_VERSION || "v25.0").trim(),
    dataFile: env.DATA_FILE || path.join(root, "data", "tasks.json"),
    canSend: Boolean(token && phoneNumberId),
  };
}

export function samePhone(left, right) {
  const a = digits(left);
  const b = digits(right);
  return a.length > 0 && a === b;
}
