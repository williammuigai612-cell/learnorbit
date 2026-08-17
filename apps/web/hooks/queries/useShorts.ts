'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { listPublicShorts } from '@services/organizations/shorts'

// Phase 3E queue source. A generous staleTime avoids refetching on every
// swipe/navigation within the queue (each Short navigation is a real route
// change that remounts this hook) while still picking up newly published
// Shorts on a fresh visit.
export function useShortsQueue() {
  return useQuery({
    queryKey: queryKeys.shorts.queue(),
    queryFn: () => listPublicShorts(),
    staleTime: 60_000,
  })
}
