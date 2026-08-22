import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import { buildQuizQueryParams, type QuizFilters } from './quizFilters'
import type { Question } from './questions'

export type { QuizFilters }

/*
 Fetchers for the LearnOrbit quiz authoring layer (Phase 6E-2, backend built
 in Phase 6C). A Quiz is a curated, ordered set of a channel's own published
 Question bank items — see docs/ARCHITECTURE.md § "Exams & Practice (Phase
 6A)". Quiz metadata (list/get) is public-capable like channelResources.ts
 (published+public for anon/non-admin viewers, everything for this channel's
 admins — enforced server-side), but the attached-questions endpoints
 (list/attach/reorder/detach) are admin-only end to end since they expose
 each Question's full contents, including the answer key. Wraps the Phase 6C
 GET/POST/PUT/DELETE /orgs/{org_id}/quizzes... endpoints with `errorHandling`
 so a 401/403/404/409/422 surfaces as a thrown, status-tagged error rather
 than a swallowed body.
*/

export type QuizType = 'standard' | 'exam_practice'

export interface Quiz {
  id: number
  quiz_uuid: string
  org_id: number
  title: string
  description?: string | null
  quiz_type: string
  time_limit_minutes?: number | null
  pass_threshold_percentage?: number | null
  published: boolean
  visibility: 'public' | 'unlisted'
  creation_date: string
  update_date: string
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
  question_count: number
}

export interface QuizQuestion {
  id: number
  quiz_id: number
  question_id: number
  order: number
  question: Question
}

export async function listQuizzes(
  org_id: number,
  filters?: QuizFilters,
  access_token?: string
): Promise<Quiz[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes${buildQuizQueryParams(filters)}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getQuiz(
  org_id: number,
  quiz_id: number | string,
  access_token?: string
): Promise<Quiz> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export interface QuizCreateInput {
  title: string
  description?: string
  quiz_type?: QuizType
  time_limit_minutes?: number
  pass_threshold_percentage?: number
  visibility?: 'public' | 'unlisted'
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
}

/** Creates a Quiz (Phase 6C, owner/admin only) — starts unpublished, with
 * no questions attached. */
export async function createQuiz(
  org_id: number,
  data: QuizCreateInput,
  access_token: string
): Promise<Quiz> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export interface QuizUpdateInput {
  title?: string
  description?: string
  quiz_type?: QuizType
  time_limit_minutes?: number | null
  pass_threshold_percentage?: number | null
  visibility?: 'public' | 'unlisted'
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
}

/** Partial update of a Quiz's metadata (Phase 6C, owner/admin only). Fields
 * omitted from `data` are left unchanged server-side (`exclude_unset`).
 * Does not touch attached questions. */
export async function updateQuiz(
  org_id: number,
  quiz_id: number,
  data: QuizUpdateInput,
  access_token: string
): Promise<Quiz> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function setQuizPublished(
  org_id: number,
  quiz_id: number,
  published: boolean,
  access_token: string
): Promise<Quiz> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/publish`,
    RequestBodyWithAuthHeader('PUT', { published }, null, access_token)
  )
  return errorHandling(result)
}

/** Removes the quiz and its QuizQuestion attachments (cascade) — the
 * underlying Question bank items are left untouched. */
export async function deleteQuiz(
  org_id: number,
  quiz_id: number,
  access_token: string
): Promise<{ detail: string }> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

/** Admin-only — the response includes each Question's full contents,
 * including the answer key. Ordered by attach order. */
export async function listQuizQuestions(
  org_id: number,
  quiz_id: number | string,
  access_token?: string
): Promise<QuizQuestion[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/questions`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Attaches an already-published bank Question to this quiz, appended to
 * the end of its order. 409 if the question isn't published, or is already
 * attached; 404 if it doesn't belong to this org. */
export async function attachQuestionToQuiz(
  org_id: number,
  quiz_id: number,
  question_id: number,
  access_token: string
): Promise<QuizQuestion> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/questions`,
    RequestBodyWithAuthHeader('POST', { question_id }, null, access_token)
  )
  return errorHandling(result)
}

/** Whole-set reorder, not a partial move — `question_ids` must be exactly
 * this quiz's currently-attached question ids, in the desired order (422
 * otherwise). Returns the re-ordered attached-questions list. */
export async function reorderQuizQuestions(
  org_id: number,
  quiz_id: number,
  question_ids: number[],
  access_token: string
): Promise<QuizQuestion[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/questions/reorder`,
    RequestBodyWithAuthHeader('PUT', { question_ids }, null, access_token)
  )
  return errorHandling(result)
}

/** Removes only the quiz's membership row — the underlying Question bank
 * item is left untouched. */
export async function detachQuestionFromQuiz(
  org_id: number,
  quiz_id: number,
  question_id: number,
  access_token: string
): Promise<{ detail: string }> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/questions/${question_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}
