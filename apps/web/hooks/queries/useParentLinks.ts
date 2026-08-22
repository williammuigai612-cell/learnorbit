'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  getChildQuizProgress,
  listMyParentLinks,
  listPendingParentLinks,
  requestParentLink,
  respondToParentLink,
  type ChildQuizProgressSummary,
  type ParentChildLink,
} from '@services/users/parentLinks'

// Phase 7B-frontend. Requires authentication (the API 401s otherwise),
// disabled until a session with an access token and user id exists — same
// gating as useNotifications.
function useAuthedSession() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const userId = session?.data?.user?.id as number | undefined
  const isAuthenticated = session?.status === 'authenticated'
  return { accessToken, userId, isAuthenticated }
}

export function usePendingParentLinks() {
  const { accessToken, userId, isAuthenticated } = useAuthedSession()

  return useQuery<ParentChildLink[]>({
    queryKey: queryKeys.parentLinks.pending(userId),
    queryFn: () => listPendingParentLinks(accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useRequestParentLink() {
  const { accessToken } = useAuthedSession()

  return useMutation({
    mutationFn: (childUsername: string) => requestParentLink(childUsername, accessToken!),
  })
}

export function useRespondToParentLink() {
  const { accessToken, userId } = useAuthedSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ linkUuid, approve }: { linkUuid: string; approve: boolean }) =>
      respondToParentLink(linkUuid, approve, accessToken!),
    onSuccess: (updated: ParentChildLink) => {
      queryClient.setQueryData<ParentChildLink[]>(queryKeys.parentLinks.pending(userId), (prev) =>
        (prev ?? []).filter((link) => link.link_uuid !== updated.link_uuid)
      )
      // Approving adds a row to "mine"; rejecting doesn't, but refetching
      // either way is cheap and keeps the two lists from ever disagreeing.
      queryClient.invalidateQueries({ queryKey: queryKeys.parentLinks.mine(userId) })
    },
  })
}

// Phase 7C — the caller's own APPROVED links, on either side.
export function useMyParentLinks() {
  const { accessToken, userId, isAuthenticated } = useAuthedSession()

  return useQuery<ParentChildLink[]>({
    queryKey: queryKeys.parentLinks.mine(userId),
    queryFn: () => listMyParentLinks(accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 30_000,
  })
}

// Phase 7C — a linked child's cross-org quiz progress. `enabled` requires an
// explicit childUserId so this hook is inert until a specific child page
// mounts it (mirrors useQuizProgress's org-id gating).
export function useChildQuizProgress(childUserId: number | undefined) {
  const { accessToken, isAuthenticated } = useAuthedSession()

  return useQuery<ChildQuizProgressSummary[]>({
    queryKey: queryKeys.parentLinks.childProgress(childUserId),
    queryFn: () => getChildQuizProgress(childUserId!, accessToken!),
    enabled: isAuthenticated && !!accessToken && !!childUserId,
    // A 404 here means "no approved link to this child" — a fixed
    // authorization fact, not a transient failure. Retrying it just delays
    // the correct "can't show this" state reaching the user.
    retry: false,
  })
}
