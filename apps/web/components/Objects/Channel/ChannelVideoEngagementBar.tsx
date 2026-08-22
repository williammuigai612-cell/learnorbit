'use client'

import React, { useState } from 'react'
import { Heart, Bookmark, Share2, Check, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import {
  useChannelVideoLikeStatus,
  useLikeChannelVideo,
  useUnlikeChannelVideo,
  useChannelVideoSaveStatus,
  useSaveChannelVideo,
  useUnsaveChannelVideo,
  useChannelVideoShareStatus,
  useShareChannelVideo,
} from '@/hooks/queries/useChannelVideoEngagement'
import { Button } from '@components/ui/button'
import { ChannelVideoCommentsPanel } from '@components/Objects/Channel/ChannelVideoCommentsPanel'
import { ReportChannelVideoDialog } from '@components/Objects/Channel/ReportChannelVideoDialog'

interface ChannelVideoEngagementBarProps {
  orgId: number | undefined
  channelVideoId: number | string | undefined
  /** Org slug + video id, used only to build the link copied by the Share
   * button (Phase 4E) — optional so existing call sites without it still
   * compile; Share just stays hidden without it. */
  orgslug?: string
  /** 'horizontal' (default) is the long-form watch page's light-background
   * row. 'rail' (Phase 4F) is the Shorts vertical icon+count stack, styled
   * `--foreground`-on-scrim per docs/DESIGN_SYSTEM.md §16 so it stays legible
   * over video content. Same hooks/handlers either way — presentation only. */
  layout?: 'horizontal' | 'rail'
}

function LikeSkeleton() {
  return <div className="h-8 w-14 rounded-md bg-muted animate-pulse" aria-hidden="true" />
}

function SaveSkeleton() {
  return <div className="h-8 w-8 rounded-md bg-muted animate-pulse" aria-hidden="true" />
}

function ShareSkeleton() {
  return <div className="h-8 w-14 rounded-md bg-muted animate-pulse" aria-hidden="true" />
}

function RailSkeleton() {
  return <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" aria-hidden="true" />
}

// Shorts rail icon+count stack (Phase 4F) — a non-interactive variant (no
// <button>) is used for actions unauthenticated viewers can see but not
// perform, matching the horizontal layout's <span> fallback below.
function RailItem({
  icon,
  label,
  count,
  active,
  disabled,
  interactive = true,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  disabled?: boolean
  interactive?: boolean
  onClick?: () => void
}) {
  const iconWrapperClass =
    'flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm ring-1 ring-white/20'

  return (
    <div className="flex flex-col items-center gap-1">
      {interactive ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onClick}
          aria-pressed={active}
          aria-label={label}
          className={`${iconWrapperClass} hover:bg-black/50 hover:text-white`}
        >
          {icon}
        </Button>
      ) : (
        <span className={iconWrapperClass} aria-label={label}>
          {icon}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs font-medium text-white drop-shadow-sm">{count}</span>
      )}
    </div>
  )
}

// Rail-styled trigger for ChannelVideoCommentsPanel's Dialog (Phase 4F) —
// forwards ref/props so Radix's DialogTrigger `asChild` (a Slot clone) can
// attach its onClick/aria attributes, same contract as the panel's default
// Button trigger.
const RailCommentTrigger = React.forwardRef<
  HTMLButtonElement,
  { commentCount: number | undefined; isLoading: boolean; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ commentCount, isLoading, label, ...props }, ref) => {
  if (isLoading) return <RailSkeleton />
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm ring-1 ring-white/20 hover:bg-black/50 hover:text-white"
        {...props}
      >
        <MessageCircle size={20} aria-hidden="true" />
      </Button>
      {commentCount !== undefined && (
        <span className="text-xs font-medium text-white drop-shadow-sm">{commentCount}</span>
      )}
    </div>
  )
})
RailCommentTrigger.displayName = 'RailCommentTrigger'

