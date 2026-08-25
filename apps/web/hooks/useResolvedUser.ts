'use client'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import { getUser } from '@services/users/users'

// Resolves another user's public profile (UserReadPublic via GET
// /users/id/{id}) for display purposes — name/username/avatar. Shared by
// AccountFamily's row components and the child-activity view (Phase 7C).
//
// Phase 9B: this was a bare useEffect + useState fetch, which meant it sat
// outside the query cache entirely — every row issued its own request, two
// rows showing the same person issued two, and each remount refetched from
// scratch. As a useQuery it dedupes by user id, reuses the cache across
// mounts, and inherits the project's staleTime/retry defaults
// (lib/query/client.ts). The return shape is unchanged — the resolved user,
// or null while loading/on error — so call sites need no changes and keep
// rendering their own fallback label.
export function useResolvedUser(userId: number | undefined, accessToken: string) {
  const { data } = useQuery({
    queryKey: queryKeys.publicUsers.byId(userId),
    queryFn: () => getUser(String(userId), accessToken),
    enabled: !!userId,
  })

  return data ?? null
}
