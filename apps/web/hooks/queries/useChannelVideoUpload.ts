'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  uploadChannelVideo,
  type UploadChannelVideoInput,
} from '@services/organizations/channelVideoUpload'

type UploadArgs = Omit<UploadChannelVideoInput, 'orgId' | 'orgslug'>

export function useUploadChannelVideo(orgId: number | undefined, orgslug: string) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ input, onProgress }: { input: UploadArgs; onProgress?: (_percent: number) => void }) =>
      uploadChannelVideo({ ...input, orgId: orgId!, orgslug }, accessToken!, onProgress),
    onSuccess: () => {
      // The channel listing (Phase 2E) reads this exact key — invalidating it
      // is the established pattern (see docs on useChannelVideos), so the new
      // video shows up without hand-rolling any local list state.
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelVideos.list(orgId) })
      }
    },
  })
}
