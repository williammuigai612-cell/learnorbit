'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { FileText, GraduationCap, Lock, School } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { formatRelative } from '@/lib/format'
import { Badge } from '@components/ui/badge'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import UploadChannelResourceModal from './UploadChannelResourceModal'

export interface ChannelResourceCardData {
  id: number
  title: string
  description?: string | null
  published: boolean
  visibility: string
  creation_date: string
  subject?: string | null
  topic?: string | null
  level?: string | null
  institution_context?: string | null
  resource_type?: string | null
  year?: string | null
}

interface ChannelResourceCardProps {
  channelResource: ChannelResourceCardData
  orgslug: string
  /** Required to gate the owner/admin-only Edit action and to call the
   * update endpoint. */
  orgId: number
  /** Reused on multi-channel surfaces where the creator/channel isn't
   * already established by the surrounding page — same rationale as
   * ChannelVideoCard's `channel` prop. */
  channel?: { name: string; channel_type?: string } | null
}

function ChannelTypeIcon({ channelType }: { channelType?: string }) {
  return channelType === 'INSTRUCTOR' ? (
    <GraduationCap size={12} aria-hidden="true" />
  ) : (
    <School size={12} aria-hidden="true" />
  )
}

// Resource cards are icon/badge-driven, not thumbnail-driven — no
// thumbnail_image field on ChannelResource per docs/ARCHITECTURE.md §
// "Academic Library (Phase 5A)"; docs/DESIGN_SYSTEM.md §13's Resource card
// spec is file-type icon/badge → title → metadata chips → view action.
export default function ChannelResourceCard({ channelResource, orgslug, orgId, channel }: ChannelResourceCardProps) {
  const { t, i18n } = useTranslation()

  const href = getUriWithOrg(orgslug, `/resources/${channelResource.id}`)
  const isDraft = !channelResource.published
  const isUnlisted = channelResource.published && channelResource.visibility !== 'public'

  const chips = [
    channelResource.subject,
    channelResource.level,
    channelResource.institution_context,
    channelResource.resource_type,
    channelResource.year,
  ].filter((v): v is string => !!v)

  return (
    <div className="group relative flex flex-col bg-card rounded-lg border border-border overflow-hidden transition-shadow hover:shadow-lg hover:shadow-gray-300/15">
      {/* Sibling of the Link below (not nested inside it) — same pattern as
          ChannelVideoCard. Real enforcement is server-side (PUT
          .../resources/{id}); this only hides the control from viewers who
          can't use it. */}
      <AuthenticatedClientElement
        action="update"
        ressourceType="courses"
        checkMethod="roles"
        orgId={orgId}
      >
        <div className="absolute top-2 end-2 z-10">
          <UploadChannelResourceModal
            orgId={orgId}
            orgslug={orgslug}
            mode="edit"
            channelResource={channelResource}
          />
        </div>
      </AuthenticatedClientElement>

      <Link
        href={href}
        className="flex flex-col flex-1 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted rounded-t-lg flex items-center justify-center">
          <FileText className="text-muted-foreground" size={32} aria-hidden="true" />
          {(isDraft || isUnlisted) && (
            <Badge
              variant="secondary"
              className="absolute top-2 start-2 gap-1"
            >
              <Lock size={10} aria-hidden="true" />
              {isDraft
                ? t('resource.card.draft', { defaultValue: 'Draft' })
                : t('resource.card.unlisted', { defaultValue: 'Unlisted' })}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-1.5 p-3 sm:p-4">
          <h3 className="text-[1.0625rem] font-semibold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {channelResource.title}
          </h3>

          {channel && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ChannelTypeIcon channelType={channel.channel_type} />
              {channel.name}
            </span>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {chips.map((chip, i) => (
                <Badge key={`${chip}-${i}`} variant="outline" className="text-[11px] font-normal">
                  {chip}
                </Badge>
              ))}
            </div>
          )}

          {channelResource.creation_date && (
            <span className="text-xs text-muted-foreground pt-0.5">
              {t('resource.card.published', {
                defaultValue: 'Published {{date}}',
                date: formatRelative(channelResource.creation_date, i18n.language),
              })}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}
