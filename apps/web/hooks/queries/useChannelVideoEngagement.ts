'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  getChannelVideoLikeStatus,
  likeChannelVideo,
  unlikeChannelVideo,
  type ChannelVideoLikeStatus,
  getChannelVideoSaveStatus,
  saveChannelVideo,
  unsaveChannelVideo,
  type ChannelVideoSaveStatus,
  listChannelVideoComments,
  createChannelVideoComment,
  updateChannelVideoComment,
  deleteChannelVideoComment,
  type ChannelVideoComment,
} from '@services/organizations/channelVideos'

// Phase 4B — likes only. Follows the same status-query + two-mutation shape
// as useOrgFollowStatus/useFollowOrg/useUnfollowOrg (Phase 1C): anonymous
// viewers can read a public video's like status/count (is_liked is always
// false for them), so the query stays enabled without a token.
export function useChannelVideoLikeStatus(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<ChannelVideoLikeStatus>({
    queryKey: queryKeys.channelVideos.like(orgId!, channelVideoId!),
    queryFn: () => getChannelVideoLikeStatus(orgId!, channelVideoId!, accessToken),
    enabled: !!orgId && !!channelVideoId,
    staleTime: 30_000,
  })
}

export function useLikeChannelVideo(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => likeChannelVideo(orgId!, channelVideoId!, accessToken!),
    onSuccess: (data: ChannelVideoLikeStatus) => {
      queryClient.setQueryData(queryKeys.channelVideos.like(orgId!, channelVideoId!), data)
    },
  })
}

export function useUnlikeChannelVideo(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => unlikeChannelVideo(orgId!, channelVideoId!, accessToken!),
    onSuccess: (data: ChannelVideoLikeStatus) => {
      queryClient.setQueryData(queryKeys.channelVideos.like(orgId!, channelVideoId!), data)
    },
  })
}

// Phase 4D — saves. Same status-query + two-mutation shape as the Like hooks
// above, but with no public count: the status object only ever reflects the
// viewer's own save state.
export function useChannelVideoSaveStatus(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<ChannelVideoSaveStatus>({
    queryKey: queryKeys.channelVideos.save(orgId!, channelVideoId!),
    queryFn: () => getChannelVideoSaveStatus(orgId!, channelVideoId!, accessToken),
    enabled: !!orgId && !!channelVideoId,
    staleTime: 30_000,
  })
}

export function useSaveChannelVideo(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => saveChannelVideo(orgId!, channelVideoId!, accessToken!),
    onSuccess: (data: ChannelVideoSaveStatus) => {
      queryClient.setQueryData(queryKeys.channelVideos.save(orgId!, channelVideoId!), data)
    },
  })
}

export function useUnsaveChannelVideo(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => unsaveChannelVideo(orgId!, channelVideoId!, accessToken!),
    onSuccess: (data: ChannelVideoSaveStatus) => {
      queryClient.setQueryData(queryKeys.channelVideos.save(orgId!, channelVideoId!), data)
    },
  })
}

// Phase 4C — comments. Follows the same status-query + mutation shape as the
// Like hooks above: fetched once (no pagination UI, see channelVideos.ts),
// cache updated directly via setQueryData rather than a refetch round-trip.
export function useChannelVideoComments(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<ChannelVideoComment[]>({
    queryKey: queryKeys.channelVideos.comments(orgId!, channelVideoId!),
    queryFn: () => listChannelVideoComments(orgId!, channelVideoId!, accessToken),
    enabled: !!orgId && !!channelVideoId,
    staleTime: 30_000,
  })
}

export function useCreateChannelVideoComment(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) =>
      createChannelVideoComment(orgId!, channelVideoId!, content, accessToken!),
    onSuccess: (comment: ChannelVideoComment) => {
      const key = queryKeys.channelVideos.comments(orgId!, channelVideoId!)
      queryClient.setQueryData<ChannelVideoComment[]>(key, (prev) => [comment, ...(prev ?? [])])
    },
  })
}

export function useUpdateChannelVideoComment(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentUuid, content }: { commentUuid: string; content: string }) =>
      updateChannelVideoComment(orgId!, channelVideoId!, commentUuid, content, accessToken!),
    onSuccess: (comment: ChannelVideoComment) => {
      const key = queryKeys.channelVideos.comments(orgId!, channelVideoId!)
      queryClient.setQueryData<ChannelVideoComment[]>(key, (prev) =>
        (prev ?? []).map((c) => (c.comment_uuid === comment.comment_uuid ? comment : c))
      )
    },
  })
}

export function useDeleteChannelVideoComment(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentUuid: string) =>
      deleteChannelVideoComment(orgId!, channelVideoId!, commentUuid, accessToken!),
    onSuccess: (_data, commentUuid) => {
      const key = queryKeys.channelVideos.comments(orgId!, channelVideoId!)
      queryClient.setQueryData<ChannelVideoComment[]>(key, (prev) =>
        (prev ?? []).filter((c) => c.comment_uuid !== commentUuid)
      )
    },
  })
}
