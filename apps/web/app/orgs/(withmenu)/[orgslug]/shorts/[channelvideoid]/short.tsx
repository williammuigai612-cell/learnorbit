'use client'

import React, { Suspense, lazy, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronLeft, ChevronUp, GraduationCap, Lock, School, VideoOff } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import {
  useChannelVideo,
  useChannelVideoActivity,
  useChannelVideoCourse,
} from '@/hooks/queries/useChannelVideo'
import { useShortsQueue } from '@/hooks/queries/useShorts'
import { Badge } from '@components/ui/badge'

// Max consecutive auto-skips when walking past broken/inaccessible queue
// items (Phase 3E requirement 6) — a safety net against an unlikely run of
// back-to-back bad entries, not an expected path.
const MAX_AUTO_SKIPS = 8

const VideoActivity = lazy(() => import('@components/Objects/Activities/Video/Video'))

interface ShortViewerClientProps {
  channelvideoid: string
  orgslug: string
}

// The shared player (Video.tsx) hardcodes a 16:9 `aspect-video` wrapper
// around LearnHousePlayer/YouTube, sized for the long-form watch page. This
// viewer instead sizes its own `.short-viewer-frame` to the documented 9:16
// presentation (§16) and neutralizes that inner wrapper's own aspect-ratio so
// it simply fills the frame — a scoped CSS override rather than a change to
// the shared player.
function ShortPlayerSkeleton() {
  return (
    <div className="short-viewer-frame relative aspect-[9/16] h-[min(100dvh,calc(100vw*16/9))] w-auto max-w-full overflow-hidden bg-zinc-900 animate-pulse sm:h-[min(80dvh,calc(100vw*16/9))] sm:rounded-lg">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/10" />
      </div>
    </div>
  )
}

// Not found vs. not-visible-to-this-viewer are reported identically by the
// API's own 404/403 split (see services/orgs/channel_videos.py), same as the
// Phase 2D watch page. `not_a_short` is unique to this viewer: the requested
// ChannelVideo exists and is accessible, but is long-form content, not a
// Short — rendered with the same not-found/inaccessible UX pattern rather
// than being played as a Short.
function ShortUnavailableState({
  orgslug,
  variant,
}: {
  orgslug: string
  variant: 'not_found' | 'inaccessible' | 'not_a_short'
}) {
  const { t } = useTranslation()
  const Icon = variant === 'inaccessible' ? Lock : VideoOff
  const title =
    variant === 'not_found'
      ? t('short.notFound.title', { defaultValue: 'Short not found' })
      : variant === 'not_a_short'
        ? t('short.notAShort.title', { defaultValue: "This isn't a Short" })
        : t('short.inaccessible.title', { defaultValue: "This Short isn't available" })
  const description =
    variant === 'not_found'
      ? t('short.notFound.description', {
          defaultValue: "The Short you're looking for doesn't exist or may have been removed.",
        })
      : variant === 'not_a_short'
        ? t('short.notAShort.description', {
            defaultValue: 'This video is long-form content, not a Short.',
          })
        : t('short.inaccessible.description', {
            defaultValue: "This Short isn't published, or you don't have access to view it.",
          })

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 sm:min-h-0 sm:py-24">
      <div className="max-w-md text-center">
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
    </div>
  )
}

function ShortChannelTypeBadge({ channelType }: { channelType?: string }) {
  const { t } = useTranslation()
  const isInstructor = channelType === 'INSTRUCTOR'
  const Icon = isInstructor ? GraduationCap : School
  const label = isInstructor
    ? t('channel.type.instructor', { defaultValue: 'Teacher / Educational Creator' })
    : t('channel.type.school', { defaultValue: 'School / Institution' })

  return (
    <Badge
      variant="outline"
      className="gap-1 border-white/30 bg-white/10 text-white backdrop-blur-sm"
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </Badge>
  )
}

// Bottom-left attribution + subject/topic metadata over a scrim, per §16 —
// deliberately not the full `ChannelHeader` and no engagement rail
// (likes/comments/saves/share are Phase 4).
function ShortAttributionOverlay({ org, channelVideo }: { org: any; channelVideo: any }) {
  const logoUrl = org?.logo_image ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image) : null
  const metadataChip = [channelVideo?.subject, channelVideo?.topic].filter(Boolean).join(' · ')

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-6 pt-16 sm:pb-5">
      <div className="pointer-events-auto flex flex-col gap-2 text-white">
        <div className="flex items-center gap-2 min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-white/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              {org?.channel_type === 'INSTRUCTOR' ? (
                <GraduationCap size={14} aria-hidden="true" />
              ) : (
                <School size={14} aria-hidden="true" />
              )}
            </div>
          )}
          <span className="text-sm font-semibold truncate">{org?.name}</span>
          <ShortChannelTypeBadge channelType={org?.channel_type} />
        </div>
        {channelVideo?.title && (
          <p className="text-sm leading-snug line-clamp-2">{channelVideo.title}</p>
        )}
        {metadataChip && (
          <Badge
            variant="outline"
            className="w-fit border-white/30 bg-white/10 text-white backdrop-blur-sm"
          >
            {metadataChip}
          </Badge>
        )}
      </div>
    </div>
  )
}

