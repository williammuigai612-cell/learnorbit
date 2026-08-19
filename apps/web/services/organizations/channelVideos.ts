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
  /** Phase 3F: 'short' creates a Short, per the existing content_format
   * discriminator (docs/ARCHITECTURE.md § "Videos / Shorts (Phase 3A)").
   * Omitted defaults to 'long' server-side (Phase 3B). */
  content_format?: 'long' | 'short'
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

export interface ChannelVideoLikeStatus {
  is_liked: boolean
  like_count: number
}

/** Like status + live count (Phase 4B). Supports anonymous viewers of a
 * public video (is_liked is always false for them) — same visibility rule
 * as getChannelVideo. */
export async function getChannelVideoLikeStatus(
  org_id: number,
  channelvideo_id: number | string,
  access_token?: string
): Promise<ChannelVideoLikeStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/like`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Like the video as the authenticated user (Phase 4B, idempotent). */
export async function likeChannelVideo(
  org_id: number,
  channelvideo_id: number | string,
  access_token: string
): Promise<ChannelVideoLikeStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/like`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  return errorHandling(result)
}

/** Unlike the video as the authenticated user (Phase 4B, idempotent). */
export async function unlikeChannelVideo(
  org_id: number,
  channelvideo_id: number | string,
  access_token: string
): Promise<ChannelVideoLikeStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/like`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export interface ChannelVideoSaveStatus {
  is_saved: boolean
}

/** Save status (Phase 4D). Supports anonymous viewers of a public video
 * (is_saved is always false for them) — same visibility rule as
 * getChannelVideo. Unlike likes, there is no public count: saves are a
 * private per-user bookmark. */
export async function getChannelVideoSaveStatus(
  org_id: number,
  channelvideo_id: number | string,
  access_token?: string
): Promise<ChannelVideoSaveStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/save`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Save the video as the authenticated user (Phase 4D, idempotent). */
export async function saveChannelVideo(
  org_id: number,
  channelvideo_id: number | string,
  access_token: string
): Promise<ChannelVideoSaveStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/save`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  return errorHandling(result)
}

/** Unsave the video as the authenticated user (Phase 4D, idempotent). */
export async function unsaveChannelVideo(
  org_id: number,
  channelvideo_id: number | string,
  access_token: string
): Promise<ChannelVideoSaveStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/save`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}

export interface ChannelVideoShareStatus {
  share_count: number
}

/** Total share count (Phase 4E). Supports anonymous viewers of a public
 * video — same visibility rule as getChannelVideo. Public total across all
 * users, same as like_count. */
export async function getChannelVideoShareStatus(
  org_id: number,
  channelvideo_id: number | string,
  access_token?: string
): Promise<ChannelVideoShareStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/share`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Record a share of the video as the authenticated user (Phase 4E). Not
 * idempotent — a share is an append-only event, so repeated calls each
 * count separately and there is no unshare. */
export async function shareChannelVideo(
  org_id: number,
  channelvideo_id: number | string,
  access_token: string
): Promise<ChannelVideoShareStatus> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/share`,
    RequestBodyWithAuthHeader('POST', null, null, access_token)
  )
  return errorHandling(result)
}

/** Minimal author projection — mirrors the API's UserReadAuthor. */
export interface ChannelVideoCommentAuthor {
  id: number
  user_uuid: string
  username: string
  first_name: string
  last_name: string
  avatar_image?: string
}

export interface ChannelVideoComment {
  id: number
  channelvideo_id: number
  content: string
  comment_uuid: string
  creation_date: string
  update_date: string
  author: ChannelVideoCommentAuthor | null
}

/** Newest-first comments (Phase 4C). Supports anonymous viewers of a public
 * video — same visibility rule as getChannelVideo. No pagination UI on the
 * frontend: fetched once with a generous limit, matching the existing
 * community CommentSection precedent (getComments(uuid, 1, 100, ...)). */
export async function listChannelVideoComments(
  org_id: number,
  channelvideo_id: number | string,
  access_token?: string
): Promise<ChannelVideoComment[]> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/comments?page=1&limit=100`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

/** Create a comment as the authenticated user (Phase 4C). */
export async function createChannelVideoComment(
  org_id: number,
  channelvideo_id: number | string,
  content: string,
  access_token: string
): Promise<ChannelVideoComment> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/comments`,
    RequestBodyWithAuthHeader('POST', { content }, null, access_token)
  )
  return errorHandling(result)
}

/** Edit a comment as its author (Phase 4C). */
export async function updateChannelVideoComment(
  org_id: number,
  channelvideo_id: number | string,
  comment_uuid: string,
  content: string,
  access_token: string
): Promise<ChannelVideoComment> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/comments/${comment_uuid}`,
    RequestBodyWithAuthHeader('PUT', { content }, null, access_token)
  )
  return errorHandling(result)
}

/** Delete a comment as its author (Phase 4C). */
export async function deleteChannelVideoComment(
  org_id: number,
  channelvideo_id: number | string,
  comment_uuid: string,
  access_token: string
): Promise<{ detail: string }> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/videos/${channelvideo_id}/comments/${comment_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token)
  )
  return errorHandling(result)
}
