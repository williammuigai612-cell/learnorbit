'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Clapperboard } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { useShortsQueue } from '@/hooks/queries/useShorts'

// Landing target for the fixed Shorts nav entry (OrgSidebar/OrgBottomTabBar).
// There's no standalone "browse Shorts" page yet — Phase 3D/3E only built
// the single-Short viewer (`/shorts/{id}`) — so this reuses the existing,
// unmodified global queue (Phase 3E's `useShortsQueue`, same GET /shorts
// endpoint from Phase 3C) purely to redirect into the first Short. No new
// endpoint, no new hook, no changes to the viewer itself.
export default function ShortsIndexClient({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: queue, isLoading } = useShortsQueue()

  const firstId: number | undefined = queue && queue.length > 0 ? queue[0].id : undefined

  useEffect(() => {
    if (firstId !== undefined) {
      router.replace(getUriWithOrg(orgslug, `/shorts/${firstId}`))
    }
  }, [firstId, orgslug, router])

  if (isLoading || firstId !== undefined) {
    return <div className="min-h-[var(--org-content-viewport,100dvh)] w-full bg-black" />
  }

  // No published Shorts anywhere yet — the only state this page needs to
  // handle beyond "redirect to the first one" (DESIGN_SYSTEM.md §20 Empty).
  return (
    <div className="flex min-h-[var(--org-content-viewport,100dvh)] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clapperboard className="text-muted-foreground" size={24} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
          {t('short.index.empty.title', { defaultValue: 'No Shorts yet' })}
        </h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {t('short.index.empty.description', {
            defaultValue: 'No Shorts have been published yet. Check back soon.',
          })}
        </p>
        <Link
          href={getUriWithOrg(orgslug, '/')}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t('video.backToChannel', { defaultValue: 'Back to channel' })}
        </Link>
      </div>
    </div>
  )
}
