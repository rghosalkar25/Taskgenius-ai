import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
  AreaChart, Area,
} from "recharts";
import { TrendingUp, Flame, AlertTriangle, ListChecks, Timer } from "lucide-react";

const CATEGORY_HEX = {
  study: "#a78bfa",    // purple-400
  work: "#60a5fa",     // blue-400
  personal: "#fbbf24", // amber-400
  health: "#4ade80",   // green-400
  finance: "#34d399",  // emerald-400
  general: "#94a3b8",  // slate-400
};

const PRIORITY_HEX = {
  high: "#f87171",   // red-400
  medium: "#fbbf24", // amber-400
  low: "#4ade80",    // green-400
};

const TOOLTIP_STYLE = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
};

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Analytics
 * ----------
 * Props:
 *   summary: {
 *     completion_percentage, total_today, completed_today,
 *     overdue_count, current_streak,
 *     category_distribution, priority_distribution, top_tags,
 *     completion_trend, total_tasks, total_completed,
 *   } | null
 */
export default function Analytics({ summary }) {
  if (!summary) {
    return (
      <div className="rounded-2xl backdrop-blur-md bg-slate-900/70 border border-slate-700/50 p-6 h-full flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading analytics…</p>
      </div>
    );
  }

  const pct = summary.completion_percentage ?? 0;
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - pct / 100);

  const categoryData = (summary.category_distribution ?? []).map((d) => ({ name: d.category, value: d.count }));
  const priorityData = (summary.priority_distribution ?? []).map((d) => ({ name: d.priority, value: d.count }));
  const trendData = (summary.completion_trend ?? []).map((d) => ({
    day: d.date.slice(5),
    completed: d.completed,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Streak + overdue + time invested quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatChip
          icon={<Flame className="w-4 h-4 text-orange-400" />}
          label="Streak"
          value={`${summary.current_streak ?? 0}d`}
        />
        <StatChip
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          label="Overdue"
          value={summary.overdue_count ?? 0}
        />
        <StatChip
          icon={<Timer className="w-4 h-4 text-indigo-400" />}
          label="Time invested"
          value={formatDuration(summary.total_time_spent_seconds ?? 0)}
        />
      </div>

      <div className="rounded-2xl backdrop-blur-md bg-slate-900/70 border border-slate-700/50 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          <h3 className="font-display text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Productivity
          </h3>
        </div>

        {/* Completion gauge */}
        <div className="flex items-center gap-5">
          <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#6366f1"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div>
            <p className="text-3xl font-display font-bold text-slate-100">{pct}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.completed_today}/{summary.total_today} tasks done today
            </p>
          </div>
        </div>

        {/* 7-day completion trend */}
        <div>
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Last 7 days</p>
          {trendData.every((d) => d.completed === 0) ? (
            <p className="text-slate-600 text-xs italic">No completions yet this week.</p>
          ) : (
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category distribution */}
        <div>
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">By category</p>
          {categoryData.length === 0 ? (
            <p className="text-slate-600 text-xs italic">No tasks yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={48}
                      paddingAngle={2}
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={CATEGORY_HEX[entry.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 flex flex-col gap-1.5">
                {categoryData.map((entry) => (
                  <li key={entry.name} className="flex items-center gap-2 text-xs text-slate-400">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_HEX[entry.name] ?? "#94a3b8" }}
                    />
                    <span className="capitalize">{entry.name}</span>
                    <span className="ml-auto text-slate-500">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Priority breakdown */}
        <div>
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">By priority</p>
          {priorityData.length === 0 ? (
            <p className="text-slate-600 text-xs italic">No tasks yet.</p>
          ) : (
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={10}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_HEX[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top tags */}
        {(summary.top_tags ?? []).length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Top tags</p>
            <div className="flex flex-wrap gap-1.5">
              {summary.top_tags.map((t) => (
                <span
                  key={t.tag}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 text-[11px] text-slate-400"
                >
                  #{t.tag}
                  <span className="text-slate-600">{t.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-800/70">
          <ListChecks className="w-3.5 h-3.5" />
          {summary.total_completed}/{summary.total_tasks} tasks completed all-time
        </div>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value }) {
  return (
    <div className="rounded-2xl backdrop-blur-md bg-slate-900/70 border border-slate-700/50 px-4 py-3 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-lg font-display font-bold text-slate-100 leading-none">{value}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
