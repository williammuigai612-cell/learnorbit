'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronLeft, ClipboardList, ShieldQuestion, TrendingUp, XCircle } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { useQuizProgress } from '@/hooks/queries/useQuizProgress'
import { computeAttemptOutcome } from '@services/organizations/quizAttempts'
import type { QuizProgressSummary } from '@services/organizations/quizProgress'
import { parseUtcTimestamp } from '@services/organizations/quizTimer'
import { Badge } from '@components/ui/badge'

interface ProgressClientProps {
  orgslug: string
}

function UnavailableState({ orgslug, title, description }: { orgslug: string; title: string; description: string }) {
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

function ProgressRow({ summary, orgslug }: { summary: QuizProgressSummary; orgslug: string }) {
  const { t } = useTranslation()
  const hasGradedAttempt = summary.most_recent_score_percentage !== null
  const outcome = hasGradedAttempt
    ? computeAttemptOutcome(summary.most_recent_score_percentage as number, summary.pass_threshold_percentage)
    : null
  const when = new Date(parseUtcTimestamp(summary.most_recent_attempt_at)).toLocaleString()

  return (
    <Link
      href={getUriWithOrg(orgslug, `/quizzes/${summary.quiz_id}/results`)}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{summary.quiz_title}</p>
        <p className="text-xs text-muted-foreground">
          {t('progress.attemptsTaken', { defaultValue: '{{count}} attempt(s) — last on {{when}}', count: summary.attempts_taken, when })}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {hasGradedAttempt ? (
          <div className="text-end">
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {t('progress.bestScore', { defaultValue: 'Best {{score}}%', score: Math.round(summary.best_score_percentage as number) })}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('progress.recentScore', { defaultValue: 'Recent {{score}}%', score: Math.round(summary.most_recent_score_percentage as number) })}
            </p>
          </div>
        ) : (
          <Badge variant="secondary">{t('quiz.results.inProgress', { defaultValue: 'In progress' })}</Badge>
        )}
        {outcome && (
          <Badge
            className={`gap-1 border-transparent ${outcome === 'passed' ? 'bg-success/15 text-success-strong' : 'bg-warning/15 text-warning-strong'}`}
          >
            {outcome === 'passed' ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
            {outcome === 'passed'
              ? t('quiz.results.passed', { defaultValue: 'Passed' })
              : t('quiz.results.needsReview', { defaultValue: 'Needs review' })}
          </Badge>
        )}
      </div>
    </Link>
  )
}

export default function ProgressClient({ orgslug }: ProgressClientProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const { data: progress, isLoading } = useQuizProgress(org?.id)

  if (!isAuthenticated) {
    return (
      <UnavailableState
        orgslug={orgslug}
        title={t('progress.loginRequired.title', { defaultValue: 'Log in to see your progress' })}
        description={t('progress.loginRequired.description', {
          defaultValue: 'Your quiz progress is only visible to you once logged in.',
        })}
      />
    )
  }

  if (isLoading || !org) {
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
          href={getUriWithOrg(orgslug, '/')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t('resource.backToChannel', { defaultValue: 'Back to channel' })}
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <TrendingUp size={20} aria-hidden="true" />
          {t('progress.title', { defaultValue: 'My progress' })}
        </h1>
      </div>

      {!progress || progress.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <ClipboardList className="mx-auto text-muted-foreground" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {t('progress.empty', { defaultValue: "You haven't attempted any quizzes in this channel yet." })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {progress.map((summary) => (
            <ProgressRow key={summary.quiz_id} summary={summary} orgslug={orgslug} />
          ))}
        </div>
      )}
    </div>
  )
}
