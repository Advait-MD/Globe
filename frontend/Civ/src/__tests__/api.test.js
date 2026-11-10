import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch, clearSession, errorMessage, getUsername, hasToken, saveSession } from "../api.js";

describe("errorMessage", () => {
  it("passes through string details", () => {
    expect(errorMessage({ detail: "Invalid username or password" })).toBe("Invalid username or password");
  });

  it("turns FastAPI validation lists into readable text", () => {
    const data = { detail: [{ loc: ["body", "username"], msg: "String should have at least 3 characters" }] };
    expect(errorMessage(data)).toBe("username: String should have at least 3 characters");
  });

  it("falls back when the body is missing or odd", () => {
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage({ detail: [] }, "fallback")).toBe("fallback");
  });
});

describe("session + authFetch", () => {
  let reload;

  beforeEach(() => {
    localStorage.clear();
    reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("stores and clears the session", () => {
    saveSession("tok", "alice");
    expect(hasToken()).toBe(true);
    expect(getUsername()).toBe("alice");
    clearSession();
    expect(hasToken()).toBe(false);
  });

  it("sends the bearer token and a JSON content type", async () => {
    saveSession("tok", "alice");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/preference", { method: "POST", body: "{}" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/preference$/);
    expect(options.headers.Authorization).toBe("Bearer tok");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("logs out and reloads on 401 (expired or forged token)", async () => {
    saveSession("expired", "alice");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));

    await authFetch("/news");

    expect(hasToken()).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
});
