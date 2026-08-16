'use client'

import React, { Suspense, lazy } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, GraduationCap, Lock, School, VideoOff } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useFollowOrg, useOrgFollowStatus, useUnfollowOrg } from '@/hooks/queries/useOrg'
import {
  useChannelVideo,
  useChannelVideoActivity,
  useChannelVideoCourse,
} from '@/hooks/queries/useChannelVideo'
import { Badge } from '@components/ui/badge'
import { Button } from '@components/ui/button'

const VideoActivity = lazy(() => import('@components/Objects/Activities/Video/Video'))

interface VideoWatchClientProps {
  channelvideoid: string
  orgslug: string
}

function PlayerSkeleton() {
  return (
    <div className="relative w-full aspect-video overflow-hidden bg-zinc-900 sm:rounded-lg animate-pulse">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/10" />
      </div>
    </div>
  )
}

function MetadataSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 animate-pulse">
      <div className="h-6 sm:h-7 bg-muted rounded w-3/4" />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
        <div className="h-4 bg-muted rounded w-40" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  )
}

// Shown when the channel video doesn't exist, or exists but isn't visible to
// this viewer (unpublished/unlisted and not this channel's owner/admin — the
// API reports both as a 403 to avoid leaking which case it is). Also covers
// the underlying video Activity/Course being RBAC-inaccessible to this
// viewer even though the channel post itself is public.
function UnavailableState({
  orgslug,
  variant,
}: {
  orgslug: string
  variant: 'not_found' | 'inaccessible'
}) {
  const { t } = useTranslation()
  const Icon = variant === 'not_found' ? VideoOff : Lock
  const title =
    variant === 'not_found'
      ? t('video.notFound.title', { defaultValue: 'Video not found' })
      : t('video.inaccessible.title', { defaultValue: "This video isn't available" })
  const description =
    variant === 'not_found'
      ? t('video.notFound.description', {
          defaultValue: "The video you're looking for doesn't exist or may have been removed.",
        })
      : t('video.inaccessible.description', {
          defaultValue:
            "This video isn't published, or you don't have access to view it.",
        })

  return (
    <div className="max-w-md mx-auto my-16 px-4 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="text-muted-foreground" size={24} aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
      <Link
        href={getUriWithOrg(orgslug, '/')}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t('video.backToChannel', { defaultValue: 'Back to channel' })}
      </Link>
    </div>
  )
}

function ChannelTypeBadge({ channelType }: { channelType?: string }) {
  const { t } = useTranslation()
  const isInstructor = channelType === 'INSTRUCTOR'
  const Icon = isInstructor ? GraduationCap : School
  const label = isInstructor
    ? t('channel.type.instructor', { defaultValue: 'Teacher / Educational Creator' })
    : t('channel.type.school', { defaultValue: 'School / Institution' })

  return (
    <Badge
      variant={isInstructor ? 'secondary' : 'outline'}
      className={isInstructor ? 'gap-1' : 'gap-1 border-transparent bg-info text-white'}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </Badge>
  )
}

function ChannelRow({ org, orgslug }: { org: any; orgslug: string }) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const { data: followStatus } = useOrgFollowStatus(org?.id)
  const followOrg = useFollowOrg(org?.id)
  const unfollowOrg = useUnfollowOrg(org?.id)
  const isFollowing = followStatus?.is_following ?? false
  const followerCount = followStatus?.follower_count ?? 0
  const followPending = followOrg.isPending || unfollowOrg.isPending

  const logoUrl = org?.logo_image ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image) : null

  const handleFollowToggle = () => {
    if (followPending) return
    if (isFollowing) unfollowOrg.mutate()
    else followOrg.mutate()
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Link
        href={getUriWithOrg(orgslug, '/')}
        className="flex items-center gap-3 min-w-0 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            {org?.channel_type === 'INSTRUCTOR' ? (
              <GraduationCap size={16} className="text-muted-foreground" aria-hidden="true" />
            ) : (
              <School size={16} className="text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{org?.name}</span>
          <span className="text-xs text-muted-foreground">
            {t('channel.followerCount', { count: followerCount, defaultValue: '{{count}} followers' })}
          </span>
        </div>
      </Link>
      <ChannelTypeBadge channelType={org?.channel_type} />
      {isAuthenticated && (
        <Button
          type="button"
          size="sm"
          variant={isFollowing ? 'outline' : 'default'}
          disabled={followPending}
          onClick={handleFollowToggle}
          className="ms-auto"
        >
          {isFollowing
            ? t('channel.following', { defaultValue: 'Following' })
            : t('channel.follow', { defaultValue: 'Follow' })}
        </Button>
      )}
    </div>
  )
}

