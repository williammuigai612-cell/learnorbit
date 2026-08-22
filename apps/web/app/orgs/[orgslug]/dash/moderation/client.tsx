'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Flag, RefreshCw, ShieldCheck, PlayCircle, EyeOff, Trash2, Loader2 } from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { Button } from '@components/ui/button'
import { Badge } from '@components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  useChannelVideoReports,
  useResolveChannelVideoReport,
} from '@/hooks/queries/useChannelVideoReports'
import {
  useSetChannelVideoPublished,
  useDeleteChannelVideo,
} from '@/hooks/queries/useChannelVideoAdmin'
import type {
  ChannelVideoReport,
  ChannelVideoReportStatus,
} from '@services/organizations/channelVideoReports'
import { getUriWithOrg } from '@services/config/config'
import { formatRelative } from '@/lib/format'

const REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  INAPPROPRIATE: 'Inappropriate',
  MISINFORMATION: 'Misinformation',
  COPYRIGHT: 'Copyright',
  OTHER: 'Other',
}

const STATUS_TABS: { value: ChannelVideoReportStatus | 'ALL'; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'ALL', label: 'All' },
]

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  )
}

interface ModerationProps {
  orgslug: string
}

function ModerationHome({ orgslug }: ModerationProps) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined

  const [tab, setTab] = useState<ChannelVideoReportStatus | 'ALL'>('OPEN')
  const statusFilter = tab === 'ALL' ? undefined : tab

  const { data: reports, isLoading, isError, refetch, isRefetching } = useChannelVideoReports(
    orgId,
    statusFilter
  )
  const resolveMutation = useResolveChannelVideoReport(orgId)
  const setPublishedMutation = useSetChannelVideoPublished(orgId)
  const deleteVideoMutation = useDeleteChannelVideo(orgId)

  const handleReview = async (reportUuid: string, status: 'RESOLVED' | 'DISMISSED') => {
    try {
      await resolveMutation.mutateAsync({ reportUuid, status })
      toast.success(
        status === 'RESOLVED'
          ? t('moderation.resolveSuccess', { defaultValue: 'Report marked resolved.' })
          : t('moderation.dismissSuccess', { defaultValue: 'Report dismissed.' })
      )
    } catch (err: any) {
      toast.error(
        err?.message || t('moderation.reviewError', { defaultValue: 'Could not update this report.' })
      )
    }
  }

  // Phase 8D — quick actions on the reported video itself. Deliberately
  // independent of handleReview: unpublishing/deleting never auto-resolves
  // the report, matching Phase 8B's "no cascading action" decision.
  const handleUnpublish = async (channelVideoId: number) => {
    try {
      await setPublishedMutation.mutateAsync({ channelVideoId, published: false })
      toast.success(t('moderation.unpublishSuccess', { defaultValue: 'Video unpublished.' }))
    } catch (err: any) {
      toast.error(
        err?.message || t('moderation.unpublishError', { defaultValue: 'Could not unpublish this video.' })
      )
    }
  }

  const handleDeleteVideo = async (channelVideoId: number) => {
    try {
      await deleteVideoMutation.mutateAsync(channelVideoId)
      toast.success(t('moderation.deleteVideoSuccess', { defaultValue: 'Video removed.' }))
    } catch (err: any) {
      toast.error(
        err?.message || t('moderation.deleteVideoError', { defaultValue: 'Could not remove this video.' })
      )
    }
  }

  if (!orgId) return null

  return (
    <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10">
      <div className="mb-6 pt-6">
        <Breadcrumbs
          items={[
            {
              label: t('moderation.title', { defaultValue: 'Moderation' }),
              href: '/dash/moderation',
              icon: <Flag size={14} />,
            },
          ]}
        />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">
            {t('moderation.title', { defaultValue: 'Moderation' })}
          </h1>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <Select value={tab} onValueChange={(v) => setTab(v as ChannelVideoReportStatus | 'ALL')}>
          <SelectTrigger className="w-auto min-w-36" aria-label={t('moderation.filters.status', { defaultValue: 'Status' })}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_TABS.map((tabOption) => (
              <SelectItem key={tabOption.value} value={tabOption.value}>
                {t(`moderation.status.${tabOption.value.toLowerCase()}`, { defaultValue: tabOption.label })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('moderation.error', { defaultValue: "Couldn't load this channel's reports." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : !reports || reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <ShieldCheck className="text-muted-foreground" size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t('moderation.empty.title', { defaultValue: 'No reports here' })}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('moderation.empty.description', {
              defaultValue: 'Nothing needs review right now.',
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {reports.map((report: ChannelVideoReport) => (
            <div key={report.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {REASON_LABELS[report.reason] || report.reason}
                  </Badge>
                  {report.status !== 'OPEN' && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {t(`moderation.status.${report.status.toLowerCase()}`, { defaultValue: report.status })}
                    </Badge>
                  )}
                </div>
                {report.details && (
                  <p className="text-sm text-foreground line-clamp-2">{report.details}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t('moderation.reported', {
                    defaultValue: 'Reported {{date}}',
                    date: formatRelative(report.creation_date, i18n.language),
                  })}
                </p>
                <a
                  href={getUriWithOrg(orgslug, `/videos/${report.channelvideo_id}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                >
                  <PlayCircle size={12} aria-hidden="true" />
                  {t('moderation.viewVideo', { defaultValue: 'View video' })}
                </a>
              </div>

              {report.status === 'OPEN' && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setPublishedMutation.isPending}
                    onClick={() => handleUnpublish(report.channelvideo_id)}
                  >
                    {setPublishedMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <EyeOff size={14} aria-hidden="true" />
                    )}
                    {t('moderation.unpublish', { defaultValue: 'Unpublish' })}
                  </Button>
                  <ConfirmationModal
                    confirmationButtonText={t('moderation.deleteVideo', { defaultValue: 'Delete video' })}
                    confirmationMessage={t('moderation.deleteVideoConfirm', {
                      defaultValue: 'This removes the video from the channel. This cannot be undone.',
                    })}
                    dialogTitle={t('moderation.deleteVideo', { defaultValue: 'Delete video' })}
                    status="warning"
                    functionToExecute={() => handleDeleteVideo(report.channelvideo_id)}
                    dialogTrigger={
                      <button
                        type="button"
                        disabled={deleteVideoMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                      >
                        {deleteVideoMutation.isPending ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 size={14} aria-hidden="true" />
                        )}
                        {t('moderation.deleteVideo', { defaultValue: 'Delete video' })}
                      </button>
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resolveMutation.isPending}
                    onClick={() => handleReview(report.report_uuid, 'DISMISSED')}
                  >
                    {t('moderation.dismiss', { defaultValue: 'Dismiss' })}
                  </Button>
                  <Button
                    size="sm"
                    disabled={resolveMutation.isPending}
                    onClick={() => handleReview(report.report_uuid, 'RESOLVED')}
                  >
                    {t('moderation.resolve', { defaultValue: 'Resolve' })}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ModerationHome
