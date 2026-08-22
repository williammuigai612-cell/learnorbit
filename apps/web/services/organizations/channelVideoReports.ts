import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'
import type { ChannelVideoReport } from './channelVideos'

export type { ChannelVideoReport }

/*
 Fetchers for the LearnOrbit admin moderation queue (Phase 8B). Wraps the
 Phase 8B GET/PATCH /orgs/{org_id}/reports... endpoints — channel owner/admin
 only end to end (see services/orgs/channel_video_reports.py's
 list_channel_video_reports/resolve_channel_video_report) — with
 `errorHandling` so a 401/403/404/422 surfaces as a thrown, status-tagged
 error rather than a swallowed body. Mirrors questions.ts's admin-only
 fetcher shape.
*/

export type ChannelVideoReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'

/** Valid targets for resolveChannelVideoReport — "OPEN" is only ever set at
 * creation time and can't be reopened via this endpoint (matches the
 * backend's ALLOWED_REPORT_STATUSES). */
export type ChannelVideoReportResolution = 'RESOLVED' | 'DISMISSED'

export async function listChannelVideoReports(
  org_id: number,
  status: ChannelVideoReportStatus | undefined,
  access_token?: string
): Promise<ChannelVideoReport[]> {
  const query = status ? `?status=${status}` : ''
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/reports${query}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function resolveChannelVideoReport(
  org_id: number,
  report_uuid: string,
  status: ChannelVideoReportResolution,
  access_token: string
): Promise<ChannelVideoReport> {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/reports/${report_uuid}`,
    RequestBodyWithAuthHeader('PATCH', { status }, null, access_token)
  )
  return errorHandling(result)
}
