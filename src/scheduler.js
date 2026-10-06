export async function runReminderPass({ store, now, deliver }) {
  const due = store.claimDue(now);
  const results = [];

  for (const task of due) {
    try {
      const result = await deliver(task);
      if (result.ok) {
        store.completeReminder(task.id, now);
        results.push({ id: task.id, ok: true });
      } else {
        const changed = store.releaseReminder(task.id, result.error);
        results.push({ id: task.id, ok: false, error: result.error, changed });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const changed = store.releaseReminder(task.id, message);
      results.push({ id: task.id, ok: false, error: message, changed });
    }
  }

  return results;
}
