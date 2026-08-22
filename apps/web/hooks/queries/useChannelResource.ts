'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  getChannelResource,
  getChannelResourceActivity,
  getChannelResourceCourse,
  listChannelResources,
  updateChannelResource,
  type ChannelResourceFilters,
  type ChannelResourceUpdateInput,
} from '@services/organizations/channelResources'
import { normalizeChannelResourceFilters } from '@services/organizations/channelResourceFilters'

// The channel resource listing (Phase 5C). The list endpoint itself already
// scopes results to what this viewer may see (published+public for
// anonymous/non-admin viewers, everything for this channel's owner/admins —
// see services/orgs/channel_resources.py `list_channel_resources`), so this
// hook does no client-side authorization filtering of its own. `filters` is
// normalized before it reaches the query key/fn so an all-empty filters
// object collapses back onto the same cache entry as the unfiltered list —
// same pattern as useChannelVideos.
export function useChannelResources(orgId: number | undefined, filters?: ChannelResourceFilters) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const normalizedFilters = normalizeChannelResourceFilters(filters)

  return useQuery({
    queryKey: queryKeys.channelResources.list(orgId!, normalizedFilters),
    queryFn: () => listChannelResources(orgId!, normalizedFilters, accessToken),
    enabled: !!orgId,
    staleTime: 30_000,
  })
}

export function useChannelResource(orgId: number | undefined, channelResourceId: string | number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.channelResources.detail(orgId!, channelResourceId!),
    queryFn: () => getChannelResource(orgId!, channelResourceId!, accessToken),
    enabled: !!orgId && !!channelResourceId,
    staleTime: 30_000,
    retry: false,
  })
}

export function useChannelResourceActivity(activityId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.activity.byId(activityId!),
    queryFn: () => getChannelResourceActivity(activityId!, accessToken),
    enabled: !!activityId,
    staleTime: 60_000,
    retry: false,
  })
}

// Invalidates both the list (channel grid) and this resource's own detail
// query so an edit shows up everywhere without a manual reload — same
// invalidation pattern as useUpdateChannelVideo.
export function useUpdateChannelResource(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      channelResourceId,
      data,
    }: {
      channelResourceId: number
      data: ChannelResourceUpdateInput
    }) => updateChannelResource(orgId!, channelResourceId, data, accessToken!),
    onSuccess: (_result, variables) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelResources.list(orgId) })
        queryClient.invalidateQueries({
          queryKey: queryKeys.channelResources.detail(orgId, variables.channelResourceId),
        })
      }
    },
  })
}

export function useChannelResourceCourse(courseId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.courses.byId(courseId!),
    queryFn: () => getChannelResourceCourse(courseId!, accessToken),
    enabled: !!courseId,
    staleTime: 60_000,
    retry: false,
  })
}
