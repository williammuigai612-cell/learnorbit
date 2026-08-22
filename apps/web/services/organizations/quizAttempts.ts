import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import type { Question } from './questions'

/*
 Fetchers for student quiz attempt-taking (Phase 6E-3, backend built in
 Phase 6D). See docs/ARCHITECTURE.md § "Exams & Practice (Phase 6D)" for the
 full leak-prevention contract this wraps: while an attempt is
 "in_progress", the questions returned have `is_correct` stripped from
 multiple_choice options and `accepted_answers`/`explanation` omitted
 entirely — the answer key is only ever revealed in the graded response,
 and only to that attempt's own owner (403 on any other user). Wraps the
 Phase 6D POST/GET /orgs/{org_id}/quizzes/{quiz_id}/attempts... endpoints
 with `errorHandling` so a 401/403/404/409/422 surfaces as a thrown,
 status-tagged error rather than a swallowed body.
*/

export interface AttemptQuestionOption {
  id: string
  text: string
}

export interface AttemptQuestionContents {
  options?: AttemptQuestionOption[]
}

/** Student-facing view of a bank question while an attempt is in progress
 * — the answer key is stripped server-side (see module docstring). */
export interface AttemptQuestion {
  id: number
  question_type: string
  prompt: string
  contents: AttemptQuestionContents
}

export type QuizAnswerPayload =
  | { selected_option_id: string }
  | { text: string }
  | { value: number }
  | Record<string, never>

export interface QuizAnswerResult {
  question_id: number
  answer: Record<string, unknown>
  is_correct: boolean
  /** Full Question, including explanation/is_correct — only ever included
   * once this attempt is graded, and only for the attempt's own owner. */
  question: Question
}

export interface QuizAttempt {
  id: number
  quizattempt_uuid: string
  quiz_id: number
  user_id: number
  status: string
  score_percentage: number
  attempt_number: number
  started_at: string
  submitted_at?: string | null
  /** Populated only while status === "in_progress" (student view, stripped). */
  questions?: AttemptQuestion[]
  /** Populated only once status === "graded" (full per-answer results). */
  answers?: QuizAnswerResult[]
}

/** One row of the current user's own attempt history for a quiz (Results,
 * Phase 6G) — summary fields only, no per-question detail. */
export interface QuizAttemptSummary {
  id: number
  quizattempt_uuid: string
  quiz_id: number
  status: string
  score_percentage: number
  attempt_number: number
  started_at: string
  submitted_at?: string | null
}

/** Starts a new attempt (any authenticated user; 401 anon). The quiz must
 * be published+public, unless the acting user is this channel's own admin
 * previewing their own draft. Every attempt is its own row — no resume
 * semantics, starting again always begins a fresh attempt. */
export async function startQuizAttempt(
  org_id: number,
  quiz_id: number,
  access_token: string
): Promise<QuizAttempt> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/attempts`,
    RequestBodyWithAuthHeader('POST', {}, null, access_token)
  )
  return errorHandling(result)
}

/** Owner of the attempt only (403 otherwise). While in progress returns the
 * student-view questions; once graded returns the full per-answer results. */
export async function getQuizAttempt(
  org_id: number,
  quiz_id: number,
  attempt_id: number | string,
  access_token?: string
): Promise<QuizAttempt> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/attempts/${attempt_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export interface QuizAnswerSubmitInput {
  question_id: number
  answer: QuizAnswerPayload
}

/** Owner of the attempt only. All V1 question types auto-grade on submit —
 * a question with no submitted answer is graded incorrect (409 if the
 * attempt was already submitted; 422 on a duplicate/foreign question_id). */
export async function submitQuizAttempt(
  org_id: number,
  quiz_id: number,
  attempt_id: number,
  answers: QuizAnswerSubmitInput[],
  access_token: string
): Promise<QuizAttempt> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/attempts/${attempt_id}/submit`,
    RequestBodyWithAuthHeader('POST', { answers }, null, access_token)
  )
  return errorHandling(result)
}

/** Owner-only (returns only the acting user's own attempts). Newest
 * attempt_number first — Results (Phase 6G). */
export async function listQuizAttempts(
  org_id: number,
  quiz_id: number,
  access_token: string
): Promise<QuizAttemptSummary[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/quizzes/${quiz_id}/attempts`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Pass/fail outcome for one attempt against a quiz's optional
 * pass_threshold_percentage — null when the quiz has no threshold set (no
 * pass/fail concept applies), matching the 6E-3 single-attempt results
 * view's own inline logic (kept here too so it's covered by a unit test —
 * see quiz-results.test.mjs). */
export function computeAttemptOutcome(
  scorePercentage: number,
  passThresholdPercentage: number | null | undefined
): 'passed' | 'failed' | null {
  if (typeof passThresholdPercentage !== 'number') return null
  return scorePercentage >= passThresholdPercentage ? 'passed' : 'failed'
}
