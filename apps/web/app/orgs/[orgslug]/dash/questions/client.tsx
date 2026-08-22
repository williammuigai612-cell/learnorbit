'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ListChecks, Search, X, Trash2, RefreshCw, SearchX, FilterX } from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import QuestionFormModal from '@components/Objects/Dash/QuestionFormModal'
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
import { useQuestions, useDeleteQuestion, useSetQuestionPublished } from '@/hooks/queries/useQuestion'
import { getQuestionFilterOptions, applyQuestionTypeFilter } from '@services/organizations/questionFilters'
import type { Question, QuestionFilters } from '@services/organizations/questions'
import { formatRelative } from '@/lib/format'

type StringFilterField = 'subject' | 'level' | 'institution_context'
const ALL_VALUE = 'all'

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  short_answer: 'Short answer',
  number_answer: 'Number answer',
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  )
}

interface QuestionsProps {
  orgslug: string
}

function QuestionsHome({ orgslug: _orgslug }: QuestionsProps) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined

  const [filters, setFilters] = useState<QuestionFilters>({})
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Unfiltered baseline — its only job is supplying the distinct filter-option
  // values, so options never disappear out from under a selection already
  // made — same pattern as ChannelResourcesSection.
  const { data: allQuestions } = useQuestions(orgId)
  const filterOptions = useMemo(() => getQuestionFilterOptions(allQuestions), [allQuestions])
  const hasAnyQuestionsEver = (allQuestions?.length ?? 0) > 0

  const hasActiveFilters = Boolean(
    filters.subject ||
      filters.level ||
      filters.institution_context ||
      typeof filters.published === 'boolean' ||
      questionTypeFilter
  )

  const { data: questions, isLoading, isError, refetch, isRefetching } = useQuestions(orgId, filters)
  const deleteQuestionMutation = useDeleteQuestion(orgId)
  const setPublishedMutation = useSetQuestionPublished(orgId)

  // question_type has no server-side filter (see questionFilters.ts), so it's
  // applied here over the already (server-)filtered list, then search is
  // applied client-side on top of that.
  const typeFiltered = useMemo(
    () => applyQuestionTypeFilter(questions, questionTypeFilter || undefined),
    [questions, questionTypeFilter]
  )
  const visibleQuestions = useMemo(() => {
    if (!searchQuery.trim()) return typeFiltered
    const q = searchQuery.trim().toLowerCase()
    return typeFiltered.filter((question) => question.prompt.toLowerCase().includes(q))
  }, [typeFiltered, searchQuery])

  const setStringFilter = (field: StringFilterField, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL_VALUE) delete next[field]
      else next[field] = value
      return next
    })
  }

  const setPublishedFilter = (value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL_VALUE) delete next.published
      else next.published = value === 'published'
      return next
    })
  }

  const clearFilters = () => {
    setFilters({})
    setQuestionTypeFilter('')
  }

  const handleDelete = async (questionId: number) => {
    try {
      await deleteQuestionMutation.mutateAsync(questionId)
      toast.success(t('question.dash.deleteSuccess', { defaultValue: 'Question deleted.' }))
    } catch (err: any) {
      toast.error(
        err?.message || t('question.dash.deleteError', { defaultValue: 'Could not delete this question.' })
      )
    }
  }

  const handleTogglePublished = async (questionId: number, published: boolean) => {
    try {
      await setPublishedMutation.mutateAsync({ questionId, published })
    } catch (err: any) {
      toast.error(
        err?.message || t('question.dash.publishError', { defaultValue: 'Could not update this question.' })
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
              label: t('question.dash.title', { defaultValue: 'Question bank' }),
              href: '/dash/questions',
              icon: <ListChecks size={14} />,
            },
          ]}
        />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
          <h1 className="text-3xl font-bold mb-4 sm:mb-0">
            {t('question.dash.title', { defaultValue: 'Question bank' })}
          </h1>
          <AuthenticatedClientElement checkMethod="roles" action="create" ressourceType="courses" orgId={orgId}>
            <QuestionFormModal orgId={orgId} mode="create" />
          </AuthenticatedClientElement>
        </div>
      </div>

      {hasAnyQuestionsEver && (
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('question.dash.search', { defaultValue: 'Search prompts' })}
              className="w-full ps-10 pe-10 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filters.subject ?? ALL_VALUE} onValueChange={(v) => setStringFilter('subject', v)}>
              <SelectTrigger className="w-auto min-w-36" aria-label={t('question.filters.subject', { defaultValue: 'Subject' })}>
                <SelectValue placeholder={t('question.filters.subject', { defaultValue: 'Subject' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('question.filters.allSubjects', { defaultValue: 'All subjects' })}</SelectItem>
                {filterOptions.subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.level ?? ALL_VALUE} onValueChange={(v) => setStringFilter('level', v)}>
              <SelectTrigger className="w-auto min-w-36" aria-label={t('question.filters.level', { defaultValue: 'Level' })}>
                <SelectValue placeholder={t('question.filters.level', { defaultValue: 'Level' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('question.filters.allLevels', { defaultValue: 'All levels' })}</SelectItem>
                {filterOptions.levels.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.institution_context ?? ALL_VALUE}
              onValueChange={(v) => setStringFilter('institution_context', v)}
            >
              <SelectTrigger className="w-auto min-w-36" aria-label={t('question.filters.institution', { defaultValue: 'Institution' })}>
                <SelectValue placeholder={t('question.filters.institution', { defaultValue: 'Institution' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('question.filters.allInstitutions', { defaultValue: 'All institutions' })}</SelectItem>
                {filterOptions.institutions.map((institution) => (
                  <SelectItem key={institution} value={institution}>{institution}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={questionTypeFilter || ALL_VALUE} onValueChange={(v) => setQuestionTypeFilter(v === ALL_VALUE ? '' : v)}>
              <SelectTrigger className="w-auto min-w-36" aria-label={t('question.filters.type', { defaultValue: 'Type' })}>
                <SelectValue placeholder={t('question.filters.type', { defaultValue: 'Type' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('question.filters.allTypes', { defaultValue: 'All types' })}</SelectItem>
                {filterOptions.questionTypes.map((type) => (
                  <SelectItem key={type} value={type}>{QUESTION_TYPE_LABELS[type] || type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={typeof filters.published === 'boolean' ? (filters.published ? 'published' : 'draft') : ALL_VALUE}
              onValueChange={setPublishedFilter}
            >
              <SelectTrigger className="w-auto min-w-36" aria-label={t('question.filters.status', { defaultValue: 'Status' })}>
                <SelectValue placeholder={t('question.filters.status', { defaultValue: 'Status' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('question.filters.allStatuses', { defaultValue: 'All statuses' })}</SelectItem>
                <SelectItem value="published">{t('question.filters.published', { defaultValue: 'Published' })}</SelectItem>
                <SelectItem value="draft">{t('question.filters.draft', { defaultValue: 'Draft' })}</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <FilterX size={14} aria-hidden="true" />
                {t('question.filters.clear', { defaultValue: 'Clear filters' })}
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
            {t('question.dash.error', { defaultValue: "Couldn't load this channel's question bank." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : visibleQuestions.length === 0 ? (
        hasActiveFilters || searchQuery ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <SearchX className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('question.dash.filteredEmpty.title', { defaultValue: 'No matching questions' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('question.dash.filteredEmpty.description', {
                defaultValue: 'No questions match these filters. Try a different combination.',
              })}
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
              {t('question.filters.clear', { defaultValue: 'Clear filters' })}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ListChecks className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('question.dash.empty.title', { defaultValue: 'No questions yet' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('question.dash.empty.description', {
                defaultValue: 'Add questions to this channel’s bank to start building quizzes.',
              })}
            </p>
          </div>
        )
      ) : (
        <div className="space-y-3 mb-8">
          {visibleQuestions.map((question: Question) => (
            <div key={question.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {QUESTION_TYPE_LABELS[question.question_type] || question.question_type}
                  </Badge>
                  {question.subject && (
                    <Badge variant="outline" className="text-[11px] font-normal">{question.subject}</Badge>
                  )}
                  {question.level && (
                    <Badge variant="outline" className="text-[11px] font-normal">{question.level}</Badge>
                  )}
                  {!question.published && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {t('question.dash.draft', { defaultValue: 'Draft' })}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-2">{question.prompt}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('question.dash.updated', {
                    defaultValue: 'Updated {{date}}',
                    date: formatRelative(question.update_date, i18n.language),
                  })}
                </p>
              </div>

              <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="courses" orgId={orgId}>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                      checked={question.published}
                      onCheckedChange={(checked) => handleTogglePublished(question.id, checked)}
                    />
                    {t('question.dash.published', { defaultValue: 'Published' })}
                  </label>
                  <QuestionFormModal orgId={orgId} mode="edit" question={question} />
                </div>
              </AuthenticatedClientElement>

              <AuthenticatedClientElement checkMethod="roles" action="delete" ressourceType="courses" orgId={orgId}>
                <ConfirmationModal
                  confirmationButtonText={t('question.dash.delete', { defaultValue: 'Delete' })}
                  confirmationMessage={t('question.dash.deleteConfirm', {
                    defaultValue: 'This question will be removed from the bank. This can’t be undone.',
                  })}
                  dialogTitle={t('question.dash.deleteTitle', { defaultValue: 'Delete question?' })}
                  dialogTrigger={
                    <button
                      type="button"
                      aria-label={t('question.dash.delete', { defaultValue: 'Delete' })}
                      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  }
                  functionToExecute={() => handleDelete(question.id)}
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

export default QuestionsHome
