'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { getQuizTimerState, formatTimerDisplay, type QuizTimerUrgency } from '@services/organizations/quizTimer'

const URGENCY_CLASSES: Record<QuizTimerUrgency, string> = {
  normal: 'border-border bg-card text-foreground',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
}

interface QuizTimerProps {
  startedAt: string
  timeLimitMinutes: number
  /** Called exactly once, the first tick remaining time hits zero. */
  onExpire: () => void
}

/** `docs/DESIGN_SYSTEM.md` §19 exam timer: fixed-position, tabular-numeral
 * countdown that shifts `--warning` → `--destructive` as time runs out.
 * Recomputes from `startedAt`/`timeLimitMinutes` every second rather than
 * counting down a local number, so it stays correct across tab
 * backgrounding/throttled timers. */
export default function QuizTimer({ startedAt, timeLimitMinutes, onExpire }: QuizTimerProps) {
  const { t } = useTranslation()
  const [state, setState] = useState(() => getQuizTimerState(startedAt, timeLimitMinutes))
  const expiredFiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    expiredFiredRef.current = false

    const tick = () => {
      const next = getQuizTimerState(startedAt, timeLimitMinutes)
      setState(next)
      if (next.expired && !expiredFiredRef.current) {
        expiredFiredRef.current = true
        onExpireRef.current()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt, timeLimitMinutes])

  return (
    <div
      role="timer"
      aria-live={state.urgency === 'destructive' ? 'assertive' : 'off'}
      aria-label={t('quiz.attempt.timeRemaining', { defaultValue: 'Time remaining' })}
      className={`fixed top-20 end-4 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${URGENCY_CLASSES[state.urgency]}`}
      style={{ zIndex: 'var(--z-sticky-header)' }}
    >
      <Clock size={14} aria-hidden="true" />
      <span className="tabular-nums">{formatTimerDisplay(state.remainingSeconds)}</span>
    </div>
  )
}
