import { describe, expect, test } from "bun:test";

import {
  normalizeQuestionFilters,
  buildQuestionQueryParams,
  getQuestionFilterOptions,
  applyQuestionTypeFilter,
} from "../services/organizations/questionFilters.ts";

describe("normalizeQuestionFilters", () => {
  test("undefined stays undefined", () => {
    expect(normalizeQuestionFilters(undefined)).toBeUndefined();
  });

  test("drops empty and whitespace-only string values", () => {
    expect(
      normalizeQuestionFilters({ subject: "", level: "   ", institution_context: undefined })
    ).toBeUndefined();
  });

  test("keeps only non-empty trimmed string values", () => {
    expect(
      normalizeQuestionFilters({ subject: "Mathematics", topic: "", level: "Form 2" })
    ).toEqual({ subject: "Mathematics", level: "Form 2" });
  });

  test("keeps published=false (not droppable like an empty string)", () => {
    expect(normalizeQuestionFilters({ published: false })).toEqual({ published: false });
  });

  test("keeps published=true alongside string filters", () => {
    expect(normalizeQuestionFilters({ subject: "Mathematics", published: true })).toEqual({
      subject: "Mathematics",
      published: true,
    });
  });
});

describe("buildQuestionQueryParams", () => {
  test("empty string when there are no active filters", () => {
    expect(buildQuestionQueryParams(undefined)).toBe("");
    expect(buildQuestionQueryParams({})).toBe("");
    expect(buildQuestionQueryParams({ subject: "" })).toBe("");
  });

  test("builds a query string for a single filter", () => {
    expect(buildQuestionQueryParams({ subject: "Mathematics" })).toBe("?subject=Mathematics");
  });

  test("builds a query string including published", () => {
    expect(buildQuestionQueryParams({ subject: "Mathematics", published: true })).toBe(
      "?subject=Mathematics&published=true"
    );
    expect(buildQuestionQueryParams({ published: false })).toBe("?published=false");
  });

  test("builds a query string for multiple filters, URL-encoded", () => {
    const qs = buildQuestionQueryParams({ subject: "Math & Science", level: "Form 2" });
    expect(qs).toBe("?subject=Math+%26+Science&level=Form+2");
  });
});

describe("getQuestionFilterOptions", () => {
  test("empty lists when there are no questions", () => {
    expect(getQuestionFilterOptions(undefined)).toEqual({
      subjects: [],
      levels: [],
      institutions: [],
      questionTypes: [],
    });
    expect(getQuestionFilterOptions([])).toEqual({
      subjects: [],
      levels: [],
      institutions: [],
      questionTypes: [],
    });
  });

  test("returns distinct, alphabetically-sorted values and ignores blanks", () => {
    const questions = [
      { subject: "Chemistry", level: "Form 3", institution_context: "KCSE", question_type: "short_answer" },
      { subject: "Mathematics", level: "Form 2", institution_context: "KCSE", question_type: "multiple_choice" },
      { subject: "Mathematics", level: "Form 2", institution_context: "KCSE", question_type: "multiple_choice" },
      { subject: null, level: "Form 1", institution_context: "", question_type: null },
    ];
    expect(getQuestionFilterOptions(questions)).toEqual({
      subjects: ["Chemistry", "Mathematics"],
      levels: ["Form 1", "Form 2", "Form 3"],
      institutions: ["KCSE"],
      questionTypes: ["multiple_choice", "short_answer"],
    });
  });
});

describe("applyQuestionTypeFilter", () => {
  const questions = [
    { id: 1, question_type: "multiple_choice" },
    { id: 2, question_type: "short_answer" },
    { id: 3, question_type: "number_answer" },
  ];

  test("passes everything through when no type is given", () => {
    expect(applyQuestionTypeFilter(questions, undefined)).toEqual(questions);
    expect(applyQuestionTypeFilter(undefined, undefined)).toEqual([]);
  });

  test("filters to the matching question_type", () => {
    expect(applyQuestionTypeFilter(questions, "short_answer")).toEqual([
      { id: 2, question_type: "short_answer" },
    ]);
  });

  test("returns an empty list when nothing matches", () => {
    expect(applyQuestionTypeFilter(questions, "nonexistent_type")).toEqual([]);
  });
});
