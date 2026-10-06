const HELP = `Commands:
add Buy milk at 18:30
add Call mom at tomorrow 09:00
add Pay rent at 2026-10-07 09:00
add Vitamins at 08:00 daily
add Stretch in 30m
list
done 1
delete 1

Times use the clock of the computer running this agent.`;

export function helpText() {
  return HELP;
}

export function parseCommand(raw) {
  const text = String(raw || "").trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase();

  if (!text) return { type: "help" };
  if (["help", "hi", "hello", "menu"].includes(lower)) return { type: "help" };
  if (lower === "list") return { type: "list" };

  const done = lower.match(/^(?:done|complete)\s+(\d+)$/);
  if (done) return { type: "done", id: Number(done[1]) };

  const removed = lower.match(/^(?:delete|remove)\s+(\d+)$/);
  if (removed) return { type: "delete", id: Number(removed[1]) };

  const added = text.match(/^(?:add|remind me to)\s+(.+)$/i);
  if (added) return parseAdd(added[1].trim());

  return {
    type: "unknown",
    reply: "I can store tasks and remind you. Send help to see commands.",
  };
}

function parseAdd(body) {
  const relative = body.match(
    /^(.*?)\s+in\s+(\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h|days?|d))(?:\s+daily)?$/i,
  );
  if (relative) {
    const task = relative[1].trim();
    const when = `in ${relative[2]}${/daily$/i.test(body) ? " daily" : ""}`;
    if (!task) return { type: "unknown", reply: "Tell me what to remind you about." };
    return { type: "add", text: task, when };
  }

  const atIndex = body.toLowerCase().lastIndexOf(" at ");
  if (atIndex === -1) {
    return {
      type: "unknown",
      reply: "Add a time. Example: add Buy milk at 18:30",
    };
  }

  const task = body.slice(0, atIndex).trim();
  const when = body.slice(atIndex + 4).trim();
  if (!task) return { type: "unknown", reply: "Tell me what to remind you about." };
  return { type: "add", text: task, when };
}

export function parseWhen(raw, now = new Date()) {
  let text = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  let repeat = null;

  if (text.endsWith(" daily")) {
    repeat = "daily";
    text = text.slice(0, -6).trim();
  }

  const relative = text.match(/^in\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const ms = unit.startsWith("m")
      ? amount * 60 * 1000
      : unit.startsWith("h")
        ? amount * 60 * 60 * 1000
        : amount * 24 * 60 * 60 * 1000;
    if (amount <= 0) return { error: "Use a time in the future, like in 30m." };
    return { date: new Date(now.getTime() + ms), repeat, rolledToNextDay: false };
  }

  text = text.replace(/^at\s+/, "");

  let dayWord = null;
  if (text.startsWith("today ")) {
    dayWord = "today";
    text = text.slice(6).trim();
  } else if (text.startsWith("tomorrow ")) {
    dayWord = "tomorrow";
    text = text.slice(9).trim();
  }

  const dated = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (dated) {
    const year = Number(dated[1]);
    const month = Number(dated[2]);
    const day = Number(dated[3]);
    const hour = Number(dated[4]);
    const minute = Number(dated[5]);
    if (hour > 23 || minute > 59) return { error: "Use a time like 18:30." };
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return { error: "That date is not valid." };
    }
    if (date.getTime() <= now.getTime()) return { error: "That time is already in the past." };
    return { date, repeat, rolledToNextDay: false };
  }

  const clock = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!clock) {
    return {
      error: "I couldn't read that time. Try 18:30, tomorrow 09:00, 2026-10-07 09:00, or in 30m.",
    };
  }

  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (hour > 23 || minute > 59) return { error: "Use a time like 18:30." };

  const date = new Date(now);
  date.setSeconds(0, 0);
  date.setHours(hour, minute, 0, 0);
  if (dayWord === "tomorrow") date.setDate(date.getDate() + 1);

  let rolledToNextDay = false;
  if (date.getTime() <= now.getTime()) {
    if (dayWord === "today") return { error: "That time today has already passed." };
    date.setDate(date.getDate() + 1);
    rolledToNextDay = true;
  }

  return { date, repeat, rolledToNextDay };
}

export function formatWhen(date) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour24 = date.getHours();
  const hour = hour24 % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, "0");
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${hour}:${minute} ${suffix}`;
}
