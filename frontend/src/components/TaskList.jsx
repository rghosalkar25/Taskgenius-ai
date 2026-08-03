import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Trash2, Check, Repeat, ChevronDown, ChevronRight, Plus, CornerDownLeft, Maximize2 } from "lucide-react";
import { api } from "../lib/api";

const FILTERS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "high_priority", label: "High Priority" },
  { key: "completed", label: "Completed" },
];

const PRIORITY_DOT = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-emerald-400",
};

const CATEGORY_PILL = {
  study: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  work: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  personal: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  health: "bg-green-500/15 text-green-300 border-green-500/30",
  finance: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  general: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

/**
 * TaskList
 * ---------
 * Props:
 *   tasks: TaskOut[]            — already-fetched top-level tasks (with nested subtasks)
 *   activeFilter: string
 *   onFilterChange(key: string)
 *   onTaskChanged()             — callback to trigger a refetch after complete/delete/subtask-add
 */
export default function TaskList({ tasks, activeFilter, onFilterChange, onTaskChanged, onOpenDetail }) {
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleComplete = async (task) => {
    setBusyId(task.id);
    try {
      await api.patch(`/api/tasks/${task.id}`, { is_completed: !task.is_completed });
      onTaskChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const deleteTask = async (task) => {
    setBusyId(task.id);
    try {
      await api.delete(`/api/tasks/${task.id}`);
      onTaskChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeFilter === f.key
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {tasks.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-500 text-sm italic py-6 text-center"
            >
              Nothing here yet.
            </motion.p>
          )}

          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              busyId={busyId}
              expanded={expanded.has(task.id)}
              onToggleExpanded={() => toggleExpanded(task.id)}
              onToggleComplete={() => toggleComplete(task)}
              onDelete={() => deleteTask(task)}
              onTaskChanged={onTaskChanged}
              onSubtaskAction={setBusyId}
              onOpenDetail={() => onOpenDetail?.(task.id)}
              onOpenDetailById={onOpenDetail}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TaskCard({ task, busyId, expanded, onToggleExpanded, onToggleComplete, onDelete, onTaskChanged, onSubtaskAction, onOpenDetail, onOpenDetailById }) {
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const hasSubtasks = (task.subtasks ?? []).length > 0;

  const submitSubtask = async (e) => {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    onSubtaskAction(task.id);
    try {
      await api.post("/api/tasks/", { text: subtaskText.trim(), parent_id: task.id });
      setSubtaskText("");
      setAddingSubtask(false);
      onTaskChanged?.();
    } finally {
      onSubtaskAction(null);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl backdrop-blur-md bg-slate-900/70 border border-slate-700/50 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {hasSubtasks ? (
          <button onClick={onToggleExpanded} className="shrink-0 text-slate-500 hover:text-slate-300">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <button
          onClick={onToggleComplete}
          disabled={busyId === task.id}
          aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
            task.is_completed
              ? "bg-indigo-600 border-indigo-500"
              : "border-slate-600 hover:border-indigo-400"
          }`}
        >
          {task.is_completed && <Check className="w-3 h-3 text-white" />}
        </button>

        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.low}`} />

        <div className="flex-1 min-w-0">
          <p
            onClick={onOpenDetail}
            className={`text-sm font-medium truncate cursor-pointer hover:text-indigo-300 transition-colors ${
              task.is_completed ? "text-slate-500 line-through" : "text-slate-100"
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.due_date && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3" /> {task.due_date}
              </span>
            )}
            {task.due_time && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" /> {task.due_time.slice(0, 5)}
              </span>
            )}
            {task.recurrence && task.recurrence !== "none" && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-400">
                <Repeat className="w-3 h-3" /> {task.recurrence}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                CATEGORY_PILL[task.category] ?? CATEGORY_PILL.general
              }`}
            >
              {task.category}
            </span>
            {(task.tags ?? []).map((tag) => (
              <span key={tag} className="text-[11px] text-slate-500">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={onOpenDetail}
          aria-label="Open task details"
          className="shrink-0 text-slate-600 hover:text-indigo-400 transition-colors p-1"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setAddingSubtask((v) => !v)}
          aria-label="Add subtask"
          className="shrink-0 text-slate-600 hover:text-indigo-400 transition-colors p-1"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          onClick={onDelete}
          disabled={busyId === task.id}
          aria-label="Delete task"
          className="shrink-0 text-slate-600 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {addingSubtask && (
        <form onSubmit={submitSubtask} className="flex items-center gap-2 px-4 pb-3 pl-11">
          <input
            autoFocus
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
            placeholder="Subtask..."
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500/60"
          />
          <button type="submit" className="text-indigo-400 hover:text-indigo-300 p-1">
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      <AnimatePresence>
        {expanded && hasSubtasks && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-slate-800/70"
          >
            <div className="flex flex-col divide-y divide-slate-800/70">
              {task.subtasks.map((sub) => (
                <SubtaskRow key={sub.id} subtask={sub} onTaskChanged={onTaskChanged} onOpenDetail={() => onOpenDetailById?.(sub.id)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SubtaskRow({ subtask, onTaskChanged, onOpenDetail }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/tasks/${subtask.id}`, { is_completed: !subtask.is_completed });
      onTaskChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/tasks/${subtask.id}`);
      onTaskChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 pl-11 pr-4 py-2.5">
      <button
        onClick={toggle}
        disabled={busy}
        className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
          subtask.is_completed ? "bg-indigo-600 border-indigo-500" : "border-slate-600 hover:border-indigo-400"
        }`}
      >
        {subtask.is_completed && <Check className="w-2.5 h-2.5 text-white" />}
      </button>
      <span
        onClick={onOpenDetail}
        className={`flex-1 text-xs truncate cursor-pointer hover:text-indigo-300 transition-colors ${
          subtask.is_completed ? "text-slate-500 line-through" : "text-slate-300"
        }`}
      >
        {subtask.title}
      </span>
      <button onClick={remove} disabled={busy} className="text-slate-600 hover:text-red-400 p-0.5">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
