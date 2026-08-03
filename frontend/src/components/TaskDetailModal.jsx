import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, Clock, Bell, Repeat, Tag, FileText, Trash2, Check,
  Plus, CornerDownLeft, Play, Pause, Square, Timer,
} from "lucide-react";
import { api } from "../lib/api";

const CATEGORIES = ["study", "work", "personal", "health", "finance", "general"];
const PRIORITIES = ["high", "medium", "low"];
const RECURRENCE_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const REMINDER_OFFSETS = [
  { value: 0, label: "At due time" },
  { value: 5, label: "5 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * TaskDetailModal
 * -----------------
 * Full editor for a single task: title, notes, due date/time, custom
 * reminder offset, recurrence, priority, category, tags, subtasks, and
 * a Focus Timer that logs real time spent to the backend.
 *
 * Props:
 *   task: TaskOut
 *   onClose()
 *   onTaskChanged()  -> triggers a refetch in the parent dashboard
 */
export default function TaskDetailModal({ task, onClose, onTaskChanged }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [dueTime, setDueTime] = useState(task.due_time ? task.due_time.slice(0, 5) : "");
  const [reminderOffset, setReminderOffset] = useState(task.reminder_offset_minutes ?? 0);
  const [recurrence, setRecurrence] = useState(task.recurrence || "none");
  const [priority, setPriority] = useState(task.priority);
  const [category, setCategory] = useState(task.category);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(task.tags || []);
  const [subtaskText, setSubtaskText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // --- Focus Timer -------------------------------------------------------
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds accrued this session, not yet flushed
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const flushTimer = async () => {
    if (elapsed < 1) return;
    const toLog = elapsed;
    setElapsed(0);
    try {
      await api.post(`/api/tasks/${task.id}/log-time`, { seconds: toLog });
      onTaskChanged?.();
    } catch {
      // if it fails, put the time back so it isn't silently lost
      setElapsed((e) => e + toLog);
    }
  };

  const stopTimer = async () => {
    setIsRunning(false);
    await flushTimer();
  };

  // --------------------------------------------------------------------- //

  const markField = (setter) => (val) => {
    setter(val);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/tasks/${task.id}`, {
        title,
        notes,
        due_date: dueDate || null,
        due_time: dueTime ? `${dueTime}:00` : null,
        reminder_offset_minutes: reminderOffset,
        recurrence,
        priority,
        category,
        tags,
      });
      setDirty(false);
      onTaskChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (isRunning) await stopTimer();
    if (dirty) await save();
    onClose();
  };

  const addTag = (e) => {
    e.preventDefault();
    const clean = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags((t) => [...t, clean]);
      setDirty(true);
    }
    setTagInput("");
  };

  const removeTag = (tag) => {
    setTags((t) => t.filter((x) => x !== tag));
    setDirty(true);
  };

  const toggleComplete = async () => {
    await api.patch(`/api/tasks/${task.id}`, { is_completed: !task.is_completed });
    onTaskChanged?.();
  };

  const deleteTask = async () => {
    await api.delete(`/api/tasks/${task.id}`);
    onTaskChanged?.();
    onClose();
  };

  const addSubtask = async (e) => {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    await api.post("/api/tasks/", { text: subtaskText.trim(), parent_id: task.id });
    setSubtaskText("");
    onTaskChanged?.();
  };

  const toggleSubtask = async (sub) => {
    await api.patch(`/api/tasks/${sub.id}`, { is_completed: !sub.is_completed });
    onTaskChanged?.();
  };

  const deleteSubtask = async (sub) => {
    await api.delete(`/api/tasks/${sub.id}`);
    onTaskChanged?.();
  };

  const totalTimeDisplay = formatDuration((task.time_spent_seconds || 0) + elapsed);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg my-8 rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl shadow-black/40"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <button
            onClick={toggleComplete}
            className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
              task.is_completed ? "bg-indigo-600 border-indigo-500" : "border-slate-600 hover:border-indigo-400"
            }`}
          >
            {task.is_completed && <Check className="w-3 h-3 text-white" />}
          </button>
          <input
            value={title}
            onChange={(e) => markField(setTitle)(e.target.value)}
            className={`flex-1 mx-3 bg-transparent outline-none text-slate-100 font-display font-semibold text-base ${
              task.is_completed ? "line-through text-slate-500" : ""
            }`}
          />
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {/* Category + Priority */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 block">Category</label>
              <select
                value={category}
                onChange={(e) => markField(setCategory)(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => markField(setPriority)(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Focus Timer */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">{totalTimeDisplay} logged</p>
                <p className="text-[11px] text-slate-500">Focus timer</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setIsRunning(false); flushTimer(); }}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-1.5 transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                  <button
                    onClick={stopTimer}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Due date / time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => markField(setDueDate)(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60 [color-scheme:dark]"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => {
                  markField(setDueTime)(e.target.value);
                  if (!e.target.value) markField(setReminderOffset)(0);
                }}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Reminder + Repeat */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                <Bell className="w-3 h-3" /> Reminder
              </label>
              {dueTime ? (
                <select
                  value={reminderOffset}
                  onChange={(e) => markField(setReminderOffset)(Number(e.target.value))}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60"
                >
                  {REMINDER_OFFSETS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-slate-800/20 border border-dashed border-slate-700/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 italic">
                  Set a time to enable
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                <Repeat className="w-3 h-3" /> Repeat
              </label>
              <select
                value={recurrence}
                onChange={(e) => markField(setRecurrence)(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/60"
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 text-[11px] text-slate-400"
                >
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-400">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <form onSubmit={addTag} className="inline-flex">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="add tag..."
                  className="bg-transparent border-b border-dashed border-slate-700 text-xs text-slate-300 placeholder:text-slate-600 outline-none px-1 py-0.5 w-20"
                />
              </form>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => markField(setNotes)(e.target.value)}
              rows={3}
              placeholder="Add notes..."
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/60 resize-none"
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 block">Subtasks</label>
            <div className="flex flex-col gap-1.5 mb-2">
              {(task.subtasks ?? []).map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSubtask(sub)}
                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${
                      sub.is_completed ? "bg-indigo-600 border-indigo-500" : "border-slate-600 hover:border-indigo-400"
                    }`}
                  >
                    {sub.is_completed && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm ${sub.is_completed ? "text-slate-500 line-through" : "text-slate-300"}`}>
                    {sub.title}
                  </span>
                  <button onClick={() => deleteSubtask(sub)} className="text-slate-600 hover:text-red-400 p-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addSubtask} className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <input
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                placeholder="Add a subtask..."
                className="flex-1 bg-transparent border-b border-slate-800 text-sm text-slate-300 placeholder:text-slate-600 outline-none py-1"
              />
              <button type="submit" className="text-indigo-400 hover:text-indigo-300 p-1">
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800">
          <button
            onClick={deleteTask}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete task
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium px-4 py-2 transition-colors"
          >
            {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
