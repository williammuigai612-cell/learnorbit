'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import { setOrgVerification } from '@services/organizations/verification'

// Phase 8C — superadmin-only toggle. Invalidates org.detail so the badge
// (ChannelHeader) and the settings toggle re-render with the new value.
export function useSetOrgVerification(orgId: number | undefined, orgSlug: string | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (isVerified: boolean) => setOrgVerification(orgId!, isVerified, accessToken!),
    onSuccess: () => {
      if (!orgSlug) return
      queryClient.invalidateQueries({ queryKey: queryKeys.org.detail(orgSlug) })
    },
  })
}
