'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ClipboardList, Clock, History, ListChecks, Lock, ShieldQuestion, Timer } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { useQuiz } from '@/hooks/queries/useQuiz'
import { useStartQuizAttempt } from '@/hooks/queries/useQuizAttempt'
import { Badge } from '@components/ui/badge'
import { Button } from '@components/ui/button'

interface QuizViewClientProps {
  quizid: string
  orgslug: string
}

const QUIZ_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  exam_practice: 'Exam practice',
}

function MetadataSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4 animate-pulse">
      <div className="h-7 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="h-24 bg-muted rounded" />
    </div>
  )
}

// Mirrors the resource viewer's UnavailableState — not-found vs.
// not-visible-to-this-viewer are reported identically by the API's own
// 404/403 split (services/orgs/quizzes.py `get_quiz`).
function UnavailableState({ orgslug, variant }: { orgslug: string; variant: 'not_found' | 'inaccessible' }) {
  const { t } = useTranslation()
  const title =
    variant === 'not_found'
      ? t('quiz.notFound.title', { defaultValue: 'Quiz not found' })
      : t('quiz.inaccessible.title', { defaultValue: "This quiz isn't available" })
  const description =
    variant === 'not_found'
      ? t('quiz.notFound.description', {
          defaultValue: "The quiz you're looking for doesn't exist or may have been removed.",
        })
      : t('quiz.inaccessible.description', {
          defaultValue: "This quiz isn't published, or you don't have access to take it.",
        })

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

export default function QuizViewClient({ quizid, orgslug }: QuizViewClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const quizIdNum = Number(quizid)
  const { data: quiz, error, isLoading } = useQuiz(org?.id, Number.isFinite(quizIdNum) ? quizIdNum : undefined)
  const startAttempt = useStartQuizAttempt(org?.id, quizIdNum)
  const [startError, setStartError] = useState('')

  if (error) {
    const status = (error as any)?.status
    return <UnavailableState orgslug={orgslug} variant={status === 404 ? 'not_found' : 'inaccessible'} />
  }

  if (isLoading || !org || !quiz) {
    return <MetadataSkeleton />
  }

  const isDraftPreview = !quiz.published || quiz.visibility !== 'public'
  const isExamPractice = quiz.quiz_type === 'exam_practice'

  const handleStart = async () => {
    setStartError('')
    try {
      const attempt = await startAttempt.mutateAsync()
      router.push(getUriWithOrg(orgslug, `/quizzes/${quiz.id}/attempt/${attempt.id}`))
    } catch (err: any) {
      setStartError(
        err?.message || t('quiz.view.startError', { defaultValue: 'Could not start this quiz. Please try again.' })
      )
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
      <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-muted">
        {isExamPractice ? (
          <Timer className="text-primary" size={24} aria-hidden="true" />
        ) : (
          <ClipboardList className="text-primary" size={24} aria-hidden="true" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[11px] font-normal">
            {QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}
          </Badge>
          {quiz.subject && <Badge variant="outline" className="text-[11px] font-normal">{quiz.subject}</Badge>}
          {quiz.level && <Badge variant="outline" className="text-[11px] font-normal">{quiz.level}</Badge>}
          {isDraftPreview && (
            <Badge variant="secondary" className="gap-1">
              <Lock size={12} aria-hidden="true" />
              {t('quiz.view.draftPreview', { defaultValue: 'Not published — only visible to you' })}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{quiz.title}</h1>
        {quiz.description && (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{quiz.description}</p>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ListChecks size={14} aria-hidden="true" />
          {t('quiz.view.questionCount', {
            defaultValue: '{{count}} questions',
            count: quiz.question_count,
          })}
        </span>
        {quiz.time_limit_minutes && (
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} aria-hidden="true" />
            {t('quiz.view.timeLimit', { defaultValue: '{{minutes}} minutes', minutes: quiz.time_limit_minutes })}
          </span>
        )}
      </div>

      {startError && (
        <p role="alert" className="text-sm text-destructive">
          {startError}
        </p>
      )}

      {quiz.question_count === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('quiz.view.noQuestions', { defaultValue: 'This quiz has no questions yet.' })}
        </p>
      ) : isAuthenticated ? (
        <Button onClick={handleStart} disabled={startAttempt.isPending} size="lg">
          {startAttempt.isPending
            ? t('quiz.view.starting', { defaultValue: 'Starting…' })
            : t('quiz.view.start', { defaultValue: 'Start quiz' })}
        </Button>
      ) : (
        <Button asChild size="lg">
          <Link href={getUriWithOrg(orgslug, `/login?redirect=/quizzes/${quiz.id}`)}>
            {t('quiz.view.loginToStart', { defaultValue: 'Log in to take this quiz' })}
          </Link>
        </Button>
      )}

      {isAuthenticated && (
        <Link
          href={getUriWithOrg(orgslug, `/quizzes/${quiz.id}/results`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <History size={14} aria-hidden="true" />
          {t('quiz.view.viewPastAttempts', { defaultValue: 'View past attempts' })}
        </Link>
      )}
    </div>
  )
}
