// The signup gateway builds its backend POST server-side, so nothing sets an
// Origin on it. The API's CSRF middleware refuses state-changing requests that
// carry neither Origin nor Referer, so without forwarding the caller's, account
// creation 403s.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@lib/saas", () => ({
  isSaaSMode: async () => false,
  isCustomDomainRequest: async () => false,
}));
mock.module("@lib/turnstile", () => ({
  verifyTurnstile: async () => ({ ok: true }),
  clientIpFromHeaders: () => "203.0.113.7",
}));
mock.module("@services/emails/disposableEmail", () => ({
  validateSignupEmail: async () => ({ ok: true }),
}));
mock.module("@services/emails/loops", () => ({
  addContactWithLoops: async () => {},
  sendLoopsEvent: async () => {},
  LOOPS_SIGNED_USERS_GROUP: "signed",
}));

const { NextRequest } = await import("next/server");
const { POST } = await import("../app/api/signup/route.ts");

const ORIGIN = "https://learn.example.test";
const REFERER = `${ORIGIN}/signup`;

let calls;
let originalFetch;

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function signupRequest(headers = {}) {
  return new NextRequest("http://localhost:3000/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      email: "learner@example.test",
      password: "a-long-enough-password",
      username: "learner",
      first_name: "Lea",
      last_name: "Rner",
    }),
  });
}

const sentHeader = (init, name) => new Headers(init.headers).get(name);

describe("signup forwards the caller's origin context to the API", () => {
  test("relays Origin and Referer on the backend POST", async () => {
    await POST(signupRequest({ origin: ORIGIN, referer: REFERER }));
    const backend = calls.find((c) => c.init?.method === "POST");
    expect(backend).toBeDefined();
    expect(sentHeader(backend.init, "origin")).toBe(ORIGIN);
    expect(sentHeader(backend.init, "referer")).toBe(REFERER);
  });

  test("keeps the JSON content type and body", async () => {
    await POST(signupRequest({ origin: ORIGIN }));
    const backend = calls.find((c) => c.init?.method === "POST");
    expect(sentHeader(backend.init, "Content-Type")).toBe("application/json");
    expect(JSON.parse(backend.init.body).email).toBe("learner@example.test");
  });

  test("does not synthesise an origin when the caller sent none", async () => {
    await POST(signupRequest({}));
    const backend = calls.find((c) => c.init?.method === "POST");
    expect(sentHeader(backend.init, "origin")).toBeNull();
    expect(sentHeader(backend.init, "referer")).toBeNull();
  });
});
