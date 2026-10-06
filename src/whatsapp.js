import crypto from "node:crypto";

export function verifySignature(rawBody, signature, appSecret) {
  if (!appSecret) return true;
  if (!signature || !rawBody) return false;

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createWhatsApp(config, fetchImpl = fetch) {
  const base = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;

  async function post(payload) {
    const response = await fetchImpl(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error?.message || `WhatsApp request failed (${response.status})`;
      throw new Error(message);
    }
    return body;
  }

  return {
    sendText(to, body) {
      return post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body },
      });
    },

    sendTemplate(to, taskText) {
      return post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: config.templateName,
          language: { code: config.templateLang },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: taskText }],
            },
          ],
        },
      });
    },
  };
}

export function incomingTexts(payload) {
  const found = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = change?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        found.push({
          id: message.id,
          from: message.from,
          type: message.type,
          text: message.type === "text" ? message.text?.body || "" : "",
        });
      }
    }
  }
  return found;
}
