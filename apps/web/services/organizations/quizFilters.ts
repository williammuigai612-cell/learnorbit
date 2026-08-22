/*
 Pure helpers for Phase 6E-2 quiz filtering. Kept dependency-free (no fetch,
 no getAPIUrl) so they're directly unit-testable — see
 tests/quiz-filters.test.mjs. Mirrors questionFilters.ts's shape, with the
 client/server split inverted: GET /orgs/{org_id}/quizzes accepts
 subject/topic/level/institution_context/quiz_type as server-side query
 params (see apps/api/src/routers/orgs/orgs.py `api_list_quizzes`) but has no
 `published` filter, so `published` is applied client-side via
 applyPublishedFilter instead.
*/

export interface QuizFilters {
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  quiz_type?: string
}

const FILTER_KEYS: (keyof QuizFilters)[] = [
  'subject',
  'topic',
  'level',
  'institution_context',
  'quiz_type',
]

/** Drops empty/whitespace-only values so `{ subject: '' }` behaves like "no
 * filter" — keeps query keys and query params from treating "" as real. */
export function normalizeQuizFilters(filters: QuizFilters | undefined): QuizFilters | undefined {
  if (!filters) return undefined
  const normalized: QuizFilters = {}
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value && value.trim()) (normalized as Record<string, string>)[key] = value
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

/** Builds the `?subject=...&quiz_type=...` suffix the backend's existing
 * GET /orgs/{org_id}/quizzes query params expect. Empty string when there
 * are no active filters. */
export function buildQuizQueryParams(filters: QuizFilters | undefined): string {
  const normalized = normalizeQuizFilters(filters)
  if (!normalized) return ''
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = normalized[key]
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export interface QuizFilterOptions {
  subjects: string[]
  levels: string[]
  institutions: string[]
  quizTypes: string[]
}

/** Distinct, alphabetically-sorted values pulled from a channel's full
 * (unfiltered) quiz list — used to populate the filter dropdowns so options
 * never disappear out from under a selection already made. Mirrors
 * getQuestionFilterOptions; topic isn't surfaced as a dropdown here either,
 * matching the Resource/Question filter precedent. */
export function getQuizFilterOptions(
  quizzes:
    | Array<{
        subject?: string | null
        level?: string | null
        institution_context?: string | null
        quiz_type?: string | null
      }>
    | undefined
): QuizFilterOptions {
  const subjects = new Set<string>()
  const levels = new Set<string>()
  const institutions = new Set<string>()
  const quizTypes = new Set<string>()
  for (const quiz of quizzes || []) {
    if (quiz?.subject) subjects.add(quiz.subject)
    if (quiz?.level) levels.add(quiz.level)
    if (quiz?.institution_context) institutions.add(quiz.institution_context)
    if (quiz?.quiz_type) quizTypes.add(quiz.quiz_type)
  }
  const sort = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b))
  return {
    subjects: sort(subjects),
    levels: sort(levels),
    institutions: sort(institutions),
    quizTypes: sort(quizTypes),
  }
}

/** `published` has no server-side filter on GET .../quizzes (see module
 * docstring), so it's applied client-side over an already-fetched (possibly
 * server-filtered) list. `undefined` passes everything through unfiltered. */
export function applyPublishedFilter<T extends { published?: boolean | null }>(
  quizzes: T[] | undefined,
  published: boolean | undefined
): T[] {
  const list = quizzes || []
  if (typeof published !== 'boolean') return list
  return list.filter((q) => q.published === published)
}
