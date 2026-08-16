'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DotsThreeCircle } from '@phosphor-icons/react'
import { useOrgMenuItems } from '@components/Objects/Menus/OrgMenuLinks'
import { cn } from '@/lib/utils'

const MAX_TABS = 4

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
  const items = useOrgMenuItems(orgslug)
    .filter((i) => !i.external)
    .slice(0, MAX_TABS)
  const pathname = usePathname()

  if (items.length === 0) return null

  return (
    <nav
      aria-label="Primary navigation"
      className="lg:hidden fixed bottom-0 start-0 end-0 flex items-stretch border-t border-border bg-background"
      style={{ zIndex: 'var(--z-nav)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.key}
            href={item.href}
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
        aria-label="More"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-11 text-xs font-medium text-muted-foreground transition-colors"
      >
        <DotsThreeCircle size={22} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  )
}

export default OrgBottomTabBar
