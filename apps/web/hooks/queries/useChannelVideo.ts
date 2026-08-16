'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  getChannelVideo,
  getChannelVideoActivity,
  getChannelVideoCourse,
  listChannelVideos,
  updateChannelVideo,
  type ChannelVideoFilters,
  type ChannelVideoUpdateInput,
} from '@services/organizations/channelVideos'
import { normalizeChannelVideoFilters } from '@services/organizations/channelVideoFilters'

// The channel video listing (Phase 2E). The list endpoint itself already
// scopes results to what this viewer may see (published+public for
// anonymous/non-admin viewers, everything for this channel's owner/admins —
// see services/orgs/channel_videos.py `list_channel_videos`), so this hook
// does no client-side authorization filtering of its own.
// Phase 2G-3: `filters` is normalized before it reaches the query key/fn so
// an all-empty filters object (e.g. every Select reset to "All") collapses
// back onto the same cache entry as the unfiltered list — no redundant
// network call when a caller passes `{}` instead of omitting the argument.
export function useChannelVideos(orgId: number | undefined, filters?: ChannelVideoFilters) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const normalizedFilters = normalizeChannelVideoFilters(filters)

  return useQuery({
    queryKey: queryKeys.channelVideos.list(orgId!, normalizedFilters),
    queryFn: () => listChannelVideos(orgId!, normalizedFilters, accessToken),
    enabled: !!orgId,
    staleTime: 30_000,
  })
}

export function useChannelVideo(orgId: number | undefined, channelVideoId: string | number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.channelVideos.detail(orgId!, channelVideoId!),
    queryFn: () => getChannelVideo(orgId!, channelVideoId!, accessToken),
    enabled: !!orgId && !!channelVideoId,
    staleTime: 30_000,
    retry: false,
  })
}

export function useChannelVideoActivity(activityId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.activity.byId(activityId!),
    queryFn: () => getChannelVideoActivity(activityId!, accessToken),
    enabled: !!activityId,
    staleTime: 60_000,
    retry: false,
  })
}

// Phase 2G-1 metadata edit. Invalidates both the list (Phase 2E's channel
// grid) and this video's own detail query (Phase 2D's watch page) so an edit
// shows up everywhere without a manual reload — same invalidation pattern as
// useUploadChannelVideo.
export function useUpdateChannelVideo(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      channelVideoId,
      data,
    }: {
      channelVideoId: number
      data: ChannelVideoUpdateInput
    }) => updateChannelVideo(orgId!, channelVideoId, data, accessToken!),
    onSuccess: (_result, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelVideos.list(orgId) })
        queryClient.invalidateQueries({
          queryKey: queryKeys.channelVideos.detail(orgId, variables.channelVideoId),
        })
      }
    },
  })
}

export function useChannelVideoCourse(courseId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.courses.byId(courseId!),
    queryFn: () => getChannelVideoCourse(courseId!, accessToken),
    enabled: !!courseId,
    staleTime: 60_000,
    retry: false,
  })
}
