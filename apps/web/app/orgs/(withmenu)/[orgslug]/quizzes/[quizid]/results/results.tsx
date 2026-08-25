'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronLeft, ClipboardList, History, ShieldQuestion, XCircle } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { useQuiz } from '@/hooks/queries/useQuiz'
import { useQuizAttempts } from '@/hooks/queries/useQuizAttempt'
import { computeAttemptOutcome, type QuizAttemptSummary } from '@services/organizations/quizAttempts'
import { parseUtcTimestamp } from '@services/organizations/quizTimer'
import { Badge } from '@components/ui/badge'

interface QuizResultsClientProps {
  quizid: string
  orgslug: string
}

function UnavailableState({
  orgslug,
  title,
  description,
}: {
  orgslug: string
  title: string
  description: string
}) {
  const { t } = useTranslation()
  return (
    <div className="max-w-md mx-auto my-16 px-4 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <ShieldQuestion className="text-muted-foreground" size={24} aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
      <Link
        href={getUriWithOrg(orgslug, '/')}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t('resource.backToChannel', { defaultValue: 'Back to channel' })}
      </Link>
    </div>
  )
}

function AttemptRow({
  attempt,
  passThreshold,
  orgslug,
  quizId,
}: {
  attempt: QuizAttemptSummary
  passThreshold: number | null | undefined
  orgslug: string
  quizId: number
}) {
  const { t } = useTranslation()
  const outcome = attempt.status === 'graded' ? computeAttemptOutcome(attempt.score_percentage, passThreshold) : null
  const when = new Date(parseUtcTimestamp(attempt.started_at)).toLocaleString()

  return (
    <Link
      href={getUriWithOrg(orgslug, `/quizzes/${quizId}/attempt/${attempt.id}`)}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {t('quiz.results.attemptNumber', { defaultValue: 'Attempt {{number}}', number: attempt.attempt_number })}
        </p>
        <p className="text-xs text-muted-foreground">{when}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {attempt.status === 'in_progress' ? (
          <Badge variant="secondary">{t('quiz.results.inProgress', { defaultValue: 'In progress' })}</Badge>
        ) : (
          <>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {Math.round(attempt.score_percentage)}%
            </span>
            {outcome && (
              <Badge
                className={`gap-1 border-transparent ${
                  outcome === 'passed' ? 'bg-success/15 text-success-strong' : 'bg-warning/15 text-warning-strong'
                }`}
              >
                {outcome === 'passed' ? (
                  <CheckCircle2 size={12} aria-hidden="true" />
                ) : (
                  <XCircle size={12} aria-hidden="true" />
                )}
                {outcome === 'passed'
                  ? t('quiz.results.passed', { defaultValue: 'Passed' })
                  : t('quiz.results.needsReview', { defaultValue: 'Needs review' })}
              </Badge>
            )}
          </>
        )}
      </div>
    </Link>
  )
}

export default function QuizResultsClient({ quizid, orgslug }: QuizResultsClientProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const quizIdNum = Number(quizid)
  const validId = Number.isFinite(quizIdNum)

  const { data: quiz, error: quizError, isLoading: quizLoading } = useQuiz(org?.id, validId ? quizIdNum : undefined)
  const { data: attempts, isLoading: attemptsLoading } = useQuizAttempts(org?.id, validId ? quizIdNum : undefined)

  if (!validId || quizError) {
    return (
      <UnavailableState
        orgslug={orgslug}
        title={t('quiz.notFound.title', { defaultValue: 'Quiz not found' })}
        description={t('quiz.notFound.description', {
          defaultValue: "The quiz you're looking for doesn't exist or may have been removed.",
        })}
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <UnavailableState
        orgslug={orgslug}
        title={t('quiz.results.loginRequired.title', { defaultValue: 'Log in to see your results' })}
        description={t('quiz.results.loginRequired.description', {
          defaultValue: 'Your quiz attempt history is only visible to you once logged in.',
        })}
      />
    )
  }

  if (quizLoading || attemptsLoading || !org || !quiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-3 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/2" />
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <Link
          href={getUriWithOrg(orgslug, `/quizzes/${quiz.id}`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {quiz.title}
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <History size={20} aria-hidden="true" />
          {t('quiz.results.historyTitle', { defaultValue: 'Your attempts' })}
        </h1>
      </div>

      {!attempts || attempts.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <ClipboardList className="mx-auto text-muted-foreground" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {t('quiz.results.noAttempts', { defaultValue: "You haven't taken this quiz yet." })}
          </p>
          <Link
            href={getUriWithOrg(orgslug, `/quizzes/${quiz.id}`)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('quiz.view.start', { defaultValue: 'Start quiz' })}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {attempts.map((attempt) => (
            <AttemptRow
              key={attempt.id}
              attempt={attempt}
              passThreshold={quiz.pass_threshold_percentage}
              orgslug={orgslug}
              quizId={quiz.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
