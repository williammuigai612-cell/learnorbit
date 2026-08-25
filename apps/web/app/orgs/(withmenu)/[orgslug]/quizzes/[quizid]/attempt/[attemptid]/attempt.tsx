'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  History,
  RotateCcw,
  ShieldQuestion,
  XCircle,
} from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { useQuiz } from '@/hooks/queries/useQuiz'
import { useQuizAttempt, useSubmitQuizAttempt } from '@/hooks/queries/useQuizAttempt'
import { computeAttemptOutcome } from '@services/organizations/quizAttempts'
import type { AttemptQuestion, QuizAnswerPayload, QuizAnswerResult } from '@services/organizations/quizAttempts'
import QuizTimer from '@components/Objects/Channel/QuizTimer'
import { Badge } from '@components/ui/badge'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'

interface QuizAttemptClientProps {
  quizid: string
  attemptid: string
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

// --- In-progress: one question per screen ---------------------------------

function QuestionRunner({
  questions,
  answers,
  setAnswer,
  index,
  setIndex,
  onSubmit,
  submitting,
  submitError,
}: {
  questions: AttemptQuestion[]
  answers: Record<number, QuizAnswerPayload>
  setAnswer: (_questionId: number, _answer: QuizAnswerPayload) => void
  index: number
  setIndex: (_index: number) => void
  onSubmit: () => void
  submitting: boolean
  submitError: string
}) {
  const { t } = useTranslation()
  const question = questions[index]
  const total = questions.length
  const isLast = index === total - 1
  const answeredCount = Object.keys(answers).length

  const answer = answers[question.id]
  const promptId = React.useId()

  // Phase 9C: advancing a question swapped the content underneath a focus
  // that stayed on Next/Previous, so the new prompt was never announced —
  // the progress line's aria-live only ever said "Question N of M". Moving
  // focus to the prompt makes the question itself the next thing read
  // (WCAG 2.4.3).
  const promptRef = useRef<HTMLHeadingElement>(null)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    promptRef.current?.focus()
  }, [index])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1.5" aria-live="polite">
        <p className="text-sm font-medium text-muted-foreground">
          {t('quiz.attempt.progress', { defaultValue: 'Question {{current}} of {{total}}', current: index + 1, total })}
        </p>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <h1
        ref={promptRef}
        id={promptId}
        tabIndex={-1}
        className="text-xl font-semibold text-foreground leading-snug focus:outline-hidden"
      >
        {question.prompt}
      </h1>

      {/* Phase 9C: these were `role="radio"` inside `role="radiogroup"`, which
          promises the WAI-ARIA radiogroup keyboard contract (one tab stop,
          arrow-key selection) that plain buttons don't implement — the widget
          misreported itself (WCAG 4.1.2). Toggle buttons in a labelled group
          describe what this actually is, and keep every option tabbable. */}
      {question.question_type === 'multiple_choice' && (
        <div className="space-y-2" role="group" aria-labelledby={promptId}>
          {(question.contents.options || []).map((option) => {
            const selected = (answer as any)?.selected_option_id === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswer(question.id, { selected_option_id: option.id })}
                className={`w-full flex items-center gap-3 rounded-md border px-4 py-3 text-start transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {selected ? (
                  <CheckCircle2 className="text-primary shrink-0" size={18} aria-hidden="true" />
                ) : (
                  <Circle className="text-muted-foreground shrink-0" size={18} aria-hidden="true" />
                )}
                <span className="text-sm text-foreground">{option.text}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Phase 9C: both answer fields were placeholder-only ("Your answer"),
          so a screen-reader user had no way to tell which question the field
          belonged to. Labelling them by the prompt heading ties the two
          together without adding a visible label (WCAG 3.3.2 / 4.1.2). */}
      {question.question_type === 'short_answer' && (
        <Input
          aria-labelledby={promptId}
          value={(answer as any)?.text || ''}
          onChange={(e) => setAnswer(question.id, { text: e.target.value })}
          placeholder={t('quiz.attempt.shortAnswerPlaceholder', { defaultValue: 'Your answer' })}
        />
      )}

      {question.question_type === 'number_answer' && (
        <Input
          type="number"
          aria-labelledby={promptId}
          value={(answer as any)?.value ?? ''}
          onChange={(e) => setAnswer(question.id, { value: e.target.valueAsNumber })}
          placeholder={t('quiz.attempt.numberAnswerPlaceholder', { defaultValue: 'Your answer' })}
        />
      )}

      {submitError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{submitError}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setIndex(index - 1)} disabled={index === 0}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t('quiz.attempt.previous', { defaultValue: 'Previous' })}
        </Button>
        {isLast ? (
          <div className="flex flex-col items-end gap-1.5">
            {answeredCount < total && (
              <p className="text-xs text-muted-foreground">
                {t('quiz.attempt.unanswered', {
                  defaultValue: '{{count}} question(s) left unanswered',
                  count: total - answeredCount,
                })}
              </p>
            )}
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting
                ? t('quiz.attempt.submitting', { defaultValue: 'Submitting…' })
                : t('quiz.attempt.submit', { defaultValue: 'Submit quiz' })}
            </Button>
          </div>
        ) : (
          <Button onClick={() => setIndex(index + 1)}>
            {t('quiz.attempt.next', { defaultValue: 'Next' })}
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

// --- Graded: results + per-question review ---------------------------------

function AnswerReview({ result }: { result: QuizAnswerResult }) {
  const { t } = useTranslation()
  const { question, answer, is_correct } = result

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground flex-1">{question.prompt}</p>
        <Badge
          className={`shrink-0 gap-1 border-transparent ${
            is_correct ? 'bg-success/15 text-success-strong' : 'bg-destructive/15 text-destructive'
          }`}
        >
          {is_correct ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
          {is_correct
            ? t('quiz.results.correct', { defaultValue: 'Correct' })
            : t('quiz.results.incorrect', { defaultValue: 'Incorrect' })}
        </Badge>
      </div>

      {question.question_type === 'multiple_choice' && (
        <div className="space-y-1.5">
          {(question.contents.options || []).map((option) => {
            const wasSelected = (answer as any)?.selected_option_id === option.id
            const isCorrectOption = option.is_correct
            let cls = 'border-border text-muted-foreground'
            if (isCorrectOption) cls = 'border-success bg-success/10 text-foreground'
            else if (wasSelected) cls = 'border-destructive bg-destructive/10 text-foreground'
            return (
              <div key={option.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
                {isCorrectOption ? (
                  <CheckCircle2 className="text-success shrink-0" size={14} aria-hidden="true" />
                ) : wasSelected ? (
                  <XCircle className="text-destructive shrink-0" size={14} aria-hidden="true" />
                ) : (
                  <Circle className="text-muted-foreground shrink-0" size={14} aria-hidden="true" />
                )}
                <span>{option.text}</span>
                {wasSelected && (
                  <span className="text-xs text-muted-foreground ms-auto">
                    {t('quiz.results.yourAnswer', { defaultValue: 'Your answer' })}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(question.question_type === 'short_answer' || question.question_type === 'number_answer') && (
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">
            {t('quiz.results.yourAnswerLabel', { defaultValue: 'Your answer:' })}{' '}
            <span className="text-foreground font-medium">
              {(answer as any)?.text ?? (answer as any)?.value ?? t('quiz.results.noAnswer', { defaultValue: '(no answer)' })}
            </span>
          </p>
          {!is_correct && question.contents.accepted_answers && question.contents.accepted_answers.length > 0 && (
            <p className="text-muted-foreground">
              {t('quiz.results.acceptedAnswers', { defaultValue: 'Accepted answers:' })}{' '}
              <span className="text-foreground">{question.contents.accepted_answers.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      {question.explanation && (
        <p className="text-sm text-muted-foreground border-t border-border pt-2">{question.explanation}</p>
      )}
    </div>
  )
}

function ResultsView({
  score,
  passThreshold,
  answers,
  orgslug,
  quizId,
}: {
  score: number
  passThreshold: number | null | undefined
  answers: QuizAnswerResult[]
  orgslug: string
  quizId: number
}) {
  const { t } = useTranslation()
  const rounded = Math.round(score)
  const outcome = computeAttemptOutcome(score, passThreshold)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t('quiz.results.title', { defaultValue: 'Quiz results' })}
        </p>
        <p className="text-5xl font-bold text-foreground">{rounded}%</p>
        {outcome && (
          <Badge
            className={`gap-1 border-transparent ${outcome === 'passed' ? 'bg-success/15 text-success-strong' : 'bg-warning/15 text-warning-strong'}`}
          >
            {outcome === 'passed'
              ? t('quiz.results.passed', { defaultValue: 'Passed' })
              : t('quiz.results.needsReview', { defaultValue: 'Needs review' })}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {answers.map((result) => (
          <AnswerReview key={result.question_id} result={result} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
        <Link
          href={getUriWithOrg(orgslug, '/')}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {t('resource.backToChannel', { defaultValue: 'Back to channel' })}
        </Link>
        <Link
          href={getUriWithOrg(orgslug, `/quizzes/${quizId}/results`)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <History size={16} aria-hidden="true" />
          {t('quiz.results.viewHistory', { defaultValue: 'View past attempts' })}
        </Link>
        <Link
          href={getUriWithOrg(orgslug, `/quizzes/${quizId}`)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t('quiz.results.retake', { defaultValue: 'Retake quiz' })}
        </Link>
      </div>
    </div>
  )
}

export default function QuizAttemptClient({ quizid, attemptid, orgslug }: QuizAttemptClientProps) {
  const { t } = useTranslation()
  const org = useOrg() as any

  const quizIdNum = Number(quizid)
  const attemptIdNum = Number(attemptid)
  const validIds = Number.isFinite(quizIdNum) && Number.isFinite(attemptIdNum)

  const { data: quiz } = useQuiz(org?.id, validIds ? quizIdNum : undefined)
  const { data: attempt, error, isLoading } = useQuizAttempt(
    org?.id,
    validIds ? quizIdNum : undefined,
    validIds ? attemptIdNum : undefined
  )
  const submitAttempt = useSubmitQuizAttempt(org?.id, validIds ? quizIdNum : undefined, validIds ? attemptIdNum : undefined)

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, QuizAnswerPayload>>({})
  const [submitError, setSubmitError] = useState('')
  // Guards the timer's onExpire against firing submit twice (e.g. an
  // in-flight manual submit racing the expiry tick) — the mutation itself
  // isn't idempotent client-side (6D 409s a second submit, but we'd rather
  // not fire it at all).
  const submittedOrSubmittingRef = useRef(false)

  const setAnswer = (questionId: number, answer: QuizAnswerPayload) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const handleSubmit = async () => {
    if (!attempt?.questions || submittedOrSubmittingRef.current) return
    submittedOrSubmittingRef.current = true
    setSubmitError('')
    try {
      await submitAttempt.mutateAsync(
        attempt.questions.map((q) => ({ question_id: q.id, answer: answers[q.id] || {} }))
      )
    } catch (err: any) {
      submittedOrSubmittingRef.current = false
      setSubmitError(
        err?.message || t('quiz.attempt.submitError', { defaultValue: 'Could not submit this attempt. Please try again.' })
      )
    }
  }

  const handleTimerExpire = () => {
    toast(t('quiz.attempt.timeUp', { defaultValue: "Time's up — submitting your quiz." }))
    handleSubmit()
  }

  if (!validIds) {
    return (
      <UnavailableState
        orgslug={orgslug}
        title={t('quiz.attempt.notFound.title', { defaultValue: 'Attempt not found' })}
        description={t('quiz.attempt.notFound.description', { defaultValue: 'This quiz attempt could not be found.' })}
      />
    )
  }

  if (error) {
    const status = (error as any)?.status
    return (
      <UnavailableState
        orgslug={orgslug}
        title={
          status === 403
            ? t('quiz.attempt.forbidden.title', { defaultValue: "This isn't your attempt" })
            : t('quiz.attempt.notFound.title', { defaultValue: 'Attempt not found' })
        }
        description={
          status === 403
            ? t('quiz.attempt.forbidden.description', { defaultValue: 'You can only view your own quiz attempts.' })
            : t('quiz.attempt.notFound.description', { defaultValue: 'This quiz attempt could not be found.' })
        }
      />
    )
  }

  if (isLoading || !org || !attempt) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4 animate-pulse">
        <div className="h-1.5 bg-muted rounded" />
        <div className="h-6 bg-muted rounded w-3/4" />
        <div className="h-24 bg-muted rounded" />
      </div>
    )
  }

  if (attempt.status === 'in_progress' && attempt.questions) {
    const isTimedExam = quiz?.quiz_type === 'exam_practice' && !!quiz?.time_limit_minutes
    return (
      <>
        {isTimedExam && (
          <QuizTimer
            startedAt={attempt.started_at}
            timeLimitMinutes={quiz!.time_limit_minutes as number}
            onExpire={handleTimerExpire}
          />
        )}
        <QuestionRunner
          questions={attempt.questions}
          answers={answers}
          setAnswer={setAnswer}
          index={Math.min(index, attempt.questions.length - 1)}
          setIndex={setIndex}
          onSubmit={handleSubmit}
          submitting={submitAttempt.isPending}
          submitError={submitError}
        />
      </>
    )
  }

  return (
    <ResultsView
      score={attempt.score_percentage}
      passThreshold={quiz?.pass_threshold_percentage}
      answers={attempt.answers || []}
      orgslug={orgslug}
      quizId={quizIdNum}
    />
  )
}
