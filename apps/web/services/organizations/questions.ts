import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import { buildQuestionQueryParams, type QuestionFilters } from './questionFilters'

export type { QuestionFilters }

/*
 Fetchers for the LearnOrbit exam-prep question bank (Phase 6E-1, backend
 built in Phase 6B). A Question is channel-scoped and admin-only end to
 end — no public listing exists (see docs/ARCHITECTURE.md § "Exams &
 Practice (Phase 6A)") — so unlike channelResources.ts/channelVideos.ts
 there is no anonymous/public read path to account for here. Wraps the
 Phase 6B GET/POST/PUT/DELETE /orgs/{org_id}/questions... endpoints with
 `errorHandling` so a 401/403/404/422 surfaces as a thrown, status-tagged
 error rather than a swallowed body.
*/

export type QuestionType = 'multiple_choice' | 'short_answer' | 'number_answer'

export interface QuestionOption {
  id: string
  text: string
  is_correct: boolean
}

/** `contents` is a polymorphic JSON payload — `{options}` for
 * multiple_choice, `{accepted_answers}` for short_answer/number_answer.
 * Mirrors the backend's Question.contents convention (db/questions.py). */
export interface QuestionContents {
  options?: QuestionOption[]
  accepted_answers?: string[]
}

export interface Question {
  id: number
  question_uuid: string
  org_id: number
  question_type: string
  prompt: string
  contents: QuestionContents
  explanation?: string | null
  published: boolean
  creation_date: string
  update_date: string
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
}

export async function listQuestions(
  org_id: number,
  filters?: QuestionFilters,
  access_token?: string
): Promise<Question[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/questions${buildQuestionQueryParams(filters)}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getQuestion(
  org_id: number,
  question_id: number | string,
  access_token?: string
): Promise<Question> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/questions/${question_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export interface QuestionCreateInput {
  question_type: QuestionType
  prompt: string
  contents?: QuestionContents
  explanation?: string
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
}

/** Creates a Question bank item (Phase 6B, owner/admin only) — starts
 * unpublished. */
export async function createQuestion(
  org_id: number,
  data: QuestionCreateInput,
  access_token: string
): Promise<Question> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/questions`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export interface QuestionUpdateInput {
  question_type?: QuestionType
  prompt?: string
  contents?: QuestionContents
  explanation?: string
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
}

/** Partial update of a Question's fields (Phase 6B, owner/admin only).
 * Fields omitted from `data` are left unchanged server-side
 * (`exclude_unset`). */
export async function updateQuestion(
  org_id: number,
  question_id: number,
  data: QuestionUpdateInput,
  access_token: string
): Promise<Question> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/questions/${question_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

/** Only published questions are eligible to be attached to a Quiz — see
 * docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)". */
export async function setQuestionPublished(
  org_id: number,
  question_id: number,
  published: boolean,
  access_token: string
): Promise<Question> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/questions/${question_id}/publish`,
    RequestBodyWithAuthHeader('PUT', { published }, null, access_token)
  )
  return errorHandling(result)
}

export async function deleteQuestion(
  org_id: number,
  question_id: number,
  access_token: string
): Promise<{ detail: string }> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/questions/${question_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}
