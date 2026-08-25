'use client'

import React from 'react'
import { School, GraduationCap, BadgeCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOrgUsers } from '@/hooks/queries/useOrgAdmin'
import { useFollowOrg, useOrgFollowStatus, useUnfollowOrg } from '@/hooks/queries/useOrg'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getOrgLogoMediaDirectory } from '@services/media/media'

interface ChannelHeaderProps {
  org: any
}

// Shown at the top of the public /orgs/[slug] page — the LearnOrbit "channel
// profile" view. Reuses Organization fields set on creation (Phase 1B) plus
// the existing authenticated org-members endpoint for owner attribution;
// there is no public members endpoint, so owner info only renders for
// signed-in members (the query 403s otherwise and is silently skipped).
export default function ChannelHeader({ org }: ChannelHeaderProps) {
  const { t } = useTranslation()
  const { data: usersPage } = useOrgUsers(org?.id)
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const { data: followStatus } = useOrgFollowStatus(org?.id)
  const followOrg = useFollowOrg(org?.id)
  const unfollowOrg = useUnfollowOrg(org?.id)
  const isFollowing = followStatus?.is_following ?? false
  const followerCount = followStatus?.follower_count ?? 0
  const followPending = followOrg.isPending || unfollowOrg.isPending

  const handleFollowToggle = () => {
    if (followPending) return
    if (isFollowing) {
      unfollowOrg.mutate()
    } else {
      followOrg.mutate()
    }
  }

  const owner = (usersPage?.items || []).find((u: any) => u.role?.id === 1)
  const ownerName = owner
    ? [owner.user?.first_name, owner.user?.last_name].filter(Boolean).join(' ')
    : null

  const isInstructor = org?.channel_type === 'INSTRUCTOR'
  const TypeIcon = isInstructor ? GraduationCap : School
  const typeLabel = isInstructor
    ? t('channel.type.instructor', { defaultValue: 'Teacher / Educational Creator' })
    : t('channel.type.school', { defaultValue: 'School / Institution' })

  const logoUrl = org?.logo_image ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image) : null
  const about = org?.about || org?.description

  if (!org) return null

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-6">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={org.name}
          className="w-16 h-16 rounded-2xl object-cover nice-shadow flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <TypeIcon size={26} className="text-gray-400" />
        </div>
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-black text-2xl tracking-tight text-gray-900 truncate">{org.name}</h1>
          {org?.is_verified && (
            <BadgeCheck
              size={20}
              className="text-blue-500 shrink-0"
              aria-label={t('channel.verified', { defaultValue: 'Verified' })}
            >
              <title>{t('channel.verified', { defaultValue: 'Verified' })}</title>
            </BadgeCheck>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
            <TypeIcon size={12} />
            {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-500">
            {t('channel.followerCount', {
              count: followerCount,
              defaultValue: '{{count}} followers',
            })}
          </span>
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleFollowToggle}
              disabled={followPending}
              className={
                isFollowing
                  ? 'px-3 py-1 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors'
                  : 'px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors'
              }
            >
              {isFollowing
                ? t('channel.following', { defaultValue: 'Following' })
                : t('channel.follow', { defaultValue: 'Follow' })}
            </button>
          )}
        </div>
        {about && <p className="text-sm text-gray-500 max-w-2xl">{about}</p>}
        {ownerName && (
          <p className="text-xs text-muted-foreground">
            {t('channel.createdBy', { defaultValue: 'Created by' })} {ownerName}
          </p>
        )}
      </div>
    </div>
  )
}
