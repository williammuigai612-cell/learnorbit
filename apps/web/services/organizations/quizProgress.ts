import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetcher for Basic Progress Tracking (Phase 6H) — wraps the read-only
 GET /orgs/{org_id}/progress endpoint (services/orgs/progress.py). Owner-only
 (returns only the acting user's own progress); see
 docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" point 3 for why this is
 an aggregation over the existing QuizAttempt/Quiz tables, not a new table.
*/

/** One quiz's worth of the acting user's own progress in this org. Only
 * quizzes actually attempted appear — this is engagement history, not a
 * catalog. `best_score_percentage`/`most_recent_score_percentage` are null
 * when every attempt on that quiz is still in_progress (no graded score
 * yet), distinct from a genuine 0%. */
export interface QuizProgressSummary {
  quiz_id: number
  quiz_title: string
  pass_threshold_percentage?: number | null
  attempts_taken: number
  best_score_percentage: number | null
  most_recent_score_percentage: number | null
  most_recent_attempt_at: string
}

export async function getOrgQuizProgress(
  org_id: number,
  access_token: string
): Promise<QuizProgressSummary[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/progress`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}
