import { describe, expect, test } from "bun:test";

import { computeAttemptOutcome } from "../services/organizations/quizAttempts.ts";

describe("computeAttemptOutcome", () => {
  test("null when the quiz has no pass threshold", () => {
    expect(computeAttemptOutcome(90, null)).toBeNull();
    expect(computeAttemptOutcome(90, undefined)).toBeNull();
  });

  test("passed when score meets the threshold", () => {
    expect(computeAttemptOutcome(70, 70)).toBe("passed");
    expect(computeAttemptOutcome(85, 70)).toBe("passed");
  });

  test("failed when score is below the threshold", () => {
    expect(computeAttemptOutcome(69.9, 70)).toBe("failed");
    expect(computeAttemptOutcome(0, 70)).toBe("failed");
  });
});
