'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Clapperboard, Lock } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { Badge } from '@components/ui/badge'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import UploadChannelVideoModal, { type ChannelVideoEditData } from './UploadChannelVideoModal'

interface ChannelShortCardProps {
  channelVideo: ChannelVideoEditData & {
    thumbnail_image?: string | null
    published: boolean
    visibility: string
  }
  orgslug: string
  /** Required to gate the owner/admin-only Edit action, same pattern as
   * ChannelVideoCard. */
  orgId: number
}

// Vertical counterpart of ChannelVideoCard (Phase 2E), reusing its
// thumbnail/badge/chip/edit conventions but at the 9:16 aspect Shorts are
// actually shot in (§16), and linking to the Phase 3D/3E Shorts viewer
// (/shorts/{id}) instead of the long-form watch page.
export default function ChannelShortCard({ channelVideo, orgslug, orgId }: ChannelShortCardProps) {
  const { t } = useTranslation()

  const href = getUriWithOrg(orgslug, `/shorts/${channelVideo.id}`)
  const isDraft = !channelVideo.published
  const isUnlisted = channelVideo.published && channelVideo.visibility !== 'public'

  const chips = [channelVideo.subject, channelVideo.topic].filter((v): v is string => !!v)

  return (
    <div className="group relative flex w-36 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-lg hover:shadow-gray-300/15 sm:w-44">
      {/* Sibling of the Link below, same reasoning as ChannelVideoCard: a
          real standalone control, not a button nested inside an anchor. Real
          enforcement is server-side (PUT .../videos/{id}); this only hides
          the control from viewers who can't use it. */}
      <AuthenticatedClientElement
        action="update"
        ressourceType="courses"
        checkMethod="roles"
        orgId={orgId}
      >
        <div className="absolute top-2 end-2 z-10">
          <UploadChannelVideoModal orgId={orgId} orgslug={orgslug} mode="edit" channelVideo={channelVideo} />
        </div>
      </AuthenticatedClientElement>

      <Link
        href={href}
        className="flex flex-1 flex-col rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-t-lg bg-muted">
          {channelVideo.thumbnail_image ? (
            <img
              src={channelVideo.thumbnail_image}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Clapperboard className="text-muted-foreground" size={28} aria-hidden="true" />
            </div>
          )}
          {(isDraft || isUnlisted) && (
            <Badge variant="secondary" className="absolute top-2 start-2 gap-1">
              <Lock size={10} aria-hidden="true" />
              {isDraft
                ? t('video.card.draft', { defaultValue: 'Draft' })
                : t('video.card.unlisted', { defaultValue: 'Unlisted' })}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-1 p-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {channelVideo.title}
          </h3>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {chips.map((chip) => (
                <Badge key={chip} variant="outline" className="text-[10px] font-normal">
                  {chip}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
