import fs from "node:fs";
import path from "node:path";

function emptyState() {
  return {
    nextId: 1,
    tasks: [],
    seenMessageIds: [],
    serviceWindowUntil: null,
  };
}

export function createStore(filePath) {
  function load() {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return { ...emptyState(), ...JSON.parse(raw) };
    } catch (error) {
      if (error.code === "ENOENT") return emptyState();
      throw error;
    }
  }

  function save(state) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function recover() {
    const state = load();
    let changed = false;
    for (const task of state.tasks) {
      if (task.status === "sending") {
        task.status = "pending";
        changed = true;
      }
    }
    if (changed) save(state);
  }

  recover();

  return {
    list() {
      return load().tasks.filter((task) => task.status !== "done");
    },

    add({ text, remindAt, repeat }) {
      const state = load();
      const task = {
        id: state.nextId++,
        text,
        remindAt,
        repeat: repeat || null,
        status: "pending",
        createdAt: new Date().toISOString(),
        lastRemindedAt: null,
        lastError: null,
      };
      state.tasks.push(task);
      save(state);
      return task;
    },

    markDone(id) {
      const state = load();
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return null;
      task.status = "done";
      save(state);
      return task;
    },

    remove(id) {
      const state = load();
      const index = state.tasks.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const [task] = state.tasks.splice(index, 1);
      save(state);
      return task;
    },

    claimDue(now) {
      const state = load();
      const due = [];
      for (const task of state.tasks) {
        if (task.status === "pending" && Date.parse(task.remindAt) <= now.getTime()) {
          task.status = "sending";
          due.push({ ...task });
        }
      }
      if (due.length > 0) save(state);
      return due;
    },

    completeReminder(id, now) {
      const state = load();
      const task = state.tasks.find((item) => item.id === id);
      if (!task || task.status !== "sending") return;
      task.lastRemindedAt = now.toISOString();
      task.lastError = null;
      if (task.repeat === "daily") {
        task.remindAt = nextDaily(task.remindAt, now);
        task.status = "pending";
      } else {
        task.status = "reminded";
      }
      save(state);
    },

    releaseReminder(id, errorMessage) {
      const state = load();
      const task = state.tasks.find((item) => item.id === id);
      if (!task || task.status !== "sending") return false;
      const changed = task.lastError !== errorMessage;
      task.status = "pending";
      task.lastError = errorMessage;
      save(state);
      return changed;
    },

    hasSeen(messageId) {
      return load().seenMessageIds.includes(messageId);
    },

    markSeen(messageId) {
      const state = load();
      if (state.seenMessageIds.includes(messageId)) return;
      state.seenMessageIds.push(messageId);
      state.seenMessageIds = state.seenMessageIds.slice(-500);
      save(state);
    },

    openServiceWindow(now) {
      const state = load();
      state.serviceWindowUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      save(state);
    },

    isServiceWindowOpen(now) {
      const until = load().serviceWindowUntil;
      return Boolean(until) && Date.parse(until) > now.getTime();
    },
  };
}

function nextDaily(remindAt, now) {
  const next = new Date(remindAt);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getTime() <= now.getTime());
  return next.toISOString();
}
