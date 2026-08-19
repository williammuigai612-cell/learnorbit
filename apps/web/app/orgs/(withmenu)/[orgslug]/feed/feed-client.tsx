'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { LogIn, RefreshCw, Sparkles } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useHomeFeed } from '@/hooks/queries/useHomeFeed'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import ChannelVideoCard from '@components/Objects/Channel/ChannelVideoCard'
import { Button } from '@components/ui/button'

// Phase 4G — roadmap "Home feed". Reverse-chronological grid of long-form
// videos from channels the viewer follows, reusing ChannelVideoCard exactly
// as anticipated by its `channel` prop (docs/UI_UX_IMPLEMENTATION_PLAN.md
// UI-5 "video listing/grid components reused across channel and home
// surfaces"). Card links use this page's own `orgslug` (not each video's
// owning org's slug) — the same convention the global Shorts queue already
// established (short.tsx), since single-tenancy local dev collapses
// org-scoped routing onto one seeded org regardless of which slug is in the
// URL; see docs/CLAUDE.md's Multi-tenancy note.
function FeedCardSkeleton() {
  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-muted" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

export default function HomeFeedClient({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const isAuthenticated = session?.status === 'authenticated'
  const sessionLoading = session?.status === 'loading'

  const { data: items, isLoading, isError, refetch, isRefetching } = useHomeFeed()

  return (
    <GeneralWrapperStyled>
      <div className="flex flex-col gap-3 pt-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {t('feed.title', { defaultValue: 'Home' })}
        </h1>

        {sessionLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <FeedCardSkeleton key={i} />
            ))}
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <LogIn className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('feed.signedOut.title', { defaultValue: 'Sign in to see your feed' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('feed.signedOut.description', {
                defaultValue: 'Videos from the channels you follow show up here.',
              })}
            </p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/login">{t('auth.sign_in', { defaultValue: 'Sign in' })}</Link>
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <FeedCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-lg border border-border bg-card text-center">
            <p className="text-sm text-muted-foreground">
              {t('feed.error', { defaultValue: "Couldn't load your feed." })}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 px-4 rounded-lg border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="text-muted-foreground" size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('feed.empty.title', { defaultValue: 'Nothing here yet' })}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t('feed.empty.description', {
                defaultValue:
                  'Follow some channels to see their videos here, or check back once they post something new.',
              })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <ChannelVideoCard
                key={item.id}
                channelVideo={item}
                orgslug={orgslug}
                orgId={item.org_id}
                channel={{ name: item.org_name, channel_type: item.channel_type }}
              />
            ))}
          </div>
        )}
      </div>
    </GeneralWrapperStyled>
  )
}
