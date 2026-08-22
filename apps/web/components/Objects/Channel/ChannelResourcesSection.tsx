'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, FilterX, RefreshCw, SearchX } from 'lucide-react'
import { useChannelResources } from '@/hooks/queries/useChannelResource'
import type { ChannelResourceFilters } from '@services/organizations/channelResources'
import { getChannelResourceFilterOptions } from '@services/organizations/channelResourceFilters'
import ChannelResourceCard from './ChannelResourceCard'
import UploadChannelResourceModal from './UploadChannelResourceModal'
import { Button } from '@components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'

interface ChannelResourcesSectionProps {
  orgId: number | undefined
  orgslug: string
}

const ALL_VALUE = 'all'

// docs/DESIGN_SYSTEM.md §18 "Resource filters": subject/level/institution/type
// as dropdown filters — topic and year are supported server-side (Phase 5B)
// but not surfaced here.
type FilterField = 'subject' | 'level' | 'institution_context' | 'resource_type'

function ResourceCardSkeleton() {
  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden animate-pulse">
      <div className="w-full aspect-[4/3] bg-muted" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

export default function ChannelResourcesSection({ orgId, orgslug }: ChannelResourcesSectionProps) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<ChannelResourceFilters>({})

  // Unfiltered baseline — its only job is supplying the distinct filter-option
  // values, so options never disappear out from under a selection already
  // made. When `filters` is empty this shares its cache entry (and network
  // request) with the query below — same pattern as ChannelVideosSection.
  const { data: allResources } = useChannelResources(orgId)
  const filterOptions = useMemo(() => getChannelResourceFilterOptions(allResources), [allResources])
  const hasAnyResourcesEver = (allResources?.length ?? 0) > 0

  const hasActiveFilters = Boolean(
    filters.subject || filters.level || filters.institution_context || filters.resource_type
  )
  const { data: resources, isLoading, isError, refetch, isRefetching } = useChannelResources(orgId, filters)

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
            <FileText className="text-primary" size={16} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t('resource.section.title', { defaultValue: 'Resources' })}
          </h2>
        </div>
        {/* Only this channel's owner/admins can see the upload action — the
            real enforcement is server-side (POST /orgs/{id}/resources and
            the course/chapter/activity endpoints all require org-admin),
            this just avoids showing a control a normal visitor can't use. */}
        <AuthenticatedClientElement
          ressourceType="courses"
          action="create"
          checkMethod="roles"
          orgId={orgId}
        >
          <UploadChannelResourceModal orgId={orgId} orgslug={orgslug} />
        </AuthenticatedClientElement>
      </div>

      {hasAnyResourcesEver && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filters.subject ?? ALL_VALUE} onValueChange={(v) => setFilter('subject', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('resource.filters.subject', { defaultValue: 'Subject' })}>
              <SelectValue placeholder={t('resource.filters.subject', { defaultValue: 'Subject' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('resource.filters.allSubjects', { defaultValue: 'All subjects' })}</SelectItem>
              {filterOptions.subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.level ?? ALL_VALUE} onValueChange={(v) => setFilter('level', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('resource.filters.level', { defaultValue: 'Level' })}>
              <SelectValue placeholder={t('resource.filters.level', { defaultValue: 'Level' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('resource.filters.allLevels', { defaultValue: 'All levels' })}</SelectItem>
              {filterOptions.levels.map((level) => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.institution_context ?? ALL_VALUE} onValueChange={(v) => setFilter('institution_context', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('resource.filters.institution', { defaultValue: 'Institution' })}>
              <SelectValue placeholder={t('resource.filters.institution', { defaultValue: 'Institution' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('resource.filters.allInstitutions', { defaultValue: 'All institutions' })}</SelectItem>
              {filterOptions.institutions.map((institution) => (
                <SelectItem key={institution} value={institution}>{institution}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.resource_type ?? ALL_VALUE} onValueChange={(v) => setFilter('resource_type', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('resource.filters.resourceType', { defaultValue: 'Type' })}>
              <SelectValue placeholder={t('resource.filters.resourceType', { defaultValue: 'Type' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('resource.filters.allResourceTypes', { defaultValue: 'All types' })}</SelectItem>
              {filterOptions.resourceTypes.map((resourceType) => (
                <SelectItem key={resourceType} value={resourceType}>{resourceType}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
              <FilterX size={14} aria-hidden="true" />
              {t('resource.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('resource.section.error', { defaultValue: "Couldn't load this channel's resources." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : !resources || resources.length === 0 ? (
        hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <SearchX className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('resource.section.filteredEmpty.title', { defaultValue: 'No matching resources' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('resource.section.filteredEmpty.description', {
                defaultValue: 'No resources match these filters. Try a different combination.',
              })}
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
              {t('resource.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('resource.section.empty.title', { defaultValue: 'No resources yet' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('resource.section.empty.description', {
                defaultValue: 'This channel hasn’t published any resources yet.',
              })}
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {resources.map((resource: any) => (
            <ChannelResourceCard key={resource.id} channelResource={resource} orgslug={orgslug} orgId={orgId} />
          ))}
        </div>
      )}
    </div>
  )
}
