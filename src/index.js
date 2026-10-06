import "dotenv/config";
import express from "express";
import { handleMessage } from "./agent.js";
import { loadConfig, samePhone } from "./config.js";
import { runReminderPass } from "./scheduler.js";
import { createStore } from "./store.js";
import { createWhatsApp, incomingTexts, verifySignature } from "./whatsapp.js";

const config = loadConfig();
const store = createStore(config.dataFile);
const whatsapp = createWhatsApp(config);
const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get("/", (_req, res) => {
  res.type("text").send("WhatsApp task agent is running.");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === config.verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  if (!verifySignature(req.rawBody, req.get("x-hub-signature-256"), config.appSecret)) {
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  for (const message of incomingTexts(req.body)) {
    try {
      await onMessage(message);
    } catch (error) {
      console.error("[whatsapp-agent] failed to handle message:", error.message);
    }
  }
});

async function onMessage(message) {
  if (!message.id || store.hasSeen(message.id)) return;
  store.markSeen(message.id);

  if (config.ownerPhone && !samePhone(message.from, config.ownerPhone)) {
    console.log(`[whatsapp-agent] ignored message from ${message.from}`);
    return;
  }

  const now = new Date();
  store.openServiceWindow(now);

  const reply =
    message.type === "text"
      ? handleMessage(message.text, store, now)
      : "Send a text command. Try: help";

  console.log(`[whatsapp-agent] ${message.from}: ${message.text || `(${message.type})`}`);
  console.log(`[whatsapp-agent] reply: ${reply.replace(/\n/g, " | ")}`);
  await deliverText(message.from, reply);
}

async function deliverText(to, body) {
  if (!config.canSend) {
    console.log(`[dry-run] reply to ${to}: ${body}`);
    return;
  }
  await whatsapp.sendText(to, body);
}

async function deliverReminder(task) {
  const text = `Reminder: ${task.text}`;
  if (!config.canSend) {
    console.log(`[dry-run] ${text}`);
    return { ok: true };
  }

  try {
    if (store.isServiceWindowOpen(new Date())) {
      await whatsapp.sendText(config.ownerPhone, text);
    } else if (config.templateName) {
      await whatsapp.sendTemplate(config.ownerPhone, task.text);
    } else {
      return {
        ok: false,
        error:
          "24-hour reply window is closed. Message the bot, or set WHATSAPP_TEMPLATE_NAME for an approved reminder template.",
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function tick() {
  const results = await runReminderPass({
    store,
    now: new Date(),
    deliver: deliverReminder,
  });
  for (const result of results) {
    if (result.ok) console.log(`[whatsapp-agent] reminded #${result.id}`);
    else if (result.changed) console.error(`[whatsapp-agent] reminder #${result.id} failed: ${result.error}`);
  }
}

if (config.canSend && !config.ownerPhone) {
  console.error("[whatsapp-agent] Set OWNER_PHONE to your own number before live sending.");
  process.exit(1);
}

const timer = setInterval(() => {
  tick().catch((error) => console.error("[whatsapp-agent] scheduler error:", error.message));
}, 15_000);
timer.unref();

app.listen(config.port, () => {
  console.log(`[whatsapp-agent] listening on http://localhost:${config.port}`);
  console.log(`[whatsapp-agent] webhook http://localhost:${config.port}/webhook`);
  console.log(`[whatsapp-agent] mode: ${config.canSend ? "live WhatsApp" : "dry-run (set WHATSAPP_TOKEN and PHONE_NUMBER_ID to send)"}`);
  console.log(`[whatsapp-agent] owner: ${config.ownerPhone || "not set"}`);
  if (config.canSend && !config.templateName) {
    console.log("[whatsapp-agent] no template set. Reminders work as normal text only within 24 hours of your last message.");
  }
});
