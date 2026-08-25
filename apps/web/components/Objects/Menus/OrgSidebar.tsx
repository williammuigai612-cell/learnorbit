'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { FilmSlate, House } from '@phosphor-icons/react'
import { useOrgMenuItems } from '@components/Objects/Menus/OrgMenuLinks'
import { useJoinBannerVisible, JOIN_BANNER_HEIGHT } from '@components/Objects/Banners/OrgJoinBanner'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

// Exported so OrgMenuChrome can subtract the same fixed-header height when it
// computes --org-content-viewport, rather than repeating the number.
export const HEADER_HEIGHT = 60

// Persistent left sidebar (desktop, >= lg) for an org's primary destinations —
// per docs/DESIGN_SYSTEM.md §14. Reflows content (never overlays it, see
// styles/globals.css consumer in (withmenu)/layout.tsx) and mirrors the same
// item set as the mobile bottom tab bar / header "more" menu.
export function OrgSidebar({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const items = useOrgMenuItems(orgslug)
  const pathname = usePathname()
  const { isVisible: isJoinBannerVisible } = useJoinBannerVisible()
  const topOffset = (isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0) + HEADER_HEIGHT

  // Shorts is a fixed, global destination — not a per-org, feature-gated
  // menu item — so it's rendered here directly, outside useOrgMenuItems,
  // prepended above the config-driven list. See docs/ARCHITECTURE.md §
  // "Videos / Shorts (Phase 3A)" point 7 for the full decision.
  const shortsHref = getUriWithOrg(orgslug, '/shorts')
  const isShortsActive = pathname === shortsHref || pathname?.startsWith(`${shortsHref}/`)

  // Home (Phase 4G) is a second fixed, global destination — same rationale
  // as Shorts above: it's a cross-org personalized feed, not a per-org
  // feature-gated menu item, so it can't come from useOrgMenuItems either.
  const homeHref = getUriWithOrg(orgslug, '/feed')
  const isHomeActive = pathname === homeHref || pathname?.startsWith(`${homeHref}/`)

  return (
    // Phase 9C: the label used to sit on the <aside> (a complementary
    // landmark), leaving the real <nav> unnamed — so a screen reader announced
    // "complementary: Primary navigation" plus an anonymous navigation. The
    // name belongs on the navigation landmark itself.
    <aside
      className="hidden lg:flex lg:flex-col fixed start-0 bottom-0 w-60 border-e border-border bg-background overflow-y-auto"
      style={{ top: topOffset, zIndex: 'var(--z-nav)' }}
    >
      <nav
        aria-label={t('a11y.primaryNavigation', { defaultValue: 'Primary navigation' })}
        className="flex flex-col gap-1 p-3"
      >
        <Link href={homeHref} aria-current={isHomeActive ? 'page' : undefined}>
          <span
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              isHomeActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
            )}
          >
            <House size={22} weight={isHomeActive ? 'fill' : 'regular'} aria-hidden="true" />
            <span className="truncate">{t('feed.nav.label', { defaultValue: 'Home' })}</span>
          </span>
        </Link>
        <Link href={shortsHref} aria-current={isShortsActive ? 'page' : undefined}>
          <span
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              isShortsActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
            )}
          >
            <FilmSlate size={22} weight={isShortsActive ? 'fill' : 'regular'} aria-hidden="true" />
            <span className="truncate">{t('short.nav.label', { defaultValue: 'Shorts' })}</span>
          </span>
        </Link>
        {items.map((item) => {
          const isActive =
            !item.external &&
            pathname != null &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`))
          const content = (
            <span
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              )}
            >
              <item.Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </span>
          )
          return item.external ? (
            <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer">
              {content}
            </a>
          ) : (
            <Link key={item.key} href={item.href} aria-current={isActive ? 'page' : undefined}>
              {content}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export default OrgSidebar
