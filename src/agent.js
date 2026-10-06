import { formatWhen, helpText, parseCommand, parseWhen } from "./parse.js";

export function handleMessage(text, store, now = new Date()) {
  const command = parseCommand(text);

  if (command.type === "help") return helpText();
  if (command.type === "unknown") return command.reply;
  if (command.type === "list") return formatList(store.list());

  if (command.type === "done") {
    const task = store.markDone(command.id);
    return task ? `Marked #${task.id} done.` : "I don't have a task with that number.";
  }

  if (command.type === "delete") {
    const task = store.remove(command.id);
    return task ? `Deleted #${task.id}.` : "I don't have a task with that number.";
  }

  const when = parseWhen(command.when, now);
  if (when.error) return when.error;

  const task = store.add({
    text: command.text,
    remindAt: when.date.toISOString(),
    repeat: when.repeat,
  });

  const whenLabel = formatWhen(when.date);
  const timing = when.rolledToNextDay
    ? `${command.when} today has passed, so I'll remind you ${whenLabel}.`
    : `I'll remind you ${whenLabel}.`;
  const repeat = when.repeat === "daily" ? " Then I'll repeat it every day." : "";
  return `Saved #${task.id}: ${task.text}\n${timing}${repeat}`;
}

function formatList(tasks) {
  if (tasks.length === 0) {
    return "No open tasks. Try: add Buy milk at 18:30";
  }

  return tasks
    .map((task) => {
      const when = formatWhen(new Date(task.remindAt));
      return `#${task.id} ${displayStatus(task)}\n${task.text}\n${when}`;
    })
    .join("\n\n");
}

function displayStatus(task) {
  if (task.repeat === "daily" && task.status === "pending") return "daily";
  if (task.status === "sending") return "pending";
  return task.status;
}
