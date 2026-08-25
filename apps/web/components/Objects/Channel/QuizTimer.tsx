'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { getQuizTimerState, formatTimerDisplay, type QuizTimerUrgency } from '@services/organizations/quizTimer'
import { HEADER_HEIGHT } from '@components/Objects/Menus/OrgSidebar'
import { useJoinBannerVisible, JOIN_BANNER_HEIGHT } from '@components/Objects/Banners/OrgJoinBanner'

const URGENCY_CLASSES: Record<QuizTimerUrgency, string> = {
  normal: 'border-border bg-card text-foreground',
  warning: 'border-warning/40 bg-warning/10 text-warning-strong',
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
// Phase 9C: milestones (in seconds remaining) at which the countdown is
// announced. The region itself stays `aria-live="off"` — it re-renders every
// second, so making it a live region floods a screen reader with one
// interruption per second exactly when the student most needs to hear the
// question. Announcing at thresholds conveys the same urgency without it.
const ANNOUNCE_AT_SECONDS = [300, 60, 30, 10]

export default function QuizTimer({ startedAt, timeLimitMinutes, onExpire }: QuizTimerProps) {
  const { t } = useTranslation()
  const [state, setState] = useState(() => getQuizTimerState(startedAt, timeLimitMinutes))
  const [announcement, setAnnouncement] = useState('')
  const announcedRef = useRef<Set<number>>(new Set())
  // Phase 9D (M5): `top-20` (80px) was a guess at the chrome's height. The
  // fixed header is 60px, and with the join banner up it starts 48px lower —
  // so on exactly the pages a joining student sees, the timer sat *behind*
  // the header and was invisible. Derive it from the same two values the
  // sidebar and OrgMenuChrome position against instead.
  const { isVisible: isJoinBannerVisible } = useJoinBannerVisible()
  const timerTop = (isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0) + HEADER_HEIGHT + 8
  const expiredFiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    expiredFiredRef.current = false
    announcedRef.current = new Set()

    const tick = () => {
      const next = getQuizTimerState(startedAt, timeLimitMinutes)
      setState(next)

      const milestone = ANNOUNCE_AT_SECONDS.find(
        (s) => next.remainingSeconds <= s && !announcedRef.current.has(s)
      )
      if (milestone !== undefined && !next.expired) {
        // Mark every threshold at or above this one, so a backgrounded tab
        // that resumes past several of them announces once, not four times.
        ANNOUNCE_AT_SECONDS.filter((s) => s >= milestone).forEach((s) => announcedRef.current.add(s))
        setAnnouncement(
          t('quiz.attempt.timeRemainingAnnouncement', {
            defaultValue: '{{time}} remaining',
            time: formatTimerDisplay(next.remainingSeconds),
          })
        )
      }

      if (next.expired && !expiredFiredRef.current) {
        expiredFiredRef.current = true
        onExpireRef.current()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // `t` is stable across renders in react-i18next; re-running this on it
    // would restart the interval and reset the announced-milestone set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, timeLimitMinutes])

  return (
    <>
      {/* Phase 9D (M5): below sm the answer column is full-width, so a fixed
          pill floated over the right edge of the options. In-flow and sticky
          it takes its own row and can cover nothing; from sm up, where the
          column is narrower than the viewport, it goes back to floating. */}
      <div
        className="sticky flex w-full justify-end px-4 pt-2 sm:fixed sm:end-4 sm:w-auto sm:px-0 sm:pt-0"
        style={{ top: timerTop, zIndex: 'var(--z-sticky-header)' }}
      >
        <div
          role="timer"
          aria-live="off"
          aria-label={t('quiz.attempt.timeRemaining', { defaultValue: 'Time remaining' })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${URGENCY_CLASSES[state.urgency]}`}
        >
          <Clock size={14} aria-hidden="true" />
          <span className="tabular-nums">{formatTimerDisplay(state.remainingSeconds)}</span>
        </div>
      </div>
      {/* Milestone announcements only — see ANNOUNCE_AT_SECONDS above. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  )
}
