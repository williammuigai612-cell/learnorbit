'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Lock, School, Video as VideoIcon } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { formatRelative } from '@/lib/format'
import { Badge } from '@components/ui/badge'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import UploadChannelVideoModal from './UploadChannelVideoModal'

export interface ChannelVideoCardData {
  id: number
  title: string
  description?: string | null
  thumbnail_image?: string | null
  published: boolean
  visibility: string
  creation_date: string
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
  resource_type?: string | null
}

interface ChannelVideoCardProps {
  channelVideo: ChannelVideoCardData
  orgslug: string
  /** Required to gate the owner/admin-only Edit action (Phase 2G-2) and to
   * call the update endpoint. Every current caller (ChannelVideosSection)
   * already has this resolved before rendering cards. */
  orgId: number
  /** Reused on multi-channel surfaces (e.g. a future home feed, per
   * docs/UI_UX_IMPLEMENTATION_PLAN.md UI-5 "reused across channel and home
   * surfaces") where the creator/channel isn't already established by the
   * surrounding page. Omitted on a single channel's own page — the
   * ChannelHeader above the grid already names and badges the channel, so
   * repeating it on every card would be redundant, not useful (DESIGN_SYSTEM
   * §13's "no colored background" / information-density principles).
   */
  channel?: { name: string; channel_type?: string } | null
}

function ChannelTypeIcon({ channelType }: { channelType?: string }) {
  return channelType === 'INSTRUCTOR' ? (
    <GraduationCap size={12} aria-hidden="true" />
  ) : (
    <School size={12} aria-hidden="true" />
  )
}

export default function ChannelVideoCard({ channelVideo, orgslug, orgId, channel }: ChannelVideoCardProps) {
  const { t, i18n } = useTranslation()

  const href = getUriWithOrg(orgslug, `/videos/${channelVideo.id}`)
  const isDraft = !channelVideo.published
  const isUnlisted = channelVideo.published && channelVideo.visibility !== 'public'

  const chips = [channelVideo.subject, channelVideo.topic, channelVideo.level].filter(
    (v): v is string => !!v
  )

  return (
    <div className="group relative flex flex-col bg-card rounded-lg border border-border overflow-hidden transition-shadow hover:shadow-lg hover:shadow-gray-300/15">
      {/* Sibling of the Link below (not nested inside it) so this stays a
          real, standalone control instead of an invalid button-inside-anchor.
          Real enforcement is server-side (PUT .../videos/{id}); this only
          hides the control from viewers who can't use it. */}
      <AuthenticatedClientElement
        action="update"
        ressourceType="courses"
        checkMethod="roles"
        orgId={orgId}
      >
        <div className="absolute top-2 end-2 z-10">
          <UploadChannelVideoModal
            orgId={orgId}
            orgslug={orgslug}
            mode="edit"
            channelVideo={channelVideo}
          />
        </div>
      </AuthenticatedClientElement>

      <Link
        href={href}
        className="flex flex-col flex-1 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
      <div className="relative w-full aspect-video overflow-hidden bg-muted rounded-t-lg">
        {channelVideo.thumbnail_image ? (
          <img
            src={channelVideo.thumbnail_image}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <VideoIcon className="text-muted-foreground" size={28} aria-hidden="true" />
          </div>
        )}
        {(isDraft || isUnlisted) && (
          <Badge
            variant="secondary"
            className="absolute top-2 start-2 gap-1"
          >
            <Lock size={10} aria-hidden="true" />
            {isDraft
              ? t('video.card.draft', { defaultValue: 'Draft' })
              : t('video.card.unlisted', { defaultValue: 'Unlisted' })}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3 sm:p-4">
        <h3 className="text-[1.0625rem] font-semibold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {channelVideo.title}
        </h3>

        {channel && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ChannelTypeIcon channelType={channel.channel_type} />
            {channel.name}
          </span>
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {chips.map((chip) => (
              <Badge key={chip} variant="outline" className="text-[11px] font-normal">
                {chip}
              </Badge>
            ))}
          </div>
        )}

        {channelVideo.creation_date && (
          <span className="text-xs text-muted-foreground pt-0.5">
            {t('video.card.published', {
              defaultValue: 'Published {{date}}',
              date: formatRelative(channelVideo.creation_date, i18n.language),
            })}
          </span>
        )}
      </div>
      </Link>
    </div>
  )
}
