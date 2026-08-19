'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { listHomeFeed } from '@services/organizations/feed'

// Phase 4G. Requires authentication (the API 401s otherwise) — disabled
// until a session with an access token and user id exists.
export function useHomeFeed() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const userId = session?.data?.user?.id as number | undefined
  const isAuthenticated = session?.status === 'authenticated'

  return useQuery({
    queryKey: queryKeys.feed.home(userId),
    queryFn: () => listHomeFeed(accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 30_000,
  })
}
