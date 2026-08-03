import { createContext, useCallback, useContext, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(api.userKey);
    return stored ? JSON.parse(stored) : null;
  });

  const persist = (accessToken, userData) => {
    localStorage.setItem(api.tokenKey, accessToken);
    localStorage.setItem(api.userKey, JSON.stringify(userData));
    setUser(userData);
  };

  const register = useCallback(async (email, password, displayName) => {
    const res = await api.post("/api/auth/register", {
      email,
      password,
      display_name: displayName || undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Registration failed");
    }
    const data = await res.json();
    persist(data.access_token, data.user);
  }, []);

  const login = useCallback(async (email, password) => {
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);
    const res = await api.raw("/api/auth/login", { method: "POST", body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Incorrect email or password");
    }
    const data = await res.json();
    persist(data.access_token, data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(api.tokenKey);
    localStorage.removeItem(api.userKey);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
