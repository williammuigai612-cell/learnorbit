'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ClipboardList, Search, X, Trash2, RefreshCw, SearchX, FilterX, ListOrdered } from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import QuizFormModal from '@components/Objects/Dash/QuizFormModal'
import { Button } from '@components/ui/button'
import { Badge } from '@components/ui/badge'
import { Switch } from '@components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { useQuizzes, useDeleteQuiz, useSetQuizPublished } from '@/hooks/queries/useQuiz'
import { getQuizFilterOptions, applyPublishedFilter } from '@services/organizations/quizFilters'
import type { Quiz, QuizFilters } from '@services/organizations/quizzes'
import { formatRelative } from '@/lib/format'

type StringFilterField = 'subject' | 'level' | 'institution_context'
const ALL_VALUE = 'all'

const QUIZ_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  exam_practice: 'Exam practice',
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  )
}

interface QuizzesProps {
  orgslug: string
}

function QuizzesHome({ orgslug }: QuizzesProps) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined

  const [filters, setFilters] = useState<QuizFilters>({})
  const [publishedFilter, setPublishedFilterState] = useState<boolean | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: allQuizzes } = useQuizzes(orgId)
  const filterOptions = useMemo(() => getQuizFilterOptions(allQuizzes), [allQuizzes])
  const hasAnyQuizzesEver = (allQuizzes?.length ?? 0) > 0

  const hasActiveFilters = Boolean(
    filters.subject ||
      filters.level ||
      filters.institution_context ||
      filters.quiz_type ||
      typeof publishedFilter === 'boolean'
  )

  const { data: quizzes, isLoading, isError, refetch, isRefetching } = useQuizzes(orgId, filters)
  const deleteQuizMutation = useDeleteQuiz(orgId)
  const setPublishedMutation = useSetQuizPublished(orgId)

  const publishedFiltered = useMemo(
    () => applyPublishedFilter(quizzes, publishedFilter),
    [quizzes, publishedFilter]
  )
  const visibleQuizzes = useMemo(() => {
    if (!searchQuery.trim()) return publishedFiltered
    const q = searchQuery.trim().toLowerCase()
    return publishedFiltered.filter((quiz) => quiz.title.toLowerCase().includes(q))
  }, [publishedFiltered, searchQuery])

  const setStringFilter = (field: StringFilterField, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL_VALUE) delete next[field]
      else next[field] = value
      return next
    })
  }

  const setQuizTypeFilter = (value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL_VALUE) delete next.quiz_type
      else next.quiz_type = value
      return next
    })
  }

  const setPublishedFilter = (value: string) => {
    if (value === ALL_VALUE) setPublishedFilterState(undefined)
    else setPublishedFilterState(value === 'published')
  }

  const clearFilters = () => {
    setFilters({})
    setPublishedFilterState(undefined)
  }

  const handleDelete = async (quizId: number) => {
    try {
      await deleteQuizMutation.mutateAsync(quizId)
      toast.success(t('quiz.dash.deleteSuccess', { defaultValue: 'Quiz deleted.' }))
    } catch (err: any) {
      toast.error(err?.message || t('quiz.dash.deleteError', { defaultValue: 'Could not delete this quiz.' }))
    }
  }

  const handleTogglePublished = async (quizId: number, published: boolean) => {
    try {
      await setPublishedMutation.mutateAsync({ quizId, published })
    } catch (err: any) {
      toast.error(err?.message || t('quiz.dash.publishError', { defaultValue: 'Could not update this quiz.' }))
    }
  }

  if (!orgId) return null

  return (
    <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10">
      <div className="mb-6 pt-6">
        <Breadcrumbs
          items={[
            {
              label: t('quiz.dash.title', { defaultValue: 'Quizzes' }),
              href: '/dash/quizzes',
              icon: <ClipboardList size={14} />,
            },
          ]}
        />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">
            {t('quiz.dash.title', { defaultValue: 'Quizzes' })}
          </h1>
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="courses" orgId={orgId}>
            <QuizFormModal orgId={orgId} mode="create" />
          </AuthenticatedClientElement>
        </div>
      </div>

      {hasAnyQuizzesEver && (
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            {/* Phase 9C: placeholder-only search field with an unnamed clear
                button; the icon also sat below the 3:1 non-text floor. */}
            <Search
              aria-hidden="true"
              className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
            />
            <input
              type="search"
              aria-label={t('quiz.dash.search', { defaultValue: 'Search titles' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('quiz.dash.search', { defaultValue: 'Search titles' })}
              className="w-full ps-10 pe-10 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('common.clearSearch', { defaultValue: 'Clear search' })}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filters.subject ?? ALL_VALUE} onValueChange={(v) => setStringFilter('subject', v)}>
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

            <Select value={filters.level ?? ALL_VALUE} onValueChange={(v) => setStringFilter('level', v)}>
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

            <Select
              value={filters.institution_context ?? ALL_VALUE}
              onValueChange={(v) => setStringFilter('institution_context', v)}
            >
              <SelectTrigger className="w-auto min-w-36" aria-label={t('quiz.filters.institution', { defaultValue: 'Institution' })}>
                <SelectValue placeholder={t('quiz.filters.institution', { defaultValue: 'Institution' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('quiz.filters.allInstitutions', { defaultValue: 'All institutions' })}</SelectItem>
                {filterOptions.institutions.map((institution) => (
                  <SelectItem key={institution} value={institution}>{institution}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.quiz_type ?? ALL_VALUE} onValueChange={setQuizTypeFilter}>
              <SelectTrigger className="w-auto min-w-36" aria-label={t('quiz.filters.type', { defaultValue: 'Type' })}>
                <SelectValue placeholder={t('quiz.filters.type', { defaultValue: 'Type' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('quiz.filters.allTypes', { defaultValue: 'All types' })}</SelectItem>
                {filterOptions.quizTypes.map((type) => (
                  <SelectItem key={type} value={type}>{QUIZ_TYPE_LABELS[type] || type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={typeof publishedFilter === 'boolean' ? (publishedFilter ? 'published' : 'draft') : ALL_VALUE}
              onValueChange={setPublishedFilter}
            >
              <SelectTrigger className="w-auto min-w-36" aria-label={t('quiz.filters.status', { defaultValue: 'Status' })}>
                <SelectValue placeholder={t('quiz.filters.status', { defaultValue: 'Status' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('quiz.filters.allStatuses', { defaultValue: 'All statuses' })}</SelectItem>
                <SelectItem value="published">{t('quiz.filters.published', { defaultValue: 'Published' })}</SelectItem>
                <SelectItem value="draft">{t('quiz.filters.draft', { defaultValue: 'Draft' })}</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <FilterX size={14} aria-hidden="true" />
                {t('quiz.filters.clear', { defaultValue: 'Clear filters' })}
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('quiz.dash.error', { defaultValue: "Couldn't load this channel's quizzes." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : visibleQuizzes.length === 0 ? (
        hasActiveFilters || searchQuery ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <SearchX className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('quiz.dash.filteredEmpty.title', { defaultValue: 'No matching quizzes' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('quiz.dash.filteredEmpty.description', {
                defaultValue: 'No quizzes match these filters. Try a different combination.',
              })}
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
              {t('quiz.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ClipboardList className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('quiz.dash.empty.title', { defaultValue: 'No quizzes yet' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('quiz.dash.empty.description', {
                defaultValue: 'Create a quiz, then add questions from your bank to it.',
              })}
            </p>
          </div>
        )
      ) : (
        <div className="space-y-3 mb-8">
          {visibleQuizzes.map((quiz: Quiz) => (
            <div key={quiz.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}
                  </Badge>
                  {quiz.subject && <Badge variant="outline" className="text-[11px] font-normal">{quiz.subject}</Badge>}
                  {quiz.level && <Badge variant="outline" className="text-[11px] font-normal">{quiz.level}</Badge>}
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {t('quiz.dash.questionCount', { defaultValue: '{{count}} questions', count: quiz.question_count })}
                  </Badge>
                  {quiz.quiz_type === 'exam_practice' && quiz.time_limit_minutes && (
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {t('quiz.dash.timeLimit', { defaultValue: '{{minutes}} min', minutes: quiz.time_limit_minutes })}
                    </Badge>
                  )}
                  {!quiz.published && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {t('quiz.dash.draft', { defaultValue: 'Draft' })}
                    </Badge>
                  )}
                </div>
                <Link
                  href={getUriWithOrg(orgslug, `/dash/quizzes/${quiz.id}`)}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                >
                  {quiz.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('quiz.dash.updated', {
                    defaultValue: 'Updated {{date}}',
                    date: formatRelative(quiz.update_date, i18n.language),
                  })}
                </p>
              </div>

              <Link
                href={getUriWithOrg(orgslug, `/dash/quizzes/${quiz.id}`)}
                aria-label={t('quiz.dash.manageQuestions', { defaultValue: 'Manage questions' })}
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <ListOrdered size={16} aria-hidden="true" />
              </Link>

              <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="courses" orgId={orgId}>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                      checked={quiz.published}
                      onCheckedChange={(checked) => handleTogglePublished(quiz.id, checked)}
                    />
                    {t('quiz.dash.published', { defaultValue: 'Published' })}
                  </label>
                  <QuizFormModal orgId={orgId} mode="edit" quiz={quiz} />
                </div>
              </AuthenticatedClientElement>

              <AuthenticatedClientElement checkMethod="roles" action="delete" ressourceType="courses" orgId={orgId}>
                <ConfirmationModal
                  confirmationButtonText={t('quiz.dash.delete', { defaultValue: 'Delete' })}
                  confirmationMessage={t('quiz.dash.deleteConfirm', {
                    defaultValue: 'This quiz and its question attachments will be removed. This can’t be undone.',
                  })}
                  dialogTitle={t('quiz.dash.deleteTitle', { defaultValue: 'Delete quiz?' })}
                  dialogTrigger={
                    <button
                      type="button"
                      aria-label={t('quiz.dash.delete', { defaultValue: 'Delete' })}
                      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  }
                  functionToExecute={() => handleDelete(quiz.id)}
                  status="warning"
                />
              </AuthenticatedClientElement>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default QuizzesHome