// Like (Phase 4B) + Save (Phase 4D) + Comments (Phase 4C) + Share (Phase 4E).
export function ChannelVideoEngagementBar({
  orgId,
  channelVideoId,
  orgslug,
  layout = 'horizontal',
}: ChannelVideoEngagementBarProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'

  const { data: likeStatus, isLoading } = useChannelVideoLikeStatus(orgId, channelVideoId)
  const likeVideo = useLikeChannelVideo(orgId, channelVideoId)
  const unlikeVideo = useUnlikeChannelVideo(orgId, channelVideoId)

  const isLiked = likeStatus?.is_liked ?? false
  const likeCount = likeStatus?.like_count
  const likePending = likeVideo.isPending || unlikeVideo.isPending

  const handleToggleLike = () => {
    if (likePending) return
    if (isLiked) unlikeVideo.mutate()
    else likeVideo.mutate()
  }

  const likeLabel = isLiked
    ? t('video.unlike', { defaultValue: 'Unlike this video' })
    : t('video.like', { defaultValue: 'Like this video' })

  const { data: saveStatus, isLoading: isSaveLoading } = useChannelVideoSaveStatus(orgId, channelVideoId)
  const saveVideo = useSaveChannelVideo(orgId, channelVideoId)
  const unsaveVideo = useUnsaveChannelVideo(orgId, channelVideoId)

  const isSaved = saveStatus?.is_saved ?? false
  const savePending = saveVideo.isPending || unsaveVideo.isPending

  const handleToggleSave = () => {
    if (savePending) return
    if (isSaved) unsaveVideo.mutate()
    else saveVideo.mutate()
  }

  const saveLabel = isSaved
    ? t('video.unsave', { defaultValue: 'Remove from saved' })
    : t('video.save', { defaultValue: 'Save this video' })

  const { data: shareStatus, isLoading: isShareLoading } = useChannelVideoShareStatus(orgId, channelVideoId)
  const shareVideo = useShareChannelVideo(orgId, channelVideoId)
  const [linkCopied, setLinkCopied] = useState(false)
  const shareCount = shareStatus?.share_count

  const handleShare = async () => {
    if (shareVideo.isPending || !channelVideoId) return
    shareVideo.mutate()
    try {
      const relativeUrl = getUriWithOrg(orgslug ?? '', `/videos/${channelVideoId}`)
      const absoluteUrl = new URL(relativeUrl, window.location.origin).toString()
      await navigator.clipboard.writeText(absoluteUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Clipboard write can fail (permissions/insecure context); the share
      // event is still recorded above, so this only skips the "Copied" tick.
    }
  }

  const shareLabel = t('video.share', { defaultValue: 'Copy link to share this video' })

  if (layout === 'rail') {
    return (
      <div
        className="flex flex-col items-center gap-4"
        role="group"
        aria-label={t('video.engagement', { defaultValue: 'Video engagement' })}
      >
        {isLoading || likeCount === undefined ? (
          <RailSkeleton />
        ) : (
          <RailItem
            icon={
              <Heart
                size={20}
                aria-hidden="true"
                className={isLiked ? 'fill-current text-primary' : undefined}
              />
            }
            label={
              isAuthenticated
                ? likeLabel
                : t('video.likeCount', { count: likeCount, defaultValue: '{{count}} likes' })
            }
            count={likeCount}
            active={isLiked}
            disabled={likePending}
            interactive={isAuthenticated}
            onClick={isAuthenticated ? handleToggleLike : undefined}
          />
        )}

        <ChannelVideoCommentsPanel
          orgId={orgId}
          channelVideoId={channelVideoId}
          trigger={({ commentCount, isLoading: commentsLoading }) => (
            <RailCommentTrigger
              commentCount={commentCount}
              isLoading={commentsLoading}
              label={t('video.comments.open', { defaultValue: 'View comments' })}
            />
          )}
        />

        {isAuthenticated &&
          (isSaveLoading ? (
            <RailSkeleton />
          ) : (
            <RailItem
              icon={
                <Bookmark
                  size={20}
                  aria-hidden="true"
                  className={isSaved ? 'fill-current text-primary' : undefined}
                />
              }
              label={saveLabel}
              active={isSaved}
              disabled={savePending}
              onClick={handleToggleSave}
            />
          ))}

        {isShareLoading || shareCount === undefined ? (
          <RailSkeleton />
        ) : (
          <RailItem
            icon={
              linkCopied ? (
                <Check size={20} aria-hidden="true" className="text-primary" />
              ) : (
                <Share2 size={20} aria-hidden="true" />
              )
            }
            label={
              isAuthenticated
                ? shareLabel
                : t('video.shareCount', { count: shareCount, defaultValue: '{{count}} shares' })
            }
            count={shareCount}
            disabled={shareVideo.isPending}
            interactive={isAuthenticated}
            onClick={isAuthenticated ? handleShare : undefined}
          />
        )}

        {isAuthenticated && (
          <ReportChannelVideoDialog orgId={orgId} channelVideoId={channelVideoId} variant="rail" />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('video.engagement', { defaultValue: 'Video engagement' })}>
      {isLoading || likeCount === undefined ? (
        <LikeSkeleton />
      ) : isAuthenticated ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={likePending}
          onClick={handleToggleLike}
          aria-pressed={isLiked}
          aria-label={likeLabel}
          className="gap-1.5 px-3"
        >
          <Heart
            size={16}
            aria-hidden="true"
            className={isLiked ? 'fill-current text-primary' : 'text-muted-foreground'}
          />
          <span className={isLiked ? 'text-primary' : 'text-muted-foreground'}>{likeCount}</span>
        </Button>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground"
          aria-label={t('video.likeCount', { count: likeCount, defaultValue: '{{count}} likes' })}
        >
          <Heart size={16} aria-hidden="true" />
          {likeCount}
        </span>
      )}

      {isAuthenticated && (
        isSaveLoading ? (
          <SaveSkeleton />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={savePending}
            onClick={handleToggleSave}
            aria-pressed={isSaved}
            aria-label={saveLabel}
            className="px-2"
          >
            <Bookmark
              size={16}
              aria-hidden="true"
              className={isSaved ? 'fill-current text-primary' : 'text-muted-foreground'}
            />
          </Button>
        )
      )}

      {isShareLoading || shareCount === undefined ? (
        <ShareSkeleton />
      ) : isAuthenticated ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleShare}
          aria-label={shareLabel}
          className="gap-1.5 px-3"
        >
          {linkCopied ? (
            <Check size={16} aria-hidden="true" className="text-primary" />
          ) : (
            <Share2 size={16} aria-hidden="true" className="text-muted-foreground" />
          )}
          <span className="text-muted-foreground">{shareCount}</span>
        </Button>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground"
          aria-label={t('video.shareCount', { count: shareCount, defaultValue: '{{count}} shares' })}
        >
          <Share2 size={16} aria-hidden="true" />
          {shareCount}
        </span>
      )}

      <ChannelVideoCommentsPanel orgId={orgId} channelVideoId={channelVideoId} />

      {isAuthenticated && (
        <ReportChannelVideoDialog orgId={orgId} channelVideoId={channelVideoId} />
      )}
    </div>
  )
}

export default ChannelVideoEngagementBar
