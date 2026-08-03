import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/**
 * useReminders
 * -------------
 * Watches a flat list of tasks and fires a browser Notification the moment
 * a task's due date/time arrives (within a 60s polling window), as long as
 * the task isn't completed and hasn't already been notified. Marks the task
 * reminder_notified=true on the backend so it won't fire twice, even across
 * refreshes.
 *
 * Returns { permission, requestPermission } so the UI can show a small
 * "enable reminders" prompt if the browser hasn't granted permission yet.
 */
export function useReminders(tasks, onTaskChanged) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const firingRef = useRef(new Set());

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  useEffect(() => {
    if (permission !== "granted") return;
    if (typeof Notification === "undefined") return;

    const interval = setInterval(() => {
      const now = new Date();

      const flatten = (list) => list.flatMap((t) => [t, ...flatten(t.subtasks ?? [])]);
      const allTasks = flatten(tasks ?? []);

      for (const task of allTasks) {
        if (task.is_completed || task.reminder_notified) continue;
        if (!task.due_date) continue;
        if (firingRef.current.has(task.id)) continue;

        const dueAt = new Date(`${task.due_date}T${task.due_time || "00:00:00"}`);
        const offsetMs = (task.reminder_offset_minutes || 0) * 60_000;
        const notifyAt = new Date(dueAt.getTime() - offsetMs);
        const diffMs = notifyAt.getTime() - now.getTime();

        // Fire once the notify moment has arrived (within a 90s window so we
        // don't miss it between polls, but don't spam old overdue tasks).
        if (diffMs <= 0 && diffMs > -90_000) {
          firingRef.current.add(task.id);
          const body = offsetMs > 0
            ? `${task.title} — due in ${Math.round(offsetMs / 60_000)} min`
            : task.title;
          new Notification("TaskGenius AI", { body, tag: task.id });
          api.patch(`/api/tasks/${task.id}`, { reminder_notified: true }).then(() => {
            onTaskChanged?.();
          });
        }
      }
    }, 20_000);

    return () => clearInterval(interval);
  }, [tasks, permission, onTaskChanged]);

  return { permission, requestPermission };
}
