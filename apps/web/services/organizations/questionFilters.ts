/*
 Pure helpers for Phase 6E-1 question bank filtering. Kept dependency-free
 (no fetch, no getAPIUrl) so they're directly unit-testable — see
 tests/question-filters.test.mjs. Mirrors channelResourceFilters.ts's shape,
 except `question_type` isn't a server-side filter (GET /orgs/{org_id}/
 questions only accepts subject/topic/level/institution_context/published —
 see apps/api/src/routers/orgs/orgs.py `api_list_questions`), so it's applied
 client-side via applyQuestionTypeFilter instead of being sent as a query
 param.
*/

export interface QuestionFilters {
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  published?: boolean
}

const STRING_FILTER_KEYS: (keyof Omit<QuestionFilters, 'published'>)[] = [
  'subject',
  'topic',
  'level',
  'institution_context',
]

/** Drops empty/whitespace-only string values so `{ subject: '' }` behaves
 * like "no filter" — keeps query keys and query params from treating "" as
 * real. `published` is a tri-state (undefined/true/false), not
 * empty-string-droppable, so it's kept as-is whenever it's a boolean. */
export function normalizeQuestionFilters(
  filters: QuestionFilters | undefined
): QuestionFilters | undefined {
  if (!filters) return undefined
  const normalized: QuestionFilters = {}
  for (const key of STRING_FILTER_KEYS) {
    const value = filters[key]
    if (value && value.trim()) (normalized as Record<string, string>)[key] = value
  }
  if (typeof filters.published === 'boolean') normalized.published = filters.published
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

/** Builds the `?subject=...&published=...` suffix the backend's existing
 * GET /orgs/{org_id}/questions query params expect. Empty string when there
 * are no active filters. */
export function buildQuestionQueryParams(filters: QuestionFilters | undefined): string {
  const normalized = normalizeQuestionFilters(filters)
  if (!normalized) return ''
  const params = new URLSearchParams()
  for (const key of STRING_FILTER_KEYS) {
    const value = normalized[key]
    if (value) params.set(key, value)
  }
  if (typeof normalized.published === 'boolean') params.set('published', String(normalized.published))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export interface QuestionFilterOptions {
  subjects: string[]
  levels: string[]
  institutions: string[]
  questionTypes: string[]
}

/** Distinct, alphabetically-sorted values pulled from a channel's full
 * (unfiltered) question list — used to populate the filter dropdowns so
 * options never disappear out from under a selection already made. Mirrors
 * getChannelResourceFilterOptions; topic isn't surfaced as a dropdown here
 * either, matching the Resource filter precedent. */
export function getQuestionFilterOptions(
  questions:
    | Array<{
        subject?: string | null
        level?: string | null
        institution_context?: string | null
        question_type?: string | null
      }>
    | undefined
): QuestionFilterOptions {
  const subjects = new Set<string>()
  const levels = new Set<string>()
  const institutions = new Set<string>()
  const questionTypes = new Set<string>()
  for (const question of questions || []) {
    if (question?.subject) subjects.add(question.subject)
    if (question?.level) levels.add(question.level)
    if (question?.institution_context) institutions.add(question.institution_context)
    if (question?.question_type) questionTypes.add(question.question_type)
  }
  const sort = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b))
  return {
    subjects: sort(subjects),
    levels: sort(levels),
    institutions: sort(institutions),
    questionTypes: sort(questionTypes),
  }
}

/** question_type has no server-side filter (see module docstring), so it's
 * applied client-side over an already-fetched (possibly server-filtered)
 * list. `undefined`/empty passes everything through unfiltered. */
export function applyQuestionTypeFilter<T extends { question_type?: string | null }>(
  questions: T[] | undefined,
  questionType: string | undefined
): T[] {
  const list = questions || []
  if (!questionType) return list
  return list.filter((q) => q.question_type === questionType)
}
