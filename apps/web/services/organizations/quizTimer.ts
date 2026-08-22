/*
 Pure countdown logic for Exam Practice attempts (Phase 6F). The backend
 stores no attempt-level deadline — `time_limit_minutes` lives on the Quiz
 (6C) and `started_at` on the QuizAttempt (6D) — so the deadline is derived
 client-side as `started_at + time_limit_minutes` and re-evaluated each
 render. There is deliberately no server-side expiry check (6F is scoped as
 client-driven auto-submit only); see docs/PROGRESS.md's 6F entry.
*/

export type QuizTimerUrgency = 'normal' | 'warning' | 'destructive'

export interface QuizTimerState {
  remainingSeconds: number
  totalSeconds: number
  expired: boolean
  urgency: QuizTimerUrgency
}

/** `docs/DESIGN_SYSTEM.md` §19: shifts to `--warning` in the "final period"
 * and `--destructive` in the "last seconds" — scaled proportionally so a
 * short time limit still gets a meaningful warning window, capped so a long
 * exam doesn't warn absurdly early. */
export function getTimerUrgency(remainingSeconds: number, totalSeconds: number): QuizTimerUrgency {
  if (remainingSeconds <= 0) return 'destructive'
  const destructiveThreshold = Math.min(30, totalSeconds * 0.1)
  if (remainingSeconds <= destructiveThreshold) return 'destructive'
  const warningThreshold = Math.min(300, totalSeconds * 0.2)
  if (remainingSeconds <= warningThreshold) return 'warning'
  return 'normal'
}

// Matches the backend's naive-UTC timestamp convention (`str(datetime.now(
// timezone.utc).replace(tzinfo=None))`, e.g. "2026-08-21 14:17:53.531993") —
// no "Z"/offset. Already-zoned strings (Z / ±HH:MM) are excluded so they
// fall through to `new Date()`, which parses those unambiguously per spec.
const NAIVE_UTC_TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/

/** Parses a backend timestamp as UTC regardless of the runtime's local
 * timezone. `new Date(str)` on a bare "YYYY-MM-DD HH:MM:SS" string is
 * parsed as LOCAL time (implementation-defined, not spec-guaranteed) — in
 * any non-UTC timezone that silently inflates (or deflates) elapsed time
 * by the local offset. Reproduced live: a 10-minute exam attempt
 * auto-submitted 0.4 *real* seconds after starting, in a UTC+3 environment.
 * Manually reading the components out and rebuilding via `Date.UTC` sidesteps
 * the ambiguous string parse entirely rather than trying to out-guess it. */
export function parseUtcTimestamp(value: string): number {
  const trimmed = value.trim()
  const match = NAIVE_UTC_TIMESTAMP_RE.exec(trimmed)
  if (!match) {
    return new Date(trimmed).getTime()
  }
  const [, year, month, day, hour, minute, second, fraction] = match
  const milliseconds = fraction ? Math.round(Number(`0.${fraction}`) * 1000) : 0
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds
  )
}

export function getQuizTimerState(
  startedAt: string,
  timeLimitMinutes: number,
  now: number | Date = Date.now()
): QuizTimerState {
  const startMs = parseUtcTimestamp(startedAt)
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const totalSeconds = timeLimitMinutes * 60
  const elapsedSeconds = (nowMs - startMs) / 1000
  const remainingSeconds = Math.max(0, Math.floor(totalSeconds - elapsedSeconds))

  return {
    remainingSeconds,
    totalSeconds,
    expired: remainingSeconds <= 0,
    urgency: getTimerUrgency(remainingSeconds, totalSeconds),
  }
}

/** `mm:ss`, growing to `h:mm:ss` past an hour remaining — tabular numerals
 * applied by the caller via the `tabular-nums` utility (§4). */
export function formatTimerDisplay(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds))
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
