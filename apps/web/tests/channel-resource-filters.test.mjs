import { describe, expect, test } from "bun:test";

import {
  normalizeChannelResourceFilters,
  buildChannelResourceQueryParams,
  getChannelResourceFilterOptions,
} from "../services/organizations/channelResourceFilters.ts";

describe("normalizeChannelResourceFilters", () => {
  test("undefined stays undefined", () => {
    expect(normalizeChannelResourceFilters(undefined)).toBeUndefined();
  });

  test("drops empty and whitespace-only values", () => {
    expect(
      normalizeChannelResourceFilters({ subject: "", level: "   ", institution_context: undefined })
    ).toBeUndefined();
  });

  test("keeps only non-empty trimmed values", () => {
    expect(
      normalizeChannelResourceFilters({ subject: "Mathematics", topic: "", level: "Form 2" })
    ).toEqual({ subject: "Mathematics", level: "Form 2" });
  });

  test("keeps institution_context, resource_type, and year filters", () => {
    expect(
      normalizeChannelResourceFilters({
        institution_context: "KCSE",
        resource_type: "Past paper",
        year: "2023",
      })
    ).toEqual({ institution_context: "KCSE", resource_type: "Past paper", year: "2023" });
  });
});

describe("buildChannelResourceQueryParams", () => {
  test("empty string when there are no active filters", () => {
    expect(buildChannelResourceQueryParams(undefined)).toBe("");
    expect(buildChannelResourceQueryParams({})).toBe("");
    expect(buildChannelResourceQueryParams({ subject: "" })).toBe("");
  });

  test("builds a query string for a single filter", () => {
    expect(buildChannelResourceQueryParams({ subject: "Mathematics" })).toBe("?subject=Mathematics");
  });

  test("builds a query string for multiple filters, URL-encoded", () => {
    const qs = buildChannelResourceQueryParams({ subject: "Math & Science", level: "Form 2" });
    expect(qs).toBe("?subject=Math+%26+Science&level=Form+2");
  });

  test("builds a query string including institution_context/resource_type/year", () => {
    const qs = buildChannelResourceQueryParams({
      institution_context: "KCSE",
      resource_type: "Past paper",
      year: "2023",
    });
    expect(qs).toBe("?institution_context=KCSE&resource_type=Past+paper&year=2023");
  });
});

describe("getChannelResourceFilterOptions", () => {
  test("empty lists when there are no resources", () => {
    expect(getChannelResourceFilterOptions(undefined)).toEqual({
      subjects: [],
      levels: [],
      institutions: [],
      resourceTypes: [],
    });
    expect(getChannelResourceFilterOptions([])).toEqual({
      subjects: [],
      levels: [],
      institutions: [],
      resourceTypes: [],
    });
  });

  test("returns distinct, alphabetically-sorted values and ignores blanks", () => {
    const resources = [
      { subject: "Chemistry", level: "Form 3", institution_context: "KCSE", resource_type: "Notes" },
      { subject: "Mathematics", level: "Form 2", institution_context: "KCSE", resource_type: "Past paper" },
      { subject: "Mathematics", level: "Form 2", institution_context: "KCSE", resource_type: "Past paper" },
      { subject: null, level: "Form 1", institution_context: "", resource_type: null },
    ];
    expect(getChannelResourceFilterOptions(resources)).toEqual({
      subjects: ["Chemistry", "Mathematics"],
      levels: ["Form 1", "Form 2", "Form 3"],
      institutions: ["KCSE"],
      resourceTypes: ["Notes", "Past paper"],
    });
  });
});
