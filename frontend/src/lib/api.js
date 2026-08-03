/**
 * lib/api.js
 * -----------
 * Thin fetch wrapper that attaches the JWT bearer token to every request
 * and centralizes the API base URL. On a 401 (expired/invalid token) it
 * clears the stored session and reloads to bounce the user back to login.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "taskgenius_token";
const USER_KEY = "taskgenius_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Don't force JSON content-type for form-encoded bodies (used by /login)
  if (!(options.body instanceof URLSearchParams) && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && path !== "/api/auth/login") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.reload();
  }

  return res;
}

export const api = {
  base: API_BASE,
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
  raw: request,
  tokenKey: TOKEN_KEY,
  userKey: USER_KEY,
};
