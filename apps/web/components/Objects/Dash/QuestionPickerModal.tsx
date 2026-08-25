'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Plus, Search, SearchX } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { Button } from '@components/ui/button'
import { Badge } from '@components/ui/badge'
import { useQuestions } from '@/hooks/queries/useQuestion'
import { useAttachQuestionToQuiz } from '@/hooks/queries/useQuiz'
import type { Question } from '@services/organizations/questions'

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  short_answer: 'Short answer',
  number_answer: 'Number answer',
}

interface QuestionPickerModalProps {
  orgId: number
  quizId: number
  /** ids of questions already attached to this quiz — excluded from the
   * pickable list so the same question can't be attached twice (the
   * backend also 409s on this, this just avoids offering a control that
   * would fail). */
  attachedQuestionIds: number[]
}

export default function QuestionPickerModal({ orgId, quizId, attachedQuestionIds }: QuestionPickerModalProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [attachingId, setAttachingId] = useState<number | null>(null)

  // Only published bank items are quiz-eligible (Phase 6C's attach
  // validation, 409 otherwise) — filtered server-side.
  const { data: publishedQuestions, isLoading, isError } = useQuestions(
    orgId,
    open ? { published: true } : undefined
  )
  const attach = useAttachQuestionToQuiz(orgId, quizId)

  const attachedSet = useMemo(() => new Set(attachedQuestionIds), [attachedQuestionIds])
  const pickable = useMemo(() => {
    const notAttached = (publishedQuestions || []).filter((q) => !attachedSet.has(q.id))
    if (!searchQuery.trim()) return notAttached
    const q = searchQuery.trim().toLowerCase()
    return notAttached.filter((question) => question.prompt.toLowerCase().includes(q))
  }, [publishedQuestions, attachedSet, searchQuery])

  const handleAttach = async (question: Question) => {
    setAttachingId(question.id)
    try {
      await attach.mutateAsync(question.id)
      toast.success(t('quiz.picker.attachSuccess', { defaultValue: 'Question added.' }))
    } catch (err: any) {
      toast.error(err?.message || t('quiz.picker.attachError', { defaultValue: 'Could not add this question.' }))
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <Modal
      isDialogOpen={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearchQuery('')
      }}
      dialogTitle={t('quiz.picker.title', { defaultValue: 'Add a question' })}
      dialogDescription={t('quiz.picker.subtitle', {
        defaultValue: 'Only published bank questions can be added to a quiz.',
      })}
      minWidth="md"
      dialogTrigger={
        <Button type="button" size="sm" className="gap-1.5">
          <Plus size={16} aria-hidden="true" />
          {t('quiz.picker.trigger', { defaultValue: 'Add question' })}
        </Button>
      }
      dialogContent={
        <div className="space-y-4">
          <div className="relative">
            {/* Phase 9C: placeholder-only search field (§22 forbids
                placeholder-as-label); icon below the 3:1 non-text floor. */}
            <Search
              aria-hidden="true"
              className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
            />
            <input
              type="search"
              aria-label={t('quiz.picker.search', { defaultValue: 'Search prompts' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('quiz.picker.search', { defaultValue: 'Search prompts' })}
              className="w-full ps-10 pe-3 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('quiz.picker.error', { defaultValue: "Couldn't load the question bank." })}
            </p>
          ) : pickable.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <SearchX className="text-muted-foreground" size={20} aria-hidden="true" />
              <p className="text-sm text-muted-foreground max-w-xs">
                {searchQuery
                  ? t('quiz.picker.emptySearch', { defaultValue: 'No matching published questions.' })
                  : t('quiz.picker.empty', {
                      defaultValue: 'No more published bank questions to add. Publish a question first.',
                    })}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pickable.map((question) => (
                <div
                  key={question.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {QUESTION_TYPE_LABELS[question.question_type] || question.question_type}
                      </Badge>
                      {question.subject && (
                        <Badge variant="outline" className="text-[11px] font-normal">{question.subject}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{question.prompt}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={attachingId === question.id}
                    onClick={() => handleAttach(question)}
                    className="shrink-0"
                  >
                    {attachingId === question.id
                      ? t('quiz.picker.adding', { defaultValue: 'Adding…' })
                      : t('quiz.picker.add', { defaultValue: 'Add' })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  )
}
