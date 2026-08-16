'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrgMenuItems } from '@components/Objects/Menus/OrgMenuLinks'
import { useJoinBannerVisible, JOIN_BANNER_HEIGHT } from '@components/Objects/Banners/OrgJoinBanner'
import { cn } from '@/lib/utils'

const HEADER_HEIGHT = 60

// Persistent left sidebar (desktop, >= lg) for an org's primary destinations —
// per docs/DESIGN_SYSTEM.md §14. Reflows content (never overlays it, see
// styles/globals.css consumer in (withmenu)/layout.tsx) and mirrors the same
// item set as the mobile bottom tab bar / header "more" menu.
export function OrgSidebar({ orgslug }: { orgslug: string }) {
  const items = useOrgMenuItems(orgslug)
  const pathname = usePathname()
  const { isVisible: isJoinBannerVisible } = useJoinBannerVisible()
  const topOffset = (isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0) + HEADER_HEIGHT

  if (items.length === 0) return null

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden lg:flex lg:flex-col fixed start-0 bottom-0 w-60 border-e border-border bg-background overflow-y-auto"
      style={{ top: topOffset, zIndex: 'var(--z-nav)' }}
    >
      <nav className="flex flex-col gap-1 p-3">
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
            <Link key={item.key} href={item.href}>
              {content}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export default OrgSidebar
