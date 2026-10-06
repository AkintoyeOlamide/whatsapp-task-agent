import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { handleMessage } from "../src/agent.js";
import { parseWhen } from "../src/parse.js";
import { runReminderPass } from "../src/scheduler.js";
import { createStore } from "../src/store.js";
import { incomingTexts, verifySignature } from "../src/whatsapp.js";
import crypto from "node:crypto";

function tempStore() {
  const file = path.join(os.tmpdir(), `tasks-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  return { store: createStore(file), file };
}

test("saves a clock time and lists it", () => {
  const { store, file } = tempStore();
  const now = new Date(2026, 9, 6, 15, 0, 0);
  const reply = handleMessage("add Buy milk at 18:30", store, now);
  assert.match(reply, /Saved #1: Buy milk/);
  assert.match(reply, /6:30 PM/);
  assert.match(handleMessage("list", store, now), /#1 pending/);
  fs.rmSync(file, { force: true });
});

test("rolls a past clock time to tomorrow", () => {
  const { store, file } = tempStore();
  const now = new Date(2026, 9, 6, 19, 0, 0);
  const reply = handleMessage("remind me to call mom at 18:30", store, now);
  assert.match(reply, /has passed/);
  assert.match(reply, /Saved #1/);
  fs.rmSync(file, { force: true });
});

test("rejects an explicit today time that already passed", () => {
  const when = parseWhen("today 09:00", new Date(2026, 9, 6, 15, 0, 0));
  assert.equal(when.error, "That time today has already passed.");
});

test("parses relative, dated, and daily reminders", () => {
  const { store, file } = tempStore();
  const now = new Date(2026, 9, 6, 15, 0, 0);
  assert.match(handleMessage("add Stretch in 30m", store, now), /3:30 PM/);
  assert.match(handleMessage("add Pay rent at 2026-10-07 09:00", store, now), /Saved #2/);
  assert.match(handleMessage("add Vitamins at 08:00 daily", store, now), /every day/);
  assert.match(handleMessage("done 1", store, now), /Marked #1 done/);
  assert.match(handleMessage("delete 2", store, now), /Deleted #2/);
  assert.doesNotMatch(handleMessage("list", store, now), /Stretch|Pay rent/);
  assert.match(handleMessage("list", store, now), /Vitamins/);
  fs.rmSync(file, { force: true });
});

test("unknown text gets a reply instead of silence", () => {
  const { store, file } = tempStore();
  assert.match(handleMessage("what is the weather", store), /Send help/);
  fs.rmSync(file, { force: true });
});

test("scheduler sends a due reminder once", async () => {
  const { store, file } = tempStore();
  const now = new Date(2026, 9, 6, 15, 0, 0);
  handleMessage("add Stretch in 30m", store, now);
  const sent = [];
  const later = new Date(now.getTime() + 31 * 60 * 1000);

  const first = await runReminderPass({
    store,
    now: later,
    deliver: async (task) => {
      sent.push(task.text);
      return { ok: true };
    },
  });
  const second = await runReminderPass({
    store,
    now: later,
    deliver: async () => {
      sent.push("again");
      return { ok: true };
    },
  });

  assert.deepEqual(sent, ["Stretch"]);
  assert.equal(first[0].ok, true);
  assert.equal(second.length, 0);
  assert.match(handleMessage("list", store, later), /reminded/);
  fs.rmSync(file, { force: true });
});

test("daily reminder is scheduled again after it sends", async () => {
  const { store, file } = tempStore();
  const now = new Date(2026, 9, 6, 7, 0, 0);
  handleMessage("add Vitamins at 08:00 daily", store, now);
  const due = new Date(2026, 9, 6, 8, 0, 1);

  await runReminderPass({
    store,
    now: due,
    deliver: async () => ({ ok: true }),
  });

  const [task] = store.list();
  assert.equal(task.status, "pending");
  assert.equal(new Date(task.remindAt).getDate(), 7);
  fs.rmSync(file, { force: true });
});

test("reads a WhatsApp webhook and checks its signature", () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { id: "wamid.1", from: "15551234567", type: "text", text: { body: "list" } },
              ],
            },
          },
        ],
      },
    ],
  };
  const messages = incomingTexts(payload);
  assert.equal(messages[0].text, "list");

  const raw = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${crypto.createHmac("sha256", "secret").update(raw).digest("hex")}`;
  assert.equal(verifySignature(raw, signature, "secret"), true);
  assert.equal(verifySignature(raw, signature, "other"), false);
});
