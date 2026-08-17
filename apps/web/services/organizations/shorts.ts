import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetcher for the LearnOrbit global Shorts queue (Phase 3E). Wraps the
 existing, unmodified GET /shorts endpoint (Phase 3C) — a public,
 cross-org, reverse-chronological feed of published+public Shorts. This is
 the single source of truth for Shorts ordering; the frontend does no
 filtering, ranking, or reordering of its own.
*/
export async function listPublicShorts() {
  const result = await fetch(`${getAPIUrl()}shorts`, RequestBodyWithAuthHeader('GET', null, null))
  return errorHandling(result)
}
