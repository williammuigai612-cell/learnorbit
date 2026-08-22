import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import { buildChannelResourceQueryParams, type ChannelResourceFilters } from './channelResourceFilters'

export type { ChannelResourceFilters }

/*
 Fetchers for the LearnOrbit Academic Library (Phase 5C). ChannelResource is a
 thin discovery/metadata layer over an existing document Activity — see
 docs/ARCHITECTURE.md § "Academic Library (Phase 5A)". These wrap the Phase 5B
 GET/POST/PUT/DELETE /orgs/{org_id}/resources... endpoints and the existing,
 unmodified GET /activities/id/{activity_id} and GET /courses/id/{course_id}
 endpoints with `errorHandling` so a 403/404 surfaces as a thrown,
 status-tagged error rather than a swallowed body — the resource viewer needs
 to tell "not found" apart from "not published". No likes/comments/saves/
 shares here — confirmed out of Phase 5 scope by the 5A decision.
*/

export async function listChannelResources(
  org_id: number,
  filters?: ChannelResourceFilters,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/resources${buildChannelResourceQueryParams(filters)}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChannelResource(
  org_id: number,
  channelresource_id: number | string,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/resources/${channelresource_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChannelResourceActivity(
  activity_id: number,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}activities/id/${activity_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChannelResourceCourse(
  course_id: number,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}courses/id/${course_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export interface ChannelResourceCreateInput {
  activity_id: number
  title: string
  description?: string
  visibility?: 'public' | 'unlisted'
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  resource_type?: string
  year?: string
}

/** Creates a ChannelResource post (Phase 5B, owner/admin only) — starts unpublished. */
export async function createChannelResource(
  org_id: number,
  data: ChannelResourceCreateInput,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/resources`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export interface ChannelResourceUpdateInput {
  title?: string
  description?: string
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  resource_type?: string
  year?: string
}

/** Partial update of a ChannelResource's metadata (Phase 5B, owner/admin
 * only). Fields omitted from `data` are left unchanged server-side. */
export async function updateChannelResource(
  org_id: number,
  channelresource_id: number,
  data: ChannelResourceUpdateInput,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/resources/${channelresource_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function setChannelResourcePublished(
  org_id: number,
  channelresource_id: number,
  published: boolean,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/resources/${channelresource_id}/publish`,
    RequestBodyWithAuthHeader('PUT', { published }, null, access_token)
  )
  return errorHandling(result)
}

/** Removes only the channel's discovery post — the underlying document
 * Activity is left untouched (Phase 5B). */
export async function deleteChannelResource(
  org_id: number,
  channelresource_id: number,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/resources/${channelresource_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}
