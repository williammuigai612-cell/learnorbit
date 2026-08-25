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
  CHANNEL_VIDEO_COMMENTS_LIMIT,
  CHANNEL_VIDEO_COMMENTS_PREVIEW_LIMIT,
  createChannelVideoComment,
  updateChannelVideoComment,
  deleteChannelVideoComment,
  type ChannelVideoComment,
  getChannelVideoShareStatus,
  shareChannelVideo,
  type ChannelVideoShareStatus,
  reportChannelVideo,
  type ChannelVideoReportReason,
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
// Like hooks above: cache updated directly via setQueriesData rather than a
// refetch round-trip.
//
// Phase 9B: `expanded` selects between a small preview (panel closed — the
// trigger only needs a count badge) and the full fetch (panel open). The
// panel is mounted on every watch page and on both Shorts rails, so the
// unconditional 100-row fetch it used to issue was paid even by viewers who
// never opened it. The limit is part of the query key, so the preview can
// never be mistaken for the complete list.
export function useChannelVideoComments(
  orgId: number | undefined,
  channelVideoId: number | string | undefined,
  expanded = true
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const limit = expanded
    ? CHANNEL_VIDEO_COMMENTS_LIMIT
    : CHANNEL_VIDEO_COMMENTS_PREVIEW_LIMIT

  return useQuery<ChannelVideoComment[]>({
    queryKey: queryKeys.channelVideos.commentsPage(orgId!, channelVideoId!, limit),
    queryFn: () => listChannelVideoComments(orgId!, channelVideoId!, accessToken, limit),
    enabled: !!orgId && !!channelVideoId,
    staleTime: 30_000,
  })
}

// Keeps the preview and full-fetch cache entries in step: prefix-matching the
// base comments key updates every `limit` variant in one call, so a comment
// posted or removed while the panel is open is also reflected in the badge
// count the closed trigger reads.
function updateCommentCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  orgId: number,
  channelVideoId: number | string,
  updater: (_prev: ChannelVideoComment[] | undefined) => ChannelVideoComment[]
) {
  queryClient.setQueriesData<ChannelVideoComment[]>(
    { queryKey: queryKeys.channelVideos.comments(orgId, channelVideoId) },
    updater
  )
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
      updateCommentCaches(queryClient, orgId!, channelVideoId!, (prev) => [
        comment,
        ...(prev ?? []),
      ])
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
      updateCommentCaches(queryClient, orgId!, channelVideoId!, (prev) =>
        (prev ?? []).map((c) => (c.comment_uuid === comment.comment_uuid ? comment : c))
      )
    },
  })
}

// Phase 4E — shares. Same status-query shape as the Like hooks above, but
// the mutation has no "un-" counterpart: a share is an append-only event, so
// every call adds to share_count rather than toggling it.
export function useChannelVideoShareStatus(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery<ChannelVideoShareStatus>({
    queryKey: queryKeys.channelVideos.share(orgId!, channelVideoId!),
    queryFn: () => getChannelVideoShareStatus(orgId!, channelVideoId!, accessToken),
    enabled: !!orgId && !!channelVideoId,
    staleTime: 30_000,
  })
}

export function useShareChannelVideo(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => shareChannelVideo(orgId!, channelVideoId!, accessToken!),
    onSuccess: (data: ChannelVideoShareStatus) => {
      queryClient.setQueryData(queryKeys.channelVideos.share(orgId!, channelVideoId!), data)
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
      updateCommentCaches(queryClient, orgId!, channelVideoId!, (prev) =>
        (prev ?? []).filter((c) => c.comment_uuid !== commentUuid)
      )
    },
  })
}

// Phase 8A — reporting. No status query: a report has no toggle state to
// read back, unlike Like/Save/Share. Nothing else in the UI reads report
// data in this phase (no admin queue yet), so there is no cache to update.
export function useReportChannelVideo(
  orgId: number | undefined,
  channelVideoId: number | string | undefined
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useMutation({
    mutationFn: ({
      reason,
      details,
    }: {
      reason: ChannelVideoReportReason
      details?: string
    }) => reportChannelVideo(orgId!, channelVideoId!, reason, details, accessToken!),
  })
}
