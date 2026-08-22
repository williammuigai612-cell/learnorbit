'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { queryKeys } from '@lib/query/keys'
import {
  listChannelVideoReports,
  resolveChannelVideoReport,
  type ChannelVideoReportResolution,
  type ChannelVideoReportStatus,
} from '@services/organizations/channelVideoReports'

// The admin moderation queue (Phase 8B). Admin-only end to end (see
// services/orgs/channel_video_reports.py's list_channel_video_reports), so
// the query is additionally gated on having an access token — same pattern
// as useQuestions.
export function useChannelVideoReports(
  orgId: number | undefined,
  status?: ChannelVideoReportStatus
) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined

  return useQuery({
    queryKey: queryKeys.channelVideoReports.list(orgId!, status),
    queryFn: () => listChannelVideoReports(orgId!, status, accessToken),
    enabled: !!orgId && !!accessToken,
    staleTime: 30_000,
  })
}

export function useResolveChannelVideoReport(orgId: number | undefined) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token as string | undefined
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      reportUuid,
      status,
    }: {
      reportUuid: string
      status: ChannelVideoReportResolution
    }) => resolveChannelVideoReport(orgId!, reportUuid, status, accessToken!),
    onSuccess: () => {
      if (!orgId) return
      queryClient.invalidateQueries({ queryKey: queryKeys.channelVideoReports.list(orgId) })
    },
  })
}
