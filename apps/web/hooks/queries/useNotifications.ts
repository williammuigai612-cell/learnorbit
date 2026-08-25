'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@services/organizations/notifications'

// Phase 4H. Requires authentication (the API 401s otherwise) — disabled
// until a session with an access token and user id exists, same gating as
// useHomeFeed.
function useAuthedSession() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const userId = session?.data?.user?.id as number | undefined
  const isAuthenticated = session?.status === 'authenticated'
  return { accessToken, userId, isAuthenticated }
}

// Phase 9B: `enabled` gates the list on the dropdown actually being open.
// The bell lives in the global org nav (OrgMenu), so an unconditional fetch
// pulled 50 full notification rows plus 50 actor objects on *every*
// authenticated page load, purely to have them ready in case the viewer
// opened the panel. The unread badge is served by the separate, cheap
// unread-count endpoint below, so the closed bell needs none of this.
// staleTime keeps a reopen within 30s from refetching.
export function useNotifications(enabled = true) {
  const { accessToken, userId, isAuthenticated } = useAuthedSession()

  return useQuery<Notification[]>({
    queryKey: queryKeys.notifications.list(userId),
    queryFn: () => listNotifications(accessToken!),
    enabled: enabled && isAuthenticated && !!accessToken,
    staleTime: 30_000,
  })
}

export function useUnreadNotificationCount() {
  const { accessToken, userId, isAuthenticated } = useAuthedSession()

  return useQuery<{ count: number }>({
    queryKey: queryKeys.notifications.unreadCount(userId),
    queryFn: () => getUnreadNotificationCount(accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const { accessToken, userId } = useAuthedSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationUuid: string) => markNotificationRead(notificationUuid, accessToken!),
    onSuccess: (updated: Notification) => {
      queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(userId), (prev) =>
        (prev ?? []).map((n) => (n.notification_uuid === updated.notification_uuid ? updated : n))
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(userId) })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const { accessToken, userId } = useAuthedSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markAllNotificationsRead(accessToken!),
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(userId), (prev) =>
        (prev ?? []).map((n) => ({ ...n, is_read: true }))
      )
      queryClient.setQueryData(queryKeys.notifications.unreadCount(userId), { count: 0 })
    },
  })
}
