import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetcher for the LearnOrbit global Shorts queue (Phase 3E). Wraps the
 existing, unmodified GET /shorts endpoint (Phase 3C) — a public,
 cross-org, reverse-chronological feed of published+public Shorts. This is
 the single source of truth for Shorts ordering; the frontend does no
 filtering, ranking, or reordering of its own.
*/
/** Size of the queue window fetched for the Shorts viewer (Phase 9B).
 * The endpoint used to return every published Short on the platform; the
 * viewer only ever needs enough of the queue to resolve prev/next and let a
 * viewer keep swiping. Capped at the endpoint's own maximum of 100. */
export const SHORTS_QUEUE_LIMIT = 50

export async function listPublicShorts(limit: number = SHORTS_QUEUE_LIMIT) {
  const result = await fetch(
    `${getAPIUrl()}shorts?page=1&limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, null)
  )
  return errorHandling(result)
}
