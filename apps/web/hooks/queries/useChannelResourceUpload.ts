'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  uploadChannelResource,
  type UploadChannelResourceInput,
} from '@services/organizations/channelResourceUpload'

type UploadArgs = Omit<UploadChannelResourceInput, 'orgId' | 'orgslug'>

export function useUploadChannelResource(orgId: number | undefined, orgslug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UploadArgs) =>
      uploadChannelResource({ ...input, orgId: orgId!, orgslug }, accessToken!),
    onSuccess: () => {
      // The channel listing (Phase 5C) reads this exact key — invalidating it
      // is the established pattern (see useUploadChannelVideo), so the new
      // resource shows up without hand-rolling any local list state.
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelResources.list(orgId) })
      }
    },
  })
}
