import { describe, expect, test } from "bun:test";

import {
  normalizeChannelVideoFilters,
  buildChannelVideoQueryParams,
  getChannelVideoFilterOptions,
} from "../services/organizations/channelVideoFilters.ts";

describe("normalizeChannelVideoFilters", () => {
  test("undefined stays undefined", () => {
    expect(normalizeChannelVideoFilters(undefined)).toBeUndefined();
  });

  test("drops empty and whitespace-only values", () => {
    expect(
      normalizeChannelVideoFilters({ subject: "", topic: "   ", level: undefined })
    ).toBeUndefined();
  });

  test("keeps only non-empty trimmed values", () => {
    expect(
      normalizeChannelVideoFilters({ subject: "Mathematics", topic: "", level: "Form 2" })
    ).toEqual({ subject: "Mathematics", level: "Form 2" });
  });
});

describe("buildChannelVideoQueryParams", () => {
  test("empty string when there are no active filters", () => {
    expect(buildChannelVideoQueryParams(undefined)).toBe("");
    expect(buildChannelVideoQueryParams({})).toBe("");
    expect(buildChannelVideoQueryParams({ subject: "" })).toBe("");
  });

  test("builds a query string for a single filter", () => {
    expect(buildChannelVideoQueryParams({ subject: "Mathematics" })).toBe("?subject=Mathematics");
  });

  test("builds a query string for multiple filters, URL-encoded", () => {
    const qs = buildChannelVideoQueryParams({ subject: "Math & Science", level: "Form 2" });
    expect(qs).toBe("?subject=Math+%26+Science&level=Form+2");
  });
});

describe("getChannelVideoFilterOptions", () => {
  test("empty lists when there are no videos", () => {
    expect(getChannelVideoFilterOptions(undefined)).toEqual({ subjects: [], topics: [], levels: [] });
    expect(getChannelVideoFilterOptions([])).toEqual({ subjects: [], topics: [], levels: [] });
  });

  test("returns distinct, alphabetically-sorted values and ignores blanks", () => {
    const videos = [
      { subject: "Chemistry", topic: "Atoms", level: "Form 3" },
      { subject: "Mathematics", topic: "Algebra", level: "Form 2" },
      { subject: "Mathematics", topic: "Algebra", level: "Form 2" },
      { subject: null, topic: "", level: "Form 1" },
    ];
    expect(getChannelVideoFilterOptions(videos)).toEqual({
      subjects: ["Chemistry", "Mathematics"],
      topics: ["Algebra", "Atoms"],
      levels: ["Form 1", "Form 2", "Form 3"],
    });
  });
});
