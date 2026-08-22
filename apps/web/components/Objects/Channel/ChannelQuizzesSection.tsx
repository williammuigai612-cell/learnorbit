'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ClipboardList, FilterX, RefreshCw, TrendingUp } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { useQuizzes } from '@/hooks/queries/useQuiz'
import type { QuizFilters } from '@services/organizations/quizzes'
import { getQuizFilterOptions } from '@services/organizations/quizFilters'
import QuizCard from './QuizCard'
import { Button } from '@components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'

interface ChannelQuizzesSectionProps {
  orgId: number | undefined
  orgslug: string
}

const ALL_VALUE = 'all'

function QuizCardSkeleton() {
  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden animate-pulse p-4 gap-2">
      <div className="w-10 h-10 rounded-md bg-muted" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  )
}

// Public/student-facing quiz listing (Phase 6E-3) — mirrors
// ChannelResourcesSection's structure. Unlike Resources/Videos, there is no
// upload/create trigger here: quiz authoring lives entirely in the channel
// dashboard (/dash/quizzes, Phase 6E-2); this section is read-only
// discovery. `useQuizzes` already scopes results to what this viewer may
// see (published+public for anon/non-admin, everything for this channel's
// admins) server-side, same as useChannelResources.
export default function ChannelQuizzesSection({ orgId, orgslug }: ChannelQuizzesSectionProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'
  const [filters, setFilters] = useState<QuizFilters>({})

  const { data: allQuizzes } = useQuizzes(orgId)
  const filterOptions = useMemo(() => getQuizFilterOptions(allQuizzes), [allQuizzes])
  const hasAnyQuizzesEver = (allQuizzes?.length ?? 0) > 0

  const hasActiveFilters = Boolean(filters.subject || filters.level || filters.quiz_type)
  const { data: quizzes, isLoading, isError, refetch, isRefetching } = useQuizzes(orgId, filters)

  const setFilter = (field: 'subject' | 'level' | 'quiz_type', value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL_VALUE) delete next[field]
      else next[field] = value
      return next
    })
  }
  const clearFilters = () => setFilters({})

  // No content and no error yet (org not resolved), or this channel simply
  // has no quizzes at all — render nothing rather than an empty section
  // shell, same as ChannelResourcesSection.
  if (!orgId || (!isLoading && !isError && !hasAnyQuizzesEver)) return null

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-card border border-border">
            <ClipboardList className="text-primary" size={16} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t('quiz.section.title', { defaultValue: 'Quizzes' })}
          </h2>
        </div>
        {isAuthenticated && (
          <Link
            href={getUriWithOrg(orgslug, '/progress')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <TrendingUp size={14} aria-hidden="true" />
            {t('progress.viewMyProgress', { defaultValue: 'My progress' })}
          </Link>
        )}
      </div>

      {hasAnyQuizzesEver && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filters.subject ?? ALL_VALUE} onValueChange={(v) => setFilter('subject', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('quiz.filters.subject', { defaultValue: 'Subject' })}>
              <SelectValue placeholder={t('quiz.filters.subject', { defaultValue: 'Subject' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('quiz.filters.allSubjects', { defaultValue: 'All subjects' })}</SelectItem>
              {filterOptions.subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.level ?? ALL_VALUE} onValueChange={(v) => setFilter('level', v)}>
            <SelectTrigger className="w-auto min-w-36" aria-label={t('quiz.filters.level', { defaultValue: 'Level' })}>
              <SelectValue placeholder={t('quiz.filters.level', { defaultValue: 'Level' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t('quiz.filters.allLevels', { defaultValue: 'All levels' })}</SelectItem>
              {filterOptions.levels.map((level) => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
              <FilterX size={14} aria-hidden="true" />
              {t('quiz.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('quiz.section.error', { defaultValue: "Couldn't load this channel's quizzes." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : !quizzes || quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('quiz.section.filteredEmpty.description', {
              defaultValue: 'No quizzes match these filters. Try a different combination.',
            })}
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
            {t('quiz.filters.clear', { defaultValue: 'Clear filters' })}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} orgslug={orgslug} />
          ))}
        </div>
      )}
    </div>
  )
}
