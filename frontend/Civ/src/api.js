// Single place for the backend URL and the auth token.
// Override the URL locally with VITE_API_URL=http://localhost:8000 in .env.local

export const API_URL = import.meta.env.VITE_API_URL ?? "https://globe-2-i1ty.onrender.com";

const TOKEN_KEY = "token";
const USERNAME_KEY = "username";

export function saveSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function hasToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY);
}

// FastAPI sends `detail` as a string for HTTPException and as a list of
// {loc, msg} objects for validation errors. Turn either into toast text.
export function errorMessage(data, fallback = "Something went wrong") {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const { loc = [], msg = fallback } = detail[0];
    const field = loc[loc.length - 1];
    return typeof field === "string" ? `${field}: ${msg}` : msg;
  }
  return fallback;
}

// fetch() for endpoints that need the signed-in user. If the token is missing,
// expired or the account is gone, drop the session and return to the login page.
export async function authFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearSession();
    window.location.reload();
  }
  return response;
}
