import { describe, expect, test } from "bun:test";

import { queryKeys } from "../lib/query/keys.ts";

/**
 * Phase 9E — cache-isolation guard for the LearnOrbit query keys.
 *
 * Server-side isolation for these resources is proven by the backend suites
 * (notifications recipient scoping, parent-link approval gating, per-org
 * predicates). This file guards the *client* half of the same properties,
 * which no backend test and no type check can see:
 *
 *   - A per-viewer key that stops varying by viewer silently turns the
 *     React Query cache into a cross-user read. Two accounts used in one
 *     browser would serve each other's notifications, home feed, or
 *     parent-link rows from cache — the API stays correct and nothing fails.
 *     `notifications.list()` with the `userId` argument dropped still
 *     type-checks (the parameter is `number | undefined`), still lints, and
 *     still renders.
 *   - An org-scoped key that stops varying by org is the same failure across
 *     channels rather than across users.
 *
 * The prefix assertions cover the invalidation contract keys.ts documents in
 * prose ("callers that invalidate with just `list(orgId)` still catch every
 * filtered variant too — invalidateQueries matches by key prefix"). That
 * contract is load-bearing for every filtered listing added in 2G-3/5C/6E,
 * and until now was asserted nowhere.
 *
 * Same rationale and shape as tests/a11y-guard.test.mjs and
 * tests/responsive-guard.test.mjs: an invariant spread across call sites
 * that no lint rule can express, asserted directly rather than by standing
 * up a DOM-rendering stack for one increment.
 */

const key = (k) => JSON.stringify(k);

// Every key factory whose result must differ per signed-in viewer, with the
// two viewer ids to compare. Adding a per-viewer resource here is the point:
// the new entry is one line, and forgetting it is what this list exists to
// make visible in review.
const perViewerKeys = {
  "feed.home": (id) => queryKeys.feed.home(id),
  "notifications.list": (id) => queryKeys.notifications.list(id),
  "notifications.unreadCount": (id) => queryKeys.notifications.unreadCount(id),
  "parentLinks.pending": (id) => queryKeys.parentLinks.pending(id),
  "parentLinks.mine": (id) => queryKeys.parentLinks.mine(id),
  "parentLinks.childProgress": (id) => queryKeys.parentLinks.childProgress(id),
};

