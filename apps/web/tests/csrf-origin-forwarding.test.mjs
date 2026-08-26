// Contract tests for the origin context server-side callers must send.
//
// The API registers CSRFProtectionMiddleware, which refuses POST/PUT/PATCH/DELETE
// carrying neither Origin nor Referer. Every request built on the SERVER — route
// handlers and server actions — has no browser to set one, so each has to supply
// it explicitly. These pin that behaviour: without it, login, signup and the
// payment server actions all 403, and the logout DELETE fails silently.
//
// They also pin the negative: the shared browser helper must NOT gain an Origin.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

process.env.NEXT_PUBLIC_LEARNHOUSE_DOMAIN = "learn.example.test";
process.env.NEXT_PUBLIC_LEARNHOUSE_HTTPS = "true";
const EXPECTED_ORIGIN = "https://learn.example.test";

const { withServerOrigin, getServerOrigin } = await import(
  "../services/config/serverOrigin.ts"
);
const { RequestBodyWithAuthHeader } = await import("../services/utils/ts/requests.ts");

const TOKEN = "eyJ.fake.jwt";

let calls;
let originalFetch;

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const headerOf = (init, name) => new Headers(init.headers).get(name);

describe("serverOrigin — the server-only mechanism", () => {
  test("derives the origin from existing config, with no new env var", () => {
    expect(getServerOrigin()).toBe(EXPECTED_ORIGIN);
  });

  test("withServerOrigin adds Origin without disturbing existing headers", () => {
    const base = RequestBodyWithAuthHeader("POST", { a: 1 }, null, TOKEN);
    const wrapped = withServerOrigin(base);
    expect(headerOf(wrapped, "Origin")).toBe(EXPECTED_ORIGIN);
    expect(headerOf(wrapped, "Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headerOf(wrapped, "Content-Type")).toBe("application/json");
    expect(wrapped.method).toBe("POST");
    expect(wrapped.body).toBe(base.body);
  });

  test("does not mutate the init it was given", () => {
    const base = RequestBodyWithAuthHeader("POST", null, null, TOKEN);
    withServerOrigin(base);
    expect(new Headers(base.headers).get("Origin")).toBeNull();
  });
});

describe("the shared browser helper is unchanged", () => {
  // Origin is a forbidden header name in browsers: fetch silently drops any
  // value set here. Adding one would be dead code that reads as protection, and
  // it is why the server mechanism is a separate wrapper.
  test("RequestBodyWithAuthHeader sets no Origin", () => {
    for (const verb of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const init = RequestBodyWithAuthHeader(verb, null, null, TOKEN);
      expect(new Headers(init.headers).get("Origin")).toBeNull();
    }
  });

  test("browser callers keep credentials: include", () => {
    const init = RequestBodyWithAuthHeader("POST", null, null, TOKEN);
    expect(init.credentials).toBe("include");
  });
});

describe("payment server actions send the configured origin", () => {
  const mutations = [
    ["payments.ts", "initializePaymentConfig", (m) => m.initializePaymentConfig(1, {}, "stripe", TOKEN)],
    ["payments.ts", "deletePaymentConfig", (m) => m.deletePaymentConfig(1, "cfg_1", TOKEN)],
  ];

  for (const [file, name, invoke] of mutations) {
    test(`${file} :: ${name} carries Origin`, async () => {
      const mod = await import("../services/payments/payments.ts");
      await invoke(mod);
      expect(calls).toHaveLength(1);
      expect(headerOf(calls[0].init, "Origin")).toBe(EXPECTED_ORIGIN);
      expect(headerOf(calls[0].init, "Authorization")).toBe(`Bearer ${TOKEN}`);
    });
  }

  test("groups.ts mutations carry Origin", async () => {
    const mod = await import("../services/payments/groups.ts");
    await mod.createPaymentsGroup(1, { name: "g", description: "d" }, TOKEN);
    expect(headerOf(calls[0].init, "Origin")).toBe(EXPECTED_ORIGIN);
  });

  test("offers.ts mutations carry Origin", async () => {
    const mod = await import("../services/payments/offers.ts");
    const fn = mod.createOffer;
    await fn(1, {}, TOKEN);
    expect(headerOf(calls[0].init, "Origin")).toBe(EXPECTED_ORIGIN);
  });

  test("GET reads are left alone — only state-changing calls were wrapped", async () => {
    const mod = await import("../services/payments/payments.ts");
    await mod.getPaymentConfigs(1, TOKEN);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("GET");
    expect(headerOf(calls[0].init, "Origin")).toBeNull();
  });
});

describe("every non-GET payments call is wrapped (source contract)", () => {
  // A new mutation added later without the wrapper would 403 in production and
  // pass every behavioural test above, because nothing exercises it.
  const files = [
    "services/payments/payments.ts",
    "services/payments/groups.ts",
    "services/payments/offers.ts",
    "services/payments/providers/stripe.ts",
  ];

  for (const rel of files) {
    test(`${rel} wraps all POST/PUT/PATCH/DELETE`, async () => {
      const src = await Bun.file(new URL(`../${rel}`, import.meta.url)).text();
      const unwrapped = src
        .split("\n")
        .filter((l) => /RequestBodyWithAuthHeader\(\s*['"](POST|PUT|PATCH|DELETE)/.test(l))
        .filter((l) => !l.includes("withServerOrigin("));
      expect(unwrapped).toEqual([]);
    });
  }
});
