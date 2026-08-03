import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Calendar, Clock, Flag, Tag, Repeat, CornerDownLeft, Loader2 } from "lucide-react";
import { api } from "../lib/api";

// Tailwind color -> class lookups (kept static so Tailwind's JIT can see them)
const PRIORITY_STYLES = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const CATEGORY_STYLES = {
  study: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  work: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  personal: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  health: "bg-green-500/15 text-green-300 border-green-500/30",
  finance: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  general: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

/**
 * SmartInputBar
 * ---------------
 * A command-bar style input that calls POST /api/tasks/parse on every
 * keystroke (debounced) and renders live preview pills for the detected
 * date, time, priority, category, tags, and recurrence — before the task
 * is even submitted.
 *
 * Supports inline syntax:
 *   #tag             -> adds a tag
 *   every Monday      -> weekly recurrence + next Monday's date
 *   daily / weekly     -> recurrence shorthand
 *
 * Props:
 *   onCreateTask(rawText: string) -> called when the user submits (Enter)
 */
export default function SmartInputBar({ onCreateTask }) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const fetchPreview = useCallback(async (text) => {
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post("/api/tasks/parse", { text });
      if (!res.ok) throw new Error("Could not parse task");
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(value), 350);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchPreview]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onCreateTask?.(value.trim());
    setValue("");
    setPreview(null);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative rounded-2xl backdrop-blur-md bg-slate-900/70 border border-slate-700/50 shadow-lg shadow-black/20 focus-within:border-indigo-500/60 transition-colors">
        <div className="flex items-center gap-3 px-4 py-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={'Try: "Team standup every Monday at 9am #work urgent"'}
            className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-slate-500 text-sm md:text-base"
            aria-label="Describe your task in natural language"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />}
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-1.5 transition-colors shrink-0"
          >
            Add
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live NLP preview pills */}
        <AnimatePresence>
          {preview && !error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-1 border-t border-slate-700/50 mt-1">
                {preview.due_date && (
                  <Pill icon={<Calendar className="w-3 h-3" />} className="bg-slate-500/15 text-slate-300 border-slate-500/30">
                    {preview.due_date}
                  </Pill>
                )}
                {preview.due_time && (
                  <Pill icon={<Clock className="w-3 h-3" />} className="bg-slate-500/15 text-slate-300 border-slate-500/30">
                    {preview.due_time.slice(0, 5)}
                  </Pill>
                )}
                {preview.recurrence && preview.recurrence !== "none" && (
                  <Pill icon={<Repeat className="w-3 h-3" />} className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                    {preview.recurrence}
                  </Pill>
                )}
                <Pill
                  icon={<Flag className="w-3 h-3" />}
                  className={PRIORITY_STYLES[preview.priority] ?? PRIORITY_STYLES.low}
                >
                  {preview.priority_emoji} {preview.priority_label}
                </Pill>
                <Pill
                  icon={<Tag className="w-3 h-3" />}
                  className={CATEGORY_STYLES[preview.category] ?? CATEGORY_STYLES.general}
                >
                  {preview.category_label}
                </Pill>
                {(preview.tags ?? []).map((tag) => (
                  <Pill key={tag} className="bg-slate-800/60 text-slate-400 border-slate-700/50">
                    #{tag}
                  </Pill>
                ))}
                <span className="text-xs text-slate-500 ml-auto italic truncate max-w-[40%]">
                  "{preview.title}"
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="px-4 pb-3 pt-1 text-xs text-red-400 border-t border-slate-700/50 mt-1">
            {error}
          </div>
        )}
      </div>
    </form>
  );
}

function Pill({ icon, className, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
