'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { DotsThreeCircle, FilmSlate, House } from '@phosphor-icons/react'
import { useOrgMenuItems } from '@components/Objects/Menus/OrgMenuLinks'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'

// Reduced from 3 to 2 config-driven slots to make room for both fixed tabs
// below — Home + Shorts + 2 + "More" = 5 — preserving docs/DESIGN_SYSTEM.md
// §14's documented 4-5 top-level destination cap rather than exceeding it.
// See docs/ARCHITECTURE.md § "Videos / Shorts (Phase 3A)" point 7 (Shorts,
// the original fixed tab) and its Phase 4G extension (Home).
// Exported so OrgMenu's "More" panel can render exactly the destinations this
// bar had to leave out, rather than keeping a second copy of the split.
export const MAX_TABS = 2

// The bar's rendered height (py-2 + a 22px icon + the label line), which
// OrgMenuChrome pads <main> by (plus the safe-area inset). Exported so the one
// route that opts out of that padding — the Shorts viewer — can subtract the
// same number instead of hardcoding its own. See docs/PROGRESS.md Phase 9D.
export const BOTTOM_TAB_BAR_HEIGHT = 64

// Mobile/tablet (< lg) primary navigation — per docs/DESIGN_SYSTEM.md §14:
// 4-5 top-level destinations max, everything else behind "More" rather than
// a hamburger drawer duplicating this bar.
export function OrgBottomTabBar({
  orgslug,
  onMoreClick,
}: {
  orgslug: string
  onMoreClick: () => void
}) {
  const { t } = useTranslation()
  const items = useOrgMenuItems(orgslug)
    .filter((i) => !i.external)
    .slice(0, MAX_TABS)
  const pathname = usePathname()

  // Shorts is a fixed, global destination — not a per-org, feature-gated
  // menu item — so it's rendered here directly, outside useOrgMenuItems,
  // ahead of the config-driven tabs. See docs/ARCHITECTURE.md §
  // "Videos / Shorts (Phase 3A)" point 7 for the full decision.
  const shortsHref = getUriWithOrg(orgslug, '/shorts')
  const isShortsActive = pathname === shortsHref || pathname?.startsWith(`${shortsHref}/`)

  // Home (Phase 4G) is a second fixed, global destination — same rationale
  // as Shorts above.
  const homeHref = getUriWithOrg(orgslug, '/feed')
  const isHomeActive = pathname === homeHref || pathname?.startsWith(`${homeHref}/`)

  return (
    <nav
      aria-label={t('a11y.primaryNavigation', { defaultValue: 'Primary navigation' })}
      className="lg:hidden fixed bottom-0 start-0 end-0 flex items-stretch border-t border-border bg-background"
      style={{ zIndex: 'var(--z-nav)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Phase 9C: active state was colour + icon-weight only, with nothing in
          the accessibility tree naming the current destination. */}
      <Link
        href={homeHref}
        aria-current={isHomeActive ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 text-xs font-medium transition-colors',
          isHomeActive ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <House size={22} weight={isHomeActive ? 'fill' : 'regular'} aria-hidden="true" />
        <span className="truncate max-w-full px-1">{t('feed.nav.label', { defaultValue: 'Home' })}</span>
      </Link>
      <Link
        href={shortsHref}
        aria-current={isShortsActive ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 text-xs font-medium transition-colors',
          isShortsActive ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <FilmSlate size={22} weight={isShortsActive ? 'fill' : 'regular'} aria-hidden="true" />
        <span className="truncate max-w-full px-1">{t('short.nav.label', { defaultValue: 'Shorts' })}</span>
      </Link>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
            <span className="truncate max-w-full px-1">{item.label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label={t('a11y.moreDestinations', { defaultValue: 'More destinations' })}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 text-xs font-medium text-muted-foreground transition-colors"
      >
        <DotsThreeCircle size={22} aria-hidden="true" />
        <span>{t('a11y.more', { defaultValue: 'More' })}</span>
      </button>
    </nav>
  )
}

export default OrgBottomTabBar
