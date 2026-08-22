import { describe, expect, test } from "bun:test";

import {
  normalizeQuizFilters,
  buildQuizQueryParams,
  getQuizFilterOptions,
  applyPublishedFilter,
} from "../services/organizations/quizFilters.ts";

describe("normalizeQuizFilters", () => {
  test("undefined stays undefined", () => {
    expect(normalizeQuizFilters(undefined)).toBeUndefined();
  });

  test("drops empty and whitespace-only values", () => {
    expect(
      normalizeQuizFilters({ subject: "", level: "   ", institution_context: undefined })
    ).toBeUndefined();
  });

  test("keeps only non-empty trimmed values", () => {
    expect(
      normalizeQuizFilters({ subject: "Mathematics", topic: "", level: "Form 2" })
    ).toEqual({ subject: "Mathematics", level: "Form 2" });
  });

  test("keeps quiz_type", () => {
    expect(normalizeQuizFilters({ quiz_type: "exam_practice" })).toEqual({
      quiz_type: "exam_practice",
    });
  });
});

describe("buildQuizQueryParams", () => {
  test("empty string when there are no active filters", () => {
    expect(buildQuizQueryParams(undefined)).toBe("");
    expect(buildQuizQueryParams({})).toBe("");
    expect(buildQuizQueryParams({ subject: "" })).toBe("");
  });

  test("builds a query string for a single filter", () => {
    expect(buildQuizQueryParams({ subject: "Mathematics" })).toBe("?subject=Mathematics");
  });

  test("builds a query string including quiz_type", () => {
    expect(buildQuizQueryParams({ subject: "Mathematics", quiz_type: "standard" })).toBe(
      "?subject=Mathematics&quiz_type=standard"
    );
  });

  test("builds a query string for multiple filters, URL-encoded", () => {
    const qs = buildQuizQueryParams({ subject: "Math & Science", level: "Form 2" });
    expect(qs).toBe("?subject=Math+%26+Science&level=Form+2");
  });
});

describe("getQuizFilterOptions", () => {
  test("empty lists when there are no quizzes", () => {
    expect(getQuizFilterOptions(undefined)).toEqual({
      subjects: [],
      levels: [],
      institutions: [],
      quizTypes: [],
    });
    expect(getQuizFilterOptions([])).toEqual({
      subjects: [],
      levels: [],
      institutions: [],
      quizTypes: [],
    });
  });

  test("returns distinct, alphabetically-sorted values and ignores blanks", () => {
    const quizzes = [
      { subject: "Chemistry", level: "Form 3", institution_context: "KCSE", quiz_type: "standard" },
      { subject: "Mathematics", level: "Form 2", institution_context: "KCSE", quiz_type: "exam_practice" },
      { subject: "Mathematics", level: "Form 2", institution_context: "KCSE", quiz_type: "exam_practice" },
      { subject: null, level: "Form 1", institution_context: "", quiz_type: null },
    ];
    expect(getQuizFilterOptions(quizzes)).toEqual({
      subjects: ["Chemistry", "Mathematics"],
      levels: ["Form 1", "Form 2", "Form 3"],
      institutions: ["KCSE"],
      quizTypes: ["exam_practice", "standard"],
    });
  });
});

describe("applyPublishedFilter", () => {
  const quizzes = [
    { id: 1, published: true },
    { id: 2, published: false },
    { id: 3, published: true },
  ];

  test("passes everything through when published is not a boolean", () => {
    expect(applyPublishedFilter(quizzes, undefined)).toEqual(quizzes);
    expect(applyPublishedFilter(undefined, undefined)).toEqual([]);
  });

  test("filters to published=true", () => {
    expect(applyPublishedFilter(quizzes, true)).toEqual([
      { id: 1, published: true },
      { id: 3, published: true },
    ]);
  });

  test("filters to published=false", () => {
    expect(applyPublishedFilter(quizzes, false)).toEqual([{ id: 2, published: false }]);
  });
});