describe("per-viewer cache keys are scoped to the viewer", () => {
  for (const [name, factory] of Object.entries(perViewerKeys)) {
    test(`${name} produces a different key for a different user`, () => {
      expect(key(factory(1))).not.toBe(key(factory(2)));
    });

    test(`${name} embeds the user id rather than hashing it away`, () => {
      // Not merely "different" — the id has to be present, so an
      // invalidation targeting one viewer can be written at all.
      expect(factory(7)).toContain(7);
    });

    test(`${name} is stable for the same user`, () => {
      expect(key(factory(3))).toBe(key(factory(3)));
    });
  }

  test("no two per-viewer resources share a key for the same user", () => {
    const keys = Object.values(perViewerKeys).map((f) => key(f(1)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("one viewer's key is never another viewer's key for any resource", () => {
    // Guards against a factory that put the id somewhere a sibling factory's
    // literal segment could coincide with.
    const mine = Object.values(perViewerKeys).map((f) => key(f(1)));
    const theirs = Object.values(perViewerKeys).map((f) => key(f(2)));
    for (const k of mine) expect(theirs).not.toContain(k);
  });
});

// Org-scoped listings: the same failure mode one level up. A key that stops
// varying by org serves channel A's moderation queue or resource list to
// channel B's admin out of cache.
const perOrgKeys = {
  "channelVideos.list": (orgId) => queryKeys.channelVideos.list(orgId),
  "channelResources.list": (orgId) => queryKeys.channelResources.list(orgId),
  "channelVideoReports.list": (orgId) => queryKeys.channelVideoReports.list(orgId),
  "questions.list": (orgId) => queryKeys.questions.list(orgId),
  "quizzes.list": (orgId) => queryKeys.quizzes.list(orgId),
  "quizProgress.org": (orgId) => queryKeys.quizProgress.org(orgId),
  "org.follow": (orgId) => queryKeys.org.follow(orgId),
};

describe("org-scoped cache keys are scoped to the channel", () => {
  for (const [name, factory] of Object.entries(perOrgKeys)) {
    test(`${name} produces a different key for a different org`, () => {
      expect(key(factory(1))).not.toBe(key(factory(2)));
    });
  }

  test("no two org-scoped resources share a key for the same org", () => {
    const keys = Object.values(perOrgKeys).map((f) => key(f(1)));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// The documented prefix contract behind every filtered listing.
const filteredListKeys = {
  "channelVideos.list": [queryKeys.channelVideos.list, { subject: "Maths" }],
  "channelResources.list": [queryKeys.channelResources.list, { resource_type: "past_paper" }],
  "questions.list": [queryKeys.questions.list, { published: true }],
  "quizzes.list": [queryKeys.quizzes.list, { quiz_type: "practice" }],
};

describe("filtered list keys stay invalidatable by the unfiltered key", () => {
  for (const [name, [factory, filters]] of Object.entries(filteredListKeys)) {
    test(`${name}: the filtered key extends the unfiltered key as a prefix`, () => {
      const base = factory(1);
      const filtered = factory(1, filters);
      expect(filtered.length).toBeGreaterThan(base.length);
      expect(filtered.slice(0, base.length)).toEqual([...base]);
    });

    test(`${name}: an empty filters object collapses back to the base key`, () => {
      // Callers pass a filters object built from optional state; when nothing
      // is selected it must not fork a second cache entry holding the same
      // unfiltered response.
      expect(key(factory(1, {}))).toBe(key(factory(1)));
      expect(key(factory(1, undefined))).toBe(key(factory(1)));
    });

    test(`${name}: two different filter sets do not share a key`, () => {
      expect(key(factory(1, filters))).not.toBe(key(factory(1, { level: "Form 4" })));
    });

    test(`${name}: the same filters under a different org still differ`, () => {
      expect(key(factory(1, filters))).not.toBe(key(factory(2, filters)));
    });
  }

  test("channelVideoReports.list: status tabs extend the unfiltered key", () => {
    const base = queryKeys.channelVideoReports.list(1);
    const open = queryKeys.channelVideoReports.list(1, "OPEN");
    expect(open.slice(0, base.length)).toEqual([...base]);
    expect(key(open)).not.toBe(key(queryKeys.channelVideoReports.list(1, "RESOLVED")));
    expect(key(queryKeys.channelVideoReports.list(1, undefined))).toBe(key(base));
  });
});

describe("quiz attempt keys keep history separable from a single attempt", () => {
  // keys.ts states this deliberately: `list` is NOT nested under `detail`'s
  // prefix, "so invalidating the list never has to know about individual
  // attempt ids". Submitting an attempt invalidates both; if `list` sat under
  // `detail`, invalidating one attempt would also drop every sibling's cache.
  test("the attempt-history key is not a prefix of a single-attempt key", () => {
    const list = queryKeys.quizAttempts.list(1, 2);
    const detail = queryKeys.quizAttempts.detail(1, 2, 3);
    expect(detail.slice(0, list.length)).not.toEqual([...list]);
  });

  test("attempts of different quizzes and different attempt ids do not collide", () => {
    expect(key(queryKeys.quizAttempts.detail(1, 2, 3))).not.toBe(
      key(queryKeys.quizAttempts.detail(1, 2, 4))
    );
    expect(key(queryKeys.quizAttempts.list(1, 2))).not.toBe(
      key(queryKeys.quizAttempts.list(1, 3))
    );
  });
});

describe("no LearnOrbit key factory collides with another", () => {
  // A single sweep over every LearnOrbit-added namespace with identical
  // arguments. Two factories returning the same array means one resource's
  // response can be served for the other — the failure that has no symptom
  // until it has a bad one.
  const namespaces = [
    "channelVideos",
    "channelResources",
    "channelVideoReports",
    "questions",
    "quizzes",
    "quizAttempts",
    "quizProgress",
    "shorts",
    "feed",
    "notifications",
    "parentLinks",
  ];

  test("every factory in the LearnOrbit namespaces yields a distinct key", () => {
    const seen = new Map();
    const collisions = [];

    for (const ns of namespaces) {
      for (const [fnName, fn] of Object.entries(queryKeys[ns])) {
        // One fixed argument list, padded to the factory's arity. Distinct
        // resources must differ on their literal segments, not only on the
        // values callers happen to pass.
        const args = Array.from({ length: fn.length }, () => 1);
        const k = key(fn(...args));
        const label = `${ns}.${fnName}`;
        if (seen.has(k)) collisions.push(`${seen.get(k)} === ${label} (${k})`);
        else seen.set(k, label);
      }
    }

    expect(collisions).toEqual([]);
  });
});
