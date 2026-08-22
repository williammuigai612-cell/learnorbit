'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronLeft, ClipboardList, ShieldQuestion, TrendingUp, XCircle } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrgMembership } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { useResolvedUser } from '@/hooks/useResolvedUser'
import { useChildQuizProgress } from '@/hooks/queries/useParentLinks'
import { computeAttemptOutcome } from '@services/organizations/quizAttempts'
import { parseUtcTimestamp } from '@services/organizations/quizTimer'
import type { ChildQuizProgressSummary } from '@services/users/parentLinks'
import { Badge } from '@components/ui/badge'
import UserAvatar from '@components/Objects/UserAvatar'

function getAvatarUrl(user: any): string | undefined {
  if (!user?.avatar_image) return undefined
  if (user.avatar_image.startsWith('http://') || user.avatar_image.startsWith('https://')) {
    return user.avatar_image
  }
  return getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image)
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
        href={getUriWithOrg(orgslug, '/account/family')}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t('account.family.activity.backToFamily', { defaultValue: 'Back to Family' })}
      </Link>
    </div>
  )
}

// Inert — unlike progress.tsx's own ProgressRow, this doesn't link through to
// /quizzes/{id}/results (that page is self-scoped and would show the
// viewer's own attempts, not the child's). A row here is read-only, matching
// UI-11's "basic view, not a drill-down analytics suite" scoping.
function ChildProgressRow({ summary }: { summary: ChildQuizProgressSummary }) {
  const { t } = useTranslation()
  const hasGradedAttempt = summary.most_recent_score_percentage !== null
  const outcome = hasGradedAttempt
    ? computeAttemptOutcome(summary.most_recent_score_percentage as number, summary.pass_threshold_percentage)
    : null
  const when = new Date(parseUtcTimestamp(summary.most_recent_attempt_at)).toLocaleString()

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{summary.quiz_title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {t('account.family.activity.channel', { defaultValue: '{{org}} — {{count}} attempt(s), last on {{when}}', org: summary.org_name, count: summary.attempts_taken, when })}
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
            className={`gap-1 border-transparent ${outcome === 'passed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}
          >
            {outcome === 'passed' ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
            {outcome === 'passed'
              ? t('quiz.results.passed', { defaultValue: 'Passed' })
              : t('quiz.results.needsReview', { defaultValue: 'Needs review' })}
          </Badge>
        )}
      </div>
    </div>
  )
}

export default function AccountFamilyChildActivity({ childUserId }: { childUserId: number }) {
  const { t } = useTranslation()
  const { orgslug } = useOrgMembership()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'
  const access_token = session?.data?.tokens?.access_token

  const child = useResolvedUser(childUserId, access_token)
  const { data: progress, isLoading, isError } = useChildQuizProgress(childUserId)

  if (!isAuthenticated) {
    return (
      <UnavailableState
        orgslug={orgslug}
        title={t('account.family.activity.loginRequired.title', { defaultValue: 'Log in to see this' })}
        description={t('account.family.activity.loginRequired.description', {
          defaultValue: 'Sign in to view a linked child’s activity.',
        })}
      />
    )
  }

  if (isError) {
    return (
      <UnavailableState
        orgslug={orgslug}
        title={t('account.family.activity.unauthorized.title', { defaultValue: "Can't show this activity" })}
        description={t('account.family.activity.unauthorized.description', {
          defaultValue: 'This account isn’t linked to you as a parent, or the link has been removed.',
        })}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-3 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/2" />
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    )
  }

  const childName = child ? `${child.first_name} ${child.last_name}`.trim() || child.username : ''

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-1">
        <Link
          href={getUriWithOrg(orgslug, '/account/family')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t('account.family.activity.backToFamily', { defaultValue: 'Back to Family' })}
        </Link>
        <div className="flex items-center gap-3">
          <UserAvatar width={36} rounded="rounded-full" avatar_url={getAvatarUrl(child)} />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp size={20} aria-hidden="true" />
              {childName
                ? t('account.family.activity.titleFor', { defaultValue: "{{name}}'s activity", name: childName })
                : t('account.family.activity.title', { defaultValue: 'Activity' })}
            </h1>
          </div>
        </div>
      </div>

      {!progress || progress.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <ClipboardList className="mx-auto text-muted-foreground" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {t('account.family.activity.empty', { defaultValue: "No quiz activity yet." })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {progress.map((summary) => (
            <ChildProgressRow key={`${summary.org_id}-${summary.quiz_id}`} summary={summary} />
          ))}
        </div>
      )}
    </div>
  )
}
