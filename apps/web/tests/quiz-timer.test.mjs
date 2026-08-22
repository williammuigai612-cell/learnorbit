import { afterEach, describe, expect, test } from "bun:test";

import {
  getQuizTimerState,
  formatTimerDisplay,
} from "../services/organizations/quizTimer.ts";

const START = "2026-01-01T00:00:00.000Z";
const startMs = new Date(START).getTime();

describe("getQuizTimerState — naive-UTC started_at (no trailing Z)", () => {
  // The backend's QuizAttempt.started_at is a bare `str(datetime.now(timezone.utc)
  // .replace(tzinfo=None))` — e.g. "2026-08-21 14:17:53.531993", no "Z"/offset.
  // `new Date(...)` on a space-separated, offset-less string is parsed as LOCAL
  // time by the engine, not UTC — reproduced live during 6F verification: in
  // this dev environment's local timezone (Africa/Nairobi, UTC+3), a
  // 10-minute attempt auto-submitted 0.4 *real* seconds after starting,
  // because "elapsed" was inflated by the full 3-hour offset.
  //
  // `bun test` pins TZ=UTC by default, where local-time parsing and UTC
  // parsing coincide — silently masking exactly this bug. These tests
  // override `process.env.TZ` (which Bun's Date implementation honors
  // immediately, verified directly) so the assertion is actually exercised
  // against a non-UTC local time, not just accidentally correct because the
  // runner happens to be UTC.
  const naiveStart = "2026-01-01 00:00:00.000000";
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  test("a timezone ahead of UTC (e.g. Africa/Nairobi, +3) does not shift the parsed instant", () => {
    process.env.TZ = "Africa/Nairobi";
    const state = getQuizTimerState(naiveStart, 10, startMs);
    expect(state.remainingSeconds).toBe(600);
    expect(state.expired).toBe(false);
  });

  test("a timezone behind UTC (e.g. America/New_York) does not shift it either", () => {
    process.env.TZ = "America/New_York";
    const state = getQuizTimerState(naiveStart, 10, startMs);
    expect(state.remainingSeconds).toBe(600);
    expect(state.expired).toBe(false);
  });

  test("an already-offset string (Z) is unaffected by local timezone too", () => {
    process.env.TZ = "Africa/Nairobi";
    const state = getQuizTimerState("2026-01-01T00:00:00.000Z", 10, startMs);
    expect(state.remainingSeconds).toBe(600);
  });
});

describe("getQuizTimerState", () => {
  test("full time remaining right at start", () => {
    const state = getQuizTimerState(START, 10, startMs);
    expect(state.totalSeconds).toBe(600);
    expect(state.remainingSeconds).toBe(600);
    expect(state.expired).toBe(false);
    expect(state.urgency).toBe("normal");
  });

  test("counts down as time elapses", () => {
    const state = getQuizTimerState(START, 10, startMs + 60_000);
    expect(state.remainingSeconds).toBe(540);
    expect(state.expired).toBe(false);
  });

  test("clamps to zero and reports expired once time is up", () => {
    const state = getQuizTimerState(START, 10, startMs + 700_000);
    expect(state.remainingSeconds).toBe(0);
    expect(state.expired).toBe(true);
    expect(state.urgency).toBe("destructive");
  });

  test("exactly at the deadline is expired", () => {
    const state = getQuizTimerState(START, 10, startMs + 600_000);
    expect(state.remainingSeconds).toBe(0);
    expect(state.expired).toBe(true);
  });

  test("urgency is normal well before the warning threshold", () => {
    // 10 min total -> warning threshold is min(300, 20%) = 120s
    const state = getQuizTimerState(START, 10, startMs + (600 - 121) * 1000);
    expect(state.urgency).toBe("normal");
  });

  test("urgency shifts to warning inside the final-period threshold", () => {
    const state = getQuizTimerState(START, 10, startMs + (600 - 120) * 1000);
    expect(state.remainingSeconds).toBe(120);
    expect(state.urgency).toBe("warning");
  });

  test("urgency shifts to destructive inside the last-seconds threshold", () => {
    // 10 min total -> destructive threshold is min(30, 10%) = 30s
    const state = getQuizTimerState(START, 10, startMs + (600 - 30) * 1000);
    expect(state.remainingSeconds).toBe(30);
    expect(state.urgency).toBe("destructive");
  });

  test("short time limits scale thresholds proportionally", () => {
    // 1 min total -> destructive threshold is min(30, 10%=6s) = 6s, warning min(300, 20%=12s) = 12s
    const atWarning = getQuizTimerState(START, 1, startMs + (60 - 12) * 1000);
    expect(atWarning.urgency).toBe("warning");
    const atDestructive = getQuizTimerState(START, 1, startMs + (60 - 6) * 1000);
    expect(atDestructive.urgency).toBe("destructive");
  });
});

describe("formatTimerDisplay", () => {
  test("formats minutes and seconds, zero-padded", () => {
    expect(formatTimerDisplay(65)).toBe("01:05");
  });

  test("formats zero as 00:00", () => {
    expect(formatTimerDisplay(0)).toBe("00:00");
  });

  test("includes hours once remaining time reaches an hour", () => {
    expect(formatTimerDisplay(3661)).toBe("1:01:01");
  });

  test("floors fractional seconds and never goes negative", () => {
    expect(formatTimerDisplay(59.9)).toBe("00:59");
    expect(formatTimerDisplay(-5)).toBe("00:00");
  });
});
