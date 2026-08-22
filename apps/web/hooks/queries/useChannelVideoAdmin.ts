'use client'

import { useMutation } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { setChannelVideoPublished, deleteChannelVideo } from '@services/organizations/channelVideos'

// Owner/admin-only video actions (Phase 8D moderation-queue quick actions).
// Deliberately not invalidating/touching the reports list — resolving a
// report stays a fully separate action, matching Phase 8B's "no cascading
// action on the reported video" decision.
export function useSetChannelVideoPublished(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useMutation({
    mutationFn: ({ channelVideoId, published }: { channelVideoId: number; published: boolean }) =>
      setChannelVideoPublished(orgId!, channelVideoId, published, accessToken!),
  })
}

export function useDeleteChannelVideo(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useMutation({
    mutationFn: (channelVideoId: number) => deleteChannelVideo(orgId!, channelVideoId, accessToken!),
  })
}
