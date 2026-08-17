'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Clapperboard, RefreshCw } from 'lucide-react'
import { useChannelVideos } from '@/hooks/queries/useChannelVideo'
import ChannelShortCard from './ChannelShortCard'
import UploadChannelVideoModal from './UploadChannelVideoModal'
import { Button } from '@components/ui/button'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'

interface ChannelShortsSectionProps {
  orgId: number | undefined
  orgslug: string
}

function ShortCardSkeleton() {
  return (
    <div className="flex w-36 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card animate-pulse sm:w-44">
      <div className="aspect-[9/16] w-full bg-muted" />
      <div className="flex flex-col gap-2 p-2.5">
        <div className="h-3.5 w-5/6 rounded bg-muted" />
        <div className="h-3.5 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}

// Channel-scoped counterpart of the Phase 2E ChannelVideosSection, reusing
// the same GET /orgs/{org_id}/videos endpoint with content_format=short
// (Phase 3B/3C) instead of a parallel data path. Deliberately filterless in
// 3G (subject/topic/level filtering can follow later if needed) and always
// rendered — including when this channel has zero Shorts — per the same
// "no videos yet" empty-state pattern already proven in ChannelVideosSection.
export default function ChannelShortsSection({ orgId, orgslug }: ChannelShortsSectionProps) {
  const { t } = useTranslation()

  const { data: shorts, isLoading, isError, refetch, isRefetching } = useChannelVideos(orgId, {
    content_format: 'short',
  })

  if (!orgId) return null

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-card border border-border">
            <Clapperboard className="text-primary" size={16} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t('short.section.title', { defaultValue: 'Shorts' })}
          </h2>
        </div>
        {/* Only this channel's owner/admins can see the upload action — real
            enforcement is server-side (POST /orgs/{id}/videos), same as the
            long-form Upload trigger in ChannelVideosSection. */}
        <AuthenticatedClientElement
          ressourceType="courses"
          action="create"
          checkMethod="roles"
          orgId={orgId}
        >
          <UploadChannelVideoModal orgId={orgId} orgslug={orgslug} defaultContentFormat="short" />
        </AuthenticatedClientElement>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShortCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('short.section.error', { defaultValue: "Couldn't load this channel's Shorts." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : !shorts || shorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Clapperboard className="text-muted-foreground" size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t('short.section.empty.title', { defaultValue: 'No Shorts yet' })}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('short.section.empty.description', {
              defaultValue: 'This channel hasn’t published any Shorts yet.',
            })}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {shorts.map((short: any) => (
            <ChannelShortCard key={short.id} channelVideo={short} orgslug={orgslug} orgId={orgId} />
          ))}
        </div>
      )}
    </div>
  )
}
