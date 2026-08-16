'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterX, RefreshCw, SearchX, Video as VideoIcon } from 'lucide-react'
import { useChannelVideos } from '@/hooks/queries/useChannelVideo'
import type { ChannelVideoFilters } from '@services/organizations/channelVideos'
import { getChannelVideoFilterOptions } from '@services/organizations/channelVideoFilters'
import ChannelVideoCard from './ChannelVideoCard'
import UploadChannelVideoModal from './UploadChannelVideoModal'
import { Button } from '@components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'

interface ChannelVideosSectionProps {
  orgId: number | undefined
  orgslug: string
}

const ALL_VALUE = 'all'

type FilterField = keyof ChannelVideoFilters

function VideoCardSkeleton() {
  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-muted" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

export default function ChannelVideosSection({ orgId, orgslug }: ChannelVideosSectionProps) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<ChannelVideoFilters>({})

  // Unfiltered baseline — its only job is supplying the distinct Subject/
  // Topic/Level values for the filter dropdowns, so options never disappear
  // out from under a selection already made. When `filters` is empty this
  // shares its cache entry (and network request) with the query below.
  const { data: allVideos } = useChannelVideos(orgId)
  const filterOptions = useMemo(() => getChannelVideoFilterOptions(allVideos), [allVideos])
  const hasAnyVideosEver = (allVideos?.length ?? 0) > 0

  const hasActiveFilters = Boolean(filters.subject || filters.topic || filters.level)
  const { data: videos, isLoading, isError, refetch, isRefetching } = useChannelVideos(orgId, filters)

  const setFilter = (field: FilterField, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL_VALUE) {
        delete next[field]
      } else {
        next[field] = value
      }
      return next
    })
  }
  const clearFilters = () => setFilters({})

  // No content and no error yet (org not resolved) — render nothing rather
  // than an empty section shell.
  if (!orgId) return null

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-card border border-border">
            <VideoIcon className="text-primary" size={16} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t('video.section.title', { defaultValue: 'Videos' })}
          </h2>
        </div>
        {/* Only this channel's owner/admins can see the upload action — the
            real enforcement is server-side (POST /orgs/{id}/videos and the
            course/chapter/activity endpoints all require org-admin), this
            just avoids showing a control a normal visitor can't use. */}
        <AuthenticatedClientElement
          ressourceType="courses"
          action="create"
          checkMethod="roles"
          orgId={orgId}
        >
          <UploadChannelVideoModal orgId={orgId} orgslug={orgslug} />
        </AuthenticatedClientElement>
      </div>

      {hasAnyVideosEver && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filters.subject ?? ALL_VALUE} onValueChange={(v) => setFilter('subject', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('video.filters.subject', { defaultValue: 'Subject' })}>
              <SelectValue placeholder={t('video.filters.subject', { defaultValue: 'Subject' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('video.filters.allSubjects', { defaultValue: 'All subjects' })}</SelectItem>
              {filterOptions.subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.topic ?? ALL_VALUE} onValueChange={(v) => setFilter('topic', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('video.filters.topic', { defaultValue: 'Topic' })}>
              <SelectValue placeholder={t('video.filters.topic', { defaultValue: 'Topic' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('video.filters.allTopics', { defaultValue: 'All topics' })}</SelectItem>
              {filterOptions.topics.map((topic) => (
                <SelectItem key={topic} value={topic}>{topic}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.level ?? ALL_VALUE} onValueChange={(v) => setFilter('level', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('video.filters.level', { defaultValue: 'Level' })}>
              <SelectValue placeholder={t('video.filters.level', { defaultValue: 'Level' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('video.filters.allLevels', { defaultValue: 'All levels' })}</SelectItem>
              {filterOptions.levels.map((level) => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
              <FilterX size={14} aria-hidden="true" />
              {t('video.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('video.section.error', { defaultValue: "Couldn't load this channel's videos." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : !videos || videos.length === 0 ? (
        hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <SearchX className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('video.section.filteredEmpty.title', { defaultValue: 'No matching videos' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('video.section.filteredEmpty.description', {
                defaultValue: 'No videos match these filters. Try a different combination.',
              })}
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
              {t('video.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <VideoIcon className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('video.section.empty.title', { defaultValue: 'No videos yet' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('video.section.empty.description', {
                defaultValue: 'This channel hasn’t published any videos yet.',
              })}
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video: any) => (
            <ChannelVideoCard key={video.id} channelVideo={video} orgslug={orgslug} orgId={orgId} />
          ))}
        </div>
      )}
    </div>
  )
}
