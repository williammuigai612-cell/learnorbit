import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import { buildChannelVideoQueryParams, type ChannelVideoFilters } from './channelVideoFilters'

export type { ChannelVideoFilters }

/*
 Fetchers for the LearnOrbit video watch page (Phase 2D). ChannelVideo is a
 thin discovery/metadata layer over an existing video Activity — see
 docs/ARCHITECTURE.md § "Videos (Phase 2A)". These wrap the existing
 GET /orgs/{org_id}/videos/{channelvideo_id}, GET /activities/id/{activity_id}
 and GET /courses/id/{course_id} endpoints (all pre-existing, unmodified) with
 `errorHandling` so a 403/404 surfaces as a thrown, status-tagged error rather
 than a swallowed body — the watch page needs to tell "not found" apart from
 "not published"/"inaccessible".
*/

export async function listChannelVideos(
  org_id: number,
  filters?: ChannelVideoFilters,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos${buildChannelVideoQueryParams(filters)}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChannelVideo(
  org_id: number,
  channelvideo_id: number | string,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChannelVideoActivity(
  activity_id: number,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}activities/id/${activity_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getChannelVideoCourse(
  course_id: number,
  access_token?: string
) {
  const result = await fetch(
    `${getAPIUrl()}courses/id/${course_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export interface ChannelVideoCreateInput {
  activity_id: number
  title: string
  description?: string
  thumbnail_image?: string
  visibility?: 'public' | 'unlisted'
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  resource_type?: string
}

/** Creates a ChannelVideo post (Phase 2C, owner/admin only) — starts unpublished. */
export async function createChannelVideo(
  org_id: number,
  data: ChannelVideoCreateInput,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos`,
    RequestBodyWithAuthHeader('POST', data, null, access_token)
  )
  return errorHandling(result)
}

export interface ChannelVideoUpdateInput {
  title?: string
  description?: string
  subject?: string
  topic?: string
  level?: string
  institution_context?: string
  resource_type?: string
}

/** Partial update of a ChannelVideo's metadata (Phase 2G-1, owner/admin only).
 * Fields omitted from `data` are left unchanged server-side. */
export async function updateChannelVideo(
  org_id: number,
  channelvideo_id: number,
  data: ChannelVideoUpdateInput,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  return errorHandling(result)
}

export async function setChannelVideoPublished(
  org_id: number,
  channelvideo_id: number,
  published: boolean,
  access_token: string
) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/publish`,
    RequestBodyWithAuthHeader('PUT', { published }, null, access_token)
  )
  return errorHandling(result)
}
