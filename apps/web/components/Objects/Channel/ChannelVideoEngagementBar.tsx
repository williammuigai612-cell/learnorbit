'use client'

import React from 'react'
import { Heart, Bookmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  useChannelVideoLikeStatus,
  useLikeChannelVideo,
  useUnlikeChannelVideo,
  useChannelVideoSaveStatus,
  useSaveChannelVideo,
  useUnsaveChannelVideo,
} from '@/hooks/queries/useChannelVideoEngagement'
import { Button } from '@components/ui/button'
import { ChannelVideoCommentsPanel } from '@components/Objects/Channel/ChannelVideoCommentsPanel'

interface ChannelVideoEngagementBarProps {
  orgId: number | undefined
  channelVideoId: number | string | undefined
}

function LikeSkeleton() {
  return <div className="h-8 w-14 rounded-md bg-muted animate-pulse" aria-hidden="true" />
}

function SaveSkeleton() {
  return <div className="h-8 w-8 rounded-md bg-muted animate-pulse" aria-hidden="true" />
}

// Like (Phase 4B) + Save (Phase 4D) + Comments (Phase 4C). Rendered as a row
// so a later Share phase (see docs/ROADMAP.md Phase 4) can add a sibling
// control to this same row without redesigning it; no placeholder controls
// for that are rendered here (§ Session Completion Protocol / no dead
// controls).
export function ChannelVideoEngagementBar({ orgId, channelVideoId }: ChannelVideoEngagementBarProps) {
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

      <ChannelVideoCommentsPanel orgId={orgId} channelVideoId={channelVideoId} />
    </div>
  )
}

export default ChannelVideoEngagementBar
