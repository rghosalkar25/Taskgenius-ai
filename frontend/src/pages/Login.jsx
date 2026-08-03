import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm rounded-2xl backdrop-blur-md bg-slate-900/70 border border-slate-700/50 p-7">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-slate-100 leading-none">
              TaskGenius AI
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Welcome back</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500/60 transition-colors"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl bg-slate-800/60 border border-slate-700/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500/60 transition-colors"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-sm font-medium px-3.5 py-2.5 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Log in
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-5 text-center">
          Don't have an account?{" "}
          <button onClick={onSwitch} className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
