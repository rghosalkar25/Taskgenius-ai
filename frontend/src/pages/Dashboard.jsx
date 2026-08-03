import { useState, useEffect, useCallback } from "react";
import { Sparkles, LogOut, Bell } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import SmartInputBar from "../components/SmartInputBar";
import TaskList from "../components/TaskList";
import Analytics from "../components/Analytics";
import TaskDetailModal from "../components/TaskDetailModal";
import { useAuth } from "../context/AuthContext";
import { useReminders } from "../hooks/useReminders";
import { api } from "../lib/api";

function findTaskById(tasks, id) {
  for (const t of tasks) {
    if (t.id === id) return t;
    const found = findTaskById(t.subtasks ?? [], id);
    if (found) return found;
  }
  return null;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeFilter, setActiveFilter] = useState("today");
  const [error, setError] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const fetchTasks = useCallback(async (filter) => {
    try {
      const res = await api.get(`/api/tasks/?filter=${filter}`);
      if (!res.ok) throw new Error("Failed to load tasks");
      setTasks(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get("/api/analytics/summary");
      if (!res.ok) throw new Error("Failed to load analytics");
      setSummary(await res.json());
    } catch {
      // analytics failures shouldn't block the rest of the dashboard
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchTasks(activeFilter);
    fetchSummary();
  }, [activeFilter, fetchTasks, fetchSummary]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const { permission, requestPermission } = useReminders(tasks, refreshAll);

  const handleCreateTask = async (text) => {
    try {
      const res = await api.post("/api/tasks/", { text });
      if (!res.ok) throw new Error("Failed to create task");
      refreshAll();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-4 py-10 md:py-14">
        <header className="flex items-center justify-between gap-2.5 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-slate-100 leading-none">
                TaskGenius AI
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {user?.display_name ? `Welcome back, ${user.display_name}` : "Smart NLP-based task planning"}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-900/60"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </header>

        {permission === "default" && (
          <button
            onClick={requestPermission}
            className="w-full mb-6 flex items-center gap-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 px-4 py-2.5 text-xs text-indigo-300 hover:bg-indigo-500/15 transition-colors text-left"
          >
            <Bell className="w-3.5 h-3.5 shrink-0" />
            Enable browser notifications to get reminded the moment a task is due.
          </button>
        )}

        <div className="mb-8">
          <SmartInputBar onCreateTask={handleCreateTask} />
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
          <TaskList
            tasks={tasks}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onTaskChanged={refreshAll}
            onOpenDetail={setSelectedTaskId}
          />
          <Analytics summary={summary} />
        </div>
      </div>

      <AnimatePresence>
        {selectedTaskId && findTaskById(tasks, selectedTaskId) && (
          <TaskDetailModal
            task={findTaskById(tasks, selectedTaskId)}
            onClose={() => setSelectedTaskId(null)}
            onTaskChanged={refreshAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
