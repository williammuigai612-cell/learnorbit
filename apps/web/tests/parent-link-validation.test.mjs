import { describe, expect, test } from "bun:test";

import { validateChildUsername } from "../lib/parentLinks/validation.ts";

describe("validateChildUsername", () => {
  test("rejects an empty value", () => {
    expect(validateChildUsername("", "parent1")).toBe("Enter a username");
  });

  test("rejects a whitespace-only value", () => {
    expect(validateChildUsername("   ", "parent1")).toBe("Enter a username");
  });

  test("rejects linking your own username", () => {
    expect(validateChildUsername("parent1", "parent1")).toBe(
      "You can't link your own account"
    );
  });

  test("rejects your own username regardless of case", () => {
    expect(validateChildUsername("Parent1", "parent1")).toBe(
      "You can't link your own account"
    );
  });

  test("accepts a different username", () => {
    expect(validateChildUsername("child1", "parent1")).toBeNull();
  });

  test("accepts a different username with surrounding whitespace", () => {
    expect(validateChildUsername("  child1  ", "parent1")).toBeNull();
  });
});
