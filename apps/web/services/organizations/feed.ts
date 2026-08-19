import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetcher for the LearnOrbit home feed (Phase 4G). Wraps the GET /feed
 endpoint — a personalized, cross-org, reverse-chronological feed of
 long-form videos from channels the authenticated user follows. Requires
 auth (the API 401s an anonymous caller); the frontend does no filtering,
 ranking, or reordering of its own.
*/

export interface HomeFeedItem {
  id: number
  channelvideo_uuid: string
  org_id: number
  activity_id: number
  title: string
  description?: string | null
  thumbnail_image?: string | null
  published: boolean
  visibility: string
  content_format: string
  creation_date: string
  update_date: string
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
  resource_type?: string | null
  org_slug: string
  org_name: string
  channel_type: string
}

export async function listHomeFeed(access_token: string): Promise<HomeFeedItem[]> {
  const result = await fetch(`${getAPIUrl()}feed`, RequestBodyWithAuthHeader('GET', null, null, access_token))
  return errorHandling(result)
}
