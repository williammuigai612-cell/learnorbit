import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

/*
 Fetchers for the LearnOrbit in-app notification system (Phase 4H). Wraps
 GET /notifications, GET /notifications/unread-count, and the two
 mark-as-read endpoints — a global, cross-org resource (no org_id in the
 path), same shape as feed.ts. Requires auth; the API 401s an anonymous
 caller.
*/

export interface NotificationActor {
  id: number
  user_uuid: string
  username: string
  first_name: string
  last_name: string
  avatar_image?: string
}

export interface Notification {
  id: number
  notification_uuid: string
  recipient_id: number
  actor_id: number
  channelvideo_id: number
  notification_type: string
  is_read: boolean
  creation_date: string
  actor: NotificationActor | null
}

export async function listNotifications(access_token: string): Promise<Notification[]> {
  const result = await fetch(
    `${getAPIUrl()}notifications?page=1&limit=50`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getUnreadNotificationCount(access_token: string): Promise<{ count: number }> {
  const result = await fetch(
    `${getAPIUrl()}notifications/unread-count`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function markNotificationRead(
  notification_uuid: string,
  access_token: string
): Promise<Notification> {
  const result = await fetch(
    `${getAPIUrl()}notifications/${notification_uuid}/read`,
    RequestBodyWithAuthHeader('PATCH', null, null, access_token)
  )
  return errorHandling(result)
}

export async function markAllNotificationsRead(
  access_token: string
): Promise<{ marked_read: number }> {
  const result = await fetch(
    `${getAPIUrl()}notifications/read-all`,
    RequestBodyWithAuthHeader('PATCH', null, null, access_token)
  )
  return errorHandling(result)
}