function MetadataChips({ channelVideo }: { channelVideo: any }) {
  const { t } = useTranslation()
  const chips: { label: string; value: string }[] = []
  if (channelVideo.subject) chips.push({ label: t('video.subject', { defaultValue: 'Subject' }), value: channelVideo.subject })
  if (channelVideo.topic) chips.push({ label: t('video.topic', { defaultValue: 'Topic' }), value: channelVideo.topic })
  if (channelVideo.level) chips.push({ label: t('video.level', { defaultValue: 'Level' }), value: channelVideo.level })
  if (channelVideo.institution_context)
    chips.push({ label: t('video.institution', { defaultValue: 'Institution' }), value: channelVideo.institution_context })
  if (channelVideo.resource_type)
    chips.push({ label: t('video.resourceType', { defaultValue: 'Resource type' }), value: channelVideo.resource_type })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={t('video.academicMetadata', { defaultValue: 'Academic metadata' })}>
      {chips.map((chip) => (
        <Badge key={chip.label} variant="outline" role="listitem">
          <span className="text-muted-foreground me-1">{chip.label}:</span>
          {chip.value}
        </Badge>
      ))}
    </div>
  )
}

function VideoWatchContent({ orgslug, channelvideoid }: VideoWatchClientProps) {
  const { t } = useTranslation()
  const org = useOrg() as any

  const channelVideoIdNum = Number(channelvideoid)
  const {
    data: channelVideo,
    error: channelVideoError,
    isLoading: channelVideoLoading,
  } = useChannelVideo(org?.id, Number.isFinite(channelVideoIdNum) ? channelVideoIdNum : undefined)

  const {
    data: activity,
    error: activityError,
    isLoading: activityLoading,
  } = useChannelVideoActivity(channelVideo?.activity_id)

  const {
    data: course,
    error: courseError,
    isLoading: courseLoading,
  } = useChannelVideoCourse(activity?.course_id)

  // Not found vs. not-visible-to-this-viewer are reported identically by the
  // API's own 404/403 split (see services/orgs/channel_videos.py). A 401/403
  // surfacing from the underlying Activity/Course RBAC check (e.g. an admin
  // posted a video whose course later became restricted) is folded into the
  // same "inaccessible" messaging — it's still not watchable by this viewer.
  if (channelVideoError) {
    const status = (channelVideoError as any)?.status
    return (
      <UnavailableState orgslug={orgslug} variant={status === 404 ? 'not_found' : 'inaccessible'} />
    )
  }
  if (activityError || courseError) {
    return <UnavailableState orgslug={orgslug} variant="inaccessible" />
  }
  // The channel post can be published while its underlying course Activity is
  // still a draft (course-level RBAC only checks course access, not the
  // individual activity's `published` flag) — treat that the same as
  // inaccessible rather than rendering unfinished course content publicly.
  if (activity && !activity.published) {
    return <UnavailableState orgslug={orgslug} variant="inaccessible" />
  }

  const isLoading =
    !org || channelVideoLoading || (!!channelVideo && (activityLoading || (!!activity && courseLoading)))

  if (isLoading || !channelVideo || !activity || !course) {
    return (
      <div className="w-full">
        <div className="w-full sm:px-6 lg:px-8 sm:pt-6">
          <PlayerSkeleton />
        </div>
        <MetadataSkeleton />
      </div>
    )
  }

  const isDraftPreview = !channelVideo.published || channelVideo.visibility !== 'public'

  return (
    <div className="w-full">
      {/* Player: full-bleed edge-to-edge on mobile, inset + rounded on desktop (§15) */}
      <div className="w-full sm:px-6 lg:px-8 sm:pt-6">
        <div className="relative w-full aspect-video overflow-hidden bg-zinc-950 sm:rounded-lg">
          {activity.activity_type === 'TYPE_VIDEO' ? (
            <Suspense fallback={<PlayerSkeleton />}>
              <VideoActivity activity={activity} course={course} orgUuid={org?.org_uuid} />
            </Suspense>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
              {t('video.notAVideo', { defaultValue: 'This content is not a playable video.' })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {channelVideo.title}
            </h1>
          </div>
          {isDraftPreview && (
            <Badge variant="secondary" className="gap-1">
              <Lock size={12} aria-hidden="true" />
              {t('video.draftPreview', { defaultValue: 'Not published — only visible to you' })}
            </Badge>
          )}
        </div>

        <ChannelRow org={org} orgslug={orgslug} />

        {channelVideo.description && (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {channelVideo.description}
          </p>
        )}

        <MetadataChips channelVideo={channelVideo} />
      </div>
    </div>
  )
}

export default function VideoWatchClient(props: VideoWatchClientProps) {
  return <VideoWatchContent {...props} />
}