function ShortViewerContent({ orgslug, channelvideoid }: ShortViewerClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const org = useOrg() as any

  const channelVideoIdNum = Number(channelvideoid)
  const {
    data: channelVideo,
    error: channelVideoError,
    isLoading: channelVideoLoading,
  } = useChannelVideo(org?.id, Number.isFinite(channelVideoIdNum) ? channelVideoIdNum : undefined)

  const isShort = channelVideo?.content_format === 'short'

  // Only chase the underlying Activity/Course once we know this is actually a
  // Short — a long-form hit at this URL is rejected below without the extra
  // fetches.
  const {
    data: activity,
    error: activityError,
    isLoading: activityLoading,
  } = useChannelVideoActivity(isShort ? channelVideo?.activity_id : undefined)

  const {
    data: course,
    error: courseError,
    isLoading: courseLoading,
  } = useChannelVideoCourse(isShort ? activity?.course_id : undefined)

  // Phase 3E: the global Shorts queue (GET /shorts, unchanged from Phase 3C)
  // determines prev/next — same reverse-chronological order the API already
  // returns, no client-side ranking/filtering. A Short reached by direct
  // link that isn't in this public queue (e.g. an admin previewing their own
  // unpublished draft) degrades to a singleton: no prev/next, identical to
  // plain Phase 3D behavior.
  const { data: queue } = useShortsQueue()
  const currentIndex = queue ? queue.findIndex((s: any) => s.id === channelVideoIdNum) : -1
  const prevId: number | undefined = currentIndex > 0 ? queue![currentIndex - 1].id : undefined
  const nextId: number | undefined =
    currentIndex >= 0 && currentIndex < (queue?.length ?? 0) - 1 ? queue![currentIndex + 1].id : undefined

  let errorVariant: 'not_found' | 'inaccessible' | 'not_a_short' | undefined
  if (channelVideoError) {
    errorVariant = (channelVideoError as any)?.status === 404 ? 'not_found' : 'inaccessible'
  } else if (channelVideo && !isShort) {
    errorVariant = 'not_a_short'
  } else if (activityError || courseError) {
    errorVariant = 'inaccessible'
  } else if (activity && !activity.published) {
    // Same guard as the Phase 2D watch page: a published channel post whose
    // underlying course Activity is still a draft (course-level RBAC doesn't
    // check the activity's own `published` flag) is treated as inaccessible
    // rather than rendered.
    errorVariant = 'inaccessible'
  }

  const isLoading =
    !org || channelVideoLoading || (!!channelVideo && isShort && (activityLoading || (!!activity && courseLoading)))
  const slideReady = !errorVariant && !isLoading && !!channelVideo && !!activity && !!course

  const navigatingRef = useRef(false)
  const didCenterRef = useRef(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef<HTMLDivElement>(null)
  const prevSpacerRef = useRef<HTMLDivElement>(null)
  const nextSpacerRef = useRef<HTMLDivElement>(null)

  // A `useRef` counter would reset on every hop (each Short is a real page
  // navigation, remounting this component), so the auto-skip cap below is
  // threaded through the URL instead — the only state that survives across
  // those remounts without a new persistence mechanism.
  const autoSkipCount = Number(searchParams.get('autoskip')) || 0

  const goTo = (id: number | undefined, nextAutoSkipCount = 0) => {
    if (id === undefined || navigatingRef.current) return
    navigatingRef.current = true
    const query = nextAutoSkipCount > 0 ? `?autoskip=${nextAutoSkipCount}` : ''
    router.push(getUriWithOrg(orgslug, `/shorts/${id}${query}`), { scroll: false })
  }

  // Requirement 6: skip a broken/inaccessible queue item rather than
  // stalling the experience — only when there's somewhere to skip to;
  // otherwise this falls through to the normal Unavailable state below,
  // unchanged from Phase 3D. Capped so an unlikely run of consecutive bad
  // entries can't loop forever.
  const skipTarget = nextId ?? prevId
  const canAutoSkip = skipTarget !== undefined && autoSkipCount < MAX_AUTO_SKIPS
  useEffect(() => {
    if (!errorVariant || navigatingRef.current || !canAutoSkip) return
    goTo(skipTarget, autoSkipCount + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorVariant, canAutoSkip, skipTarget])

  // ArrowUp/ArrowDown walk the queue — ignored while focus is in a form
  // field so normal text/input interaction is never hijacked.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target?.isContentEditable) return
      if (e.key === 'ArrowUp' && prevId !== undefined) {
        e.preventDefault()
        goTo(prevId)
      } else if (e.key === 'ArrowDown' && nextId !== undefined) {
        e.preventDefault()
        goTo(nextId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevId, nextId])

  // Center the current slide between its (optional) spacers once its DOM
  // exists — guarded so it only ever fires once per mount, never fighting a
  // user's own in-progress scroll on unrelated re-renders.
  useEffect(() => {
    if (didCenterRef.current || !slideRef.current) return
    didCenterRef.current = true
    slideRef.current.scrollIntoView({ block: 'start' })
  })

  // Native swipe (mobile): a snap-scroll container with an empty spacer
  // above/below the current slide. Scrolling a spacer into view — a real
  // touch swipe, no gesture library — is detected via IntersectionObserver
  // and triggers the same queue navigation as the desktop controls/arrow
  // keys.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !slideReady) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue
          if (entry.target === prevSpacerRef.current) goTo(prevId)
          else if (entry.target === nextSpacerRef.current) goTo(nextId)
        }
      },
      { root: scroller, threshold: 0.6 }
    )
    if (prevSpacerRef.current) observer.observe(prevSpacerRef.current)
    if (nextSpacerRef.current) observer.observe(nextSpacerRef.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideReady, prevId, nextId])

  if (errorVariant) {
    // A skip attempt is already in flight (effect above) — show the loading
    // skeleton instead of a jarring error flash while it resolves.
    if (canAutoSkip) {
      return (
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-black sm:min-h-0 sm:py-10">
          <ShortPlayerSkeleton />
        </div>
      )
    }
    return <ShortUnavailableState orgslug={orgslug} variant={errorVariant} />
  }

  if (!slideReady) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-black sm:min-h-0 sm:py-10">
        <ShortPlayerSkeleton />
      </div>
    )
  }

  // Shorts autoplay muted (§16) — the shared player already reads
  // `activity.details.autoplay`/`muted` (both the HLS and YouTube branches),
  // so this overrides just those two fields on a shallow-cloned activity
  // rather than changing the player's own autoplay logic.
  const autoplayActivity = {
    ...activity,
    details: { ...activity.details, autoplay: true, muted: true },
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-3 bg-black sm:min-h-0 sm:flex-row sm:gap-4 sm:py-10">
      <Link
        href={getUriWithOrg(orgslug, '/')}
        className="absolute start-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={t('video.backToChannel', { defaultValue: 'Back to channel' })}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </Link>

      {/* Mobile swipe: real vertical scroll + scroll-snap, no gesture
          library. Desktop disables the scroller (sm:snap-none
          sm:overflow-visible) and relies on the button/arrow-key controls
          instead — matches §16's "centered fixed-aspect" desktop
          presentation, which has room for its own controls beside the
          player rather than an overlaid swipe affordance. */}
      <div
        ref={scrollerRef}
        className="relative h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll sm:h-auto sm:w-auto sm:snap-none sm:overflow-visible"
      >
        {prevId !== undefined && (
          <div ref={prevSpacerRef} aria-hidden="true" className="h-[100dvh] w-full snap-start sm:hidden" />
        )}

        <div ref={slideRef} className="flex h-[100dvh] w-full snap-start items-center justify-center sm:h-auto">
          <div className="short-viewer-frame relative aspect-[9/16] h-[min(100dvh,calc(100vw*16/9))] w-auto max-w-full overflow-hidden bg-zinc-950 sm:h-[min(80dvh,calc(100vw*16/9))] sm:rounded-lg sm:ring-1 sm:ring-white/10">
            <div className="short-video-fill">
              {activity.activity_type === 'TYPE_VIDEO' ? (
                <Suspense fallback={<ShortPlayerSkeleton />}>
                  <VideoActivity activity={autoplayActivity} course={course} orgUuid={org?.org_uuid} />
                </Suspense>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm px-4 text-center">
                  {t('video.notAVideo', { defaultValue: 'This content is not a playable video.' })}
                </div>
              )}
            </div>
            <ShortAttributionOverlay org={org} channelVideo={channelVideo} />
            {nextId === undefined && queue && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center sm:hidden">
                <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {t('short.endOfQueue', { defaultValue: "You're all caught up" })}
                </span>
              </div>
            )}
          </div>
        </div>

        {nextId !== undefined && (
          <div ref={nextSpacerRef} aria-hidden="true" className="h-[100dvh] w-full snap-start sm:hidden" />
        )}
      </div>

      <div className="hidden flex-col gap-3 sm:flex">
        <button
          type="button"
          onClick={() => goTo(prevId)}
          disabled={prevId === undefined}
          aria-label={t('short.previous', { defaultValue: 'Previous Short' })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronUp size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => goTo(nextId)}
          disabled={nextId === undefined}
          aria-label={t('short.next', { defaultValue: 'Next Short' })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Scoped override: Video.tsx's wrapper chain (a plain-flow `w-full`
          div around a `16:9 aspect-video` div) only resolves height via an
          auto-height ancestor, so percentage heights can't reach down to it.
          Rather than touching Video.tsx, every element in that chain is
          pinned edge-to-edge via absolute positioning off this 9:16 frame —
          same technique, no dependency on ancestor auto-height. */}
      <style jsx global>{`
        .short-video-fill,
        .short-video-fill > div,
        .short-video-fill .aspect-video,
        .short-video-fill .learnhouse-player,
        .short-video-fill .learnhouse-player > div {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
    </div>
  )
}

export default function ShortViewerClient(props: ShortViewerClientProps) {
  return <ShortViewerContent {...props} />
}
