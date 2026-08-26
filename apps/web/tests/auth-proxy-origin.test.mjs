// The auth proxy builds its outbound headers from scratch, so anything it does
// not explicitly forward is invisible to the API. It relays Origin/Referer
// because the API's CSRF middleware refuses state-changing requests without
// them — without this, POST /auth/login and /auth/refresh 403, and the
// best-effort logout DELETE fails silently while the user sees a clean logout.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const cookieJar = { entries: new Map() };
mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name) =>
      cookieJar.entries.has(name)
        ? { name, value: cookieJar.entries.get(name) }
        : undefined,
    getAll: () =>
      [...cookieJar.entries].map(([name, value]) => ({ name, value })),
    set: () => {},
    delete: () => {},
  }),
}));

const { NextRequest } = await import("next/server");
const route = await import("../app/api/auth/[...path]/route.ts");

const ORIGIN = "https://learn.example.test";
const REFERER = `${ORIGIN}/login`;

let calls;
let originalFetch;

beforeEach(() => {
  calls = [];
  cookieJar.entries = new Map();
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeRequest(path, { method = "POST", headers = {}, body = {} } = {}) {
  return new NextRequest(`http://localhost:3000/api/auth/${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const sentHeader = (init, name) => new Headers(init.headers).get(name);

describe("auth proxy forwards the caller's origin context", () => {
  test("POST /auth/login relays Origin and Referer", async () => {
    await route.POST(
      makeRequest("login", { headers: { origin: ORIGIN, referer: REFERER }, body: { email: "a@b.test" } }),
    );
    expect(calls).toHaveLength(1);
    expect(sentHeader(calls[0].init, "origin")).toBe(ORIGIN);
    expect(sentHeader(calls[0].init, "referer")).toBe(REFERER);
  });

  test("the forwarded value is the caller's, never synthesised", async () => {
    const other = "https://someone-elses.example.test";
    await route.POST(makeRequest("login", { headers: { origin: other } }));
    expect(sentHeader(calls[0].init, "origin")).toBe(other);
  });

  test("a request with no origin context is passed through unchanged", async () => {
    // The API must still be the thing that refuses it — the proxy does not
    // manufacture an origin to paper over a request that genuinely has none.
    await route.POST(makeRequest("login", {}));
    expect(calls).toHaveLength(1);
    expect(sentHeader(calls[0].init, "origin")).toBeNull();
    expect(sentHeader(calls[0].init, "referer")).toBeNull();
  });

  test("existing forwarding still works alongside it", async () => {
    await route.POST(
      makeRequest("login", {
        headers: {
          origin: ORIGIN,
          "x-forwarded-for": "203.0.113.7",
          "user-agent": "probe/1.0",
          authorization: "Bearer lh_token",
        },
      }),
    );
    const init = calls[0].init;
    expect(sentHeader(init, "x-forwarded-for")).toBe("203.0.113.7");
    expect(sentHeader(init, "user-agent")).toBe("probe/1.0");
    expect(sentHeader(init, "Authorization")).toBe("Bearer lh_token");
    expect(sentHeader(init, "Content-Type")).toBe("application/json");
    expect(sentHeader(init, "origin")).toBe(ORIGIN);
  });

  test("PUT and PATCH relay it too", async () => {
    await route.PUT(makeRequest("something", { method: "PUT", headers: { origin: ORIGIN } }));
    await route.PATCH(makeRequest("something", { method: "PATCH", headers: { origin: ORIGIN } }));
    expect(calls).toHaveLength(2);
    for (const c of calls) expect(sentHeader(c.init, "origin")).toBe(ORIGIN);
  });
});

describe("logout relays it on the best-effort backend DELETE", () => {
  test("DELETE /auth/logout carries Origin and Referer", async () => {
    cookieJar.entries.set("LH_refresh", "refresh-token-value");
    await route.DELETE(
      makeRequest("logout", { method: "DELETE", headers: { origin: ORIGIN, referer: REFERER } }),
    );
    const logout = calls.find((c) => c.url.includes("/auth/logout"));
    expect(logout).toBeDefined();
    expect(logout.init.method).toBe("DELETE");
    expect(sentHeader(logout.init, "origin")).toBe(ORIGIN);
    expect(sentHeader(logout.init, "referer")).toBe(REFERER);
  });

  test("the refresh cookie is still sent with it", async () => {
    cookieJar.entries.set("LH_refresh", "refresh-token-value");
    await route.POST(makeRequest("logout", { headers: { origin: ORIGIN } }));
    const logout = calls.find((c) => c.url.includes("/auth/logout"));
    expect(sentHeader(logout.init, "Cookie")).toContain("refresh-token-value");
  });
});
