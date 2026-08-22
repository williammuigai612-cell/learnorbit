import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetchers for the Phase 7B/7C parent-child link endpoints (apps/api/src/routers/users.py):
 POST /users/parent-links/request, GET /users/parent-links/pending,
 GET /users/parent-links/mine, POST /users/parent-links/{link_uuid}/respond,
 GET /users/parent-links/children/{child_user_id}/quiz-progress. Global,
 cross-org, same shape as services/organizations/notifications.ts.
*/

export type ParentChildLinkStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ParentChildLink {
  link_uuid: string
  parent_user_id: number
  child_user_id: number
  status: ParentChildLinkStatus
  creation_date: string
  update_date: string
}

export interface ChildQuizProgressSummary {
  quiz_id: number
  quiz_title: string
  pass_threshold_percentage: number | null
  attempts_taken: number
  best_score_percentage: number | null
  most_recent_score_percentage: number | null
  most_recent_attempt_at: string
  org_id: number
  org_name: string
  org_slug: string
}

export async function requestParentLink(
  child_username: string,
  access_token: string
): Promise<ParentChildLink> {
  const result = await fetch(
    `${getAPIUrl()}users/parent-links/request`,
    RequestBodyWithAuthHeader('POST', { child_username }, null, access_token)
  )
  return errorHandling(result)
}

export async function listPendingParentLinks(
  access_token: string
): Promise<ParentChildLink[]> {
  const result = await fetch(
    `${getAPIUrl()}users/parent-links/pending`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function respondToParentLink(
  link_uuid: string,
  approve: boolean,
  access_token: string
): Promise<ParentChildLink> {
  const result = await fetch(
    `${getAPIUrl()}users/parent-links/${link_uuid}/respond`,
    RequestBodyWithAuthHeader('POST', { approve }, null, access_token)
  )
  return errorHandling(result)
}

export async function listMyParentLinks(
  access_token: string
): Promise<ParentChildLink[]> {
  const result = await fetch(
    `${getAPIUrl()}users/parent-links/mine`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChildQuizProgress(
  child_user_id: number,
  access_token: string
): Promise<ChildQuizProgressSummary[]> {
  const result = await fetch(
    `${getAPIUrl()}users/parent-links/children/${child_user_id}/quiz-progress`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}
