'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useReportChannelVideo } from '@/hooks/queries/useChannelVideoEngagement'
import type { ChannelVideoReportReason } from '@services/organizations/channelVideos'
import { Button } from '@components/ui/button'
import { Textarea } from '@components/ui/textarea'
import { Label } from '@components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'

// Kept in sync manually with ALLOWED_REPORT_REASONS in
// services/orgs/channel_video_reports.py — a Phase 8A placeholder set, not
// sourced from any real moderation policy yet.
const REPORT_REASONS: { value: ChannelVideoReportReason; labelKey: string; defaultLabel: string }[] = [
  { value: 'SPAM', labelKey: 'video.report.reasonSpam', defaultLabel: 'Spam' },
  { value: 'INAPPROPRIATE', labelKey: 'video.report.reasonInappropriate', defaultLabel: 'Inappropriate content' },
  { value: 'MISINFORMATION', labelKey: 'video.report.reasonMisinformation', defaultLabel: 'Misinformation' },
  { value: 'COPYRIGHT', labelKey: 'video.report.reasonCopyright', defaultLabel: 'Copyright violation' },
  { value: 'OTHER', labelKey: 'video.report.reasonOther', defaultLabel: 'Other' },
]

const MAX_DETAILS_LENGTH = 1000

interface ReportChannelVideoDialogProps {
  orgId: number | undefined
  channelVideoId: number | string | undefined
  /** Icon-only trigger for the Shorts rail (Phase 4F-style layout) instead
   * of the default ghost Button used on the long-form watch page. */
  variant?: 'default' | 'rail'
}

export function ReportChannelVideoDialog({ orgId, channelVideoId, variant = 'default' }: ReportChannelVideoDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ChannelVideoReportReason | ''>('')
  const [details, setDetails] = useState('')

  const reportVideo = useReportChannelVideo(orgId, channelVideoId)

  const detailsOverLimit = details.length > MAX_DETAILS_LENGTH
  const canSubmit = !!reason && !detailsOverLimit && !reportVideo.isPending

  const resetAndClose = () => {
    setReason('')
    setDetails('')
    setOpen(false)
  }

  const handleSubmit = () => {
    if (!canSubmit || !reason) return
    reportVideo.mutate(
      { reason, details: details.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            t('video.report.submitted', { defaultValue: "Thanks, we'll review this." })
          )
          resetAndClose()
        },
        onError: (err: any) => {
          toast.error(
            err?.detail || err?.message || t('video.report.failed', { defaultValue: 'Failed to submit report' })
          )
        },
      }
    )
  }

  const triggerLabel = t('video.report.open', { defaultValue: 'Report this video' })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        {variant === 'rail' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={triggerLabel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm ring-1 ring-white/20 hover:bg-black/50 hover:text-white"
          >
            <Flag size={18} aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={triggerLabel}
            className="px-2 text-muted-foreground"
          >
            <Flag size={16} aria-hidden="true" />
          </Button>
        )}
      </DialogTrigger>
      {/* Phase 9D (M6): same per-dialog sizing as the comments panel — inset
          from the viewport edges below sm, and capped in dvh so the reason
          select and the details textarea stay reachable with the on-screen
          keyboard up. `overflow-y-auto` because, unlike the comments panel,
          this dialog has no inner scroll area of its own. */}
      <DialogContent className="w-[95vw] sm:w-full max-h-[85dvh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{t('video.report.title', { defaultValue: 'Report this video' })}</DialogTitle>
          <DialogDescription>
            {t('video.report.description', {
              defaultValue: 'Let us know what’s wrong. Our team will review this video.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">{t('video.report.reasonLabel', { defaultValue: 'Reason' })}</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as ChannelVideoReportReason)}>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder={t('video.report.reasonPlaceholder', { defaultValue: 'Select a reason' })} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.labelKey, { defaultValue: r.defaultLabel })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-details">
              {t('video.report.detailsLabel', { defaultValue: 'Additional details (optional)' })}
            </Label>
            <Textarea
              id="report-details"
              aria-describedby="report-details-count"
              aria-invalid={detailsOverLimit || undefined}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder={t('video.report.detailsPlaceholder', { defaultValue: 'Anything else we should know?' })}
            />
            {/* Phase 9C: same counter treatment as ChannelVideoCommentsPanel —
                associated with the field, and over-limit pairs color with an
                icon + wording rather than relying on color alone (§22). */}
            <span
              id="report-details-count"
              className={`text-xs ${detailsOverLimit ? 'inline-flex items-center gap-1 font-semibold text-destructive' : 'text-muted-foreground'}`}
            >
              {detailsOverLimit ? (
                <>
                  <AlertCircle size={12} aria-hidden="true" />
                  {t('video.report.overLimit', {
                    defaultValue: '{{count}} over the limit',
                    count: details.length - MAX_DETAILS_LENGTH,
                  })}
                </>
              ) : (
                <>
                  <span aria-hidden="true">{MAX_DETAILS_LENGTH - details.length}</span>
                  <span className="sr-only">
                    {t('video.report.charactersRemaining', {
                      defaultValue: '{{count}} characters remaining',
                      count: MAX_DETAILS_LENGTH - details.length,
                    })}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={resetAndClose} disabled={reportVideo.isPending}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {t('video.report.submit', { defaultValue: 'Submit report' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReportChannelVideoDialog
