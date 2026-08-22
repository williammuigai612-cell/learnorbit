'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, ClipboardList, RefreshCw, X } from 'lucide-react'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import QuizFormModal from '@components/Objects/Dash/QuizFormModal'
import QuestionPickerModal from '@components/Objects/Dash/QuestionPickerModal'
import { Button } from '@components/ui/button'
import { Badge } from '@components/ui/badge'
import { useOrg } from '@components/Contexts/OrgContext'
import { useQuiz } from '@/hooks/queries/useQuiz'
import { useQuizQuestions, useReorderQuizQuestions, useDetachQuestionFromQuiz } from '@/hooks/queries/useQuiz'

const QUIZ_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  exam_practice: 'Exam practice',
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  short_answer: 'Short answer',
  number_answer: 'Number answer',
}

interface QuizBuilderProps {
  orgslug: string
  quizId: number
}

function QuizBuilder({ quizId }: QuizBuilderProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const orgId = org?.id as number | undefined

  const { data: quiz, isLoading: quizLoading, isError: quizError, refetch: refetchQuiz } = useQuiz(orgId, quizId)
  const {
    data: attachedQuestions,
    isLoading: questionsLoading,
    isError: questionsError,
    refetch: refetchQuestions,
  } = useQuizQuestions(orgId, quizId)
  const reorder = useReorderQuizQuestions(orgId, quizId)
  const detach = useDetachQuestionFromQuiz(orgId, quizId)

  const ordered = [...(attachedQuestions || [])].sort((a, b) => a.order - b.order)

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= ordered.length) return
    const reordered = [...ordered]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    try {
      await reorder.mutateAsync(reordered.map((qq) => qq.question_id))
    } catch (err: any) {
      toast.error(err?.message || t('quiz.builder.reorderError', { defaultValue: 'Could not reorder questions.' }))
    }
  }

  const handleDetach = async (questionId: number) => {
    try {
      await detach.mutateAsync(questionId)
      toast.success(t('quiz.builder.detachSuccess', { defaultValue: 'Question removed from quiz.' }))
    } catch (err: any) {
      toast.error(err?.message || t('quiz.builder.detachError', { defaultValue: 'Could not remove this question.' }))
    }
  }

  if (!orgId) return null

  if (quizLoading) {
    return (
      <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10 pt-6">
        <div className="h-8 bg-gray-200 rounded w-64 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (quizError || !quiz) {
    return (
      <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10 pt-6">
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">
            {t('quiz.builder.error', { defaultValue: "Couldn't load this quiz." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchQuiz()}>
            <RefreshCw size={14} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      </div>
    )
  }

  const attachedIds = ordered.map((qq) => qq.question_id)

  return (
    <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10">
      <div className="mb-6 pt-6">
        <Breadcrumbs
          items={[
            { label: t('quiz.dash.title', { defaultValue: 'Quizzes' }), href: '/dash/quizzes', icon: <ClipboardList size={14} /> },
            { label: quiz.title, href: `/dash/quizzes/${quiz.id}` },
          ]}
        />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <Badge variant="outline" className="text-[11px] font-normal">
                {QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}
              </Badge>
              {!quiz.published && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {t('quiz.dash.draft', { defaultValue: 'Draft' })}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold">{quiz.title}</h1>
            {quiz.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{quiz.description}</p>}
          </div>
          <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="courses" orgId={orgId}>
            <QuizFormModal orgId={orgId} mode="edit" quiz={quiz} />
          </AuthenticatedClientElement>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t('quiz.builder.questionsTitle', { defaultValue: 'Questions ({{count}})', count: ordered.length })}
        </h2>
        <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="courses" orgId={orgId}>
          <QuestionPickerModal orgId={orgId} quizId={quiz.id} attachedQuestionIds={attachedIds} />
        </AuthenticatedClientElement>
      </div>

      {questionsLoading ? (
        <div className="space-y-3 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : questionsError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center mb-8">
          <p className="text-sm text-muted-foreground">
            {t('quiz.builder.questionsError', { defaultValue: "Couldn't load this quiz's questions." })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchQuestions()}>
            <RefreshCw size={14} aria-hidden="true" />
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-lg border border-dashed border-border text-center mb-8">
          <p className="text-sm font-medium text-foreground">
            {t('quiz.builder.empty.title', { defaultValue: 'No questions yet' })}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('quiz.builder.empty.description', {
              defaultValue: 'Add published questions from this channel’s bank to build this quiz.',
            })}
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {ordered.map((qq, index) => (
            <div key={qq.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <span className="text-sm text-muted-foreground w-6 text-center shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {QUESTION_TYPE_LABELS[qq.question.question_type] || qq.question.question_type}
                  </Badge>
                  {qq.question.subject && (
                    <Badge variant="outline" className="text-[11px] font-normal">{qq.question.subject}</Badge>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-2">{qq.question.prompt}</p>
              </div>
              <AuthenticatedClientElement checkMethod="roles" action="update" ressourceType="courses" orgId={orgId}>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                    aria-label={t('quiz.builder.moveUp', { defaultValue: 'Move up' })}
                    className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === ordered.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                    aria-label={t('quiz.builder.moveDown', { defaultValue: 'Move down' })}
                    className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={detach.isPending}
                    onClick={() => handleDetach(qq.question_id)}
                    aria-label={t('quiz.builder.remove', { defaultValue: 'Remove from quiz' })}
                    className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </AuthenticatedClientElement>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default QuizBuilder
