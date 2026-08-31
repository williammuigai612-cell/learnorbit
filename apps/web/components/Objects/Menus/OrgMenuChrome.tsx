'use client';
import { useEffect, type CSSProperties, type ReactNode } from "react";
import Watermark from '@components/Objects/Watermark'
import { SessionGate } from '@components/Contexts/LHSessionContext'
import { OrgMenu } from '@components/Objects/Menus/OrgMenu'
import { OrgSidebar, HEADER_HEIGHT } from '@components/Objects/Menus/OrgSidebar'
import { BOTTOM_TAB_BAR_HEIGHT } from '@components/Objects/Menus/OrgBottomTabBar'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  OrgJoinBanner,
  OrgJoinBannerProvider,
  useJoinBannerVisible,
  JOIN_BANNER_HEIGHT,
} from '@components/Objects/Banners/OrgJoinBanner'
import { OrgMFAPolicyGate } from '@components/Objects/Banners/OrgMFAPolicyGate'
import { PodcastPlayerProvider } from '@components/Contexts/PodcastPlayerContext'
import dynamic from 'next/dynamic'
const PodcastPlayer = dynamic(() => import('@components/Objects/Podcasts/PodcastPlayer'), { ssr: false })
import Image from 'next/image'
import { PageViewTracker } from '@components/Analytics/PageViewTracker'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { usePlan } from '@components/Hooks/usePlan'
import { getGoogleFontUrl, DEFAULT_FONT } from '@/lib/fonts'

// The menu-bearing org chrome (nav, sidebar, banners, footer, podcast
// player) — extracted out of app/orgs/(withmenu)/[orgslug]/layout.tsx's
// default export into a plain component so that layout file can compose it
// with the shared OrgRootLayout (see components/Contexts/OrgRootLayout.tsx
// and docs/ARCHITECTURE.md § "Next.js dynamic-segment/route-group 404").

// Helper to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex || hex.length < 7) return 'transparent'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function OrgFooter() {
  const org = useOrg() as any
  const footerText = org?.config?.config?.customization?.general?.footer_text || org?.config?.config?.general?.footer_text || ''
  const plan = usePlan()
  const watermarkConfig = org?.config?.config?.customization?.general?.watermark ?? org?.config?.config?.general?.watermark
  const isFree = plan === 'free'
  const showWatermark = isFree || watermarkConfig !== false

  return (
    <footer className="w-full py-8 mt-12">
      <div className="flex flex-col items-center justify-center space-y-4">
        {footerText && <p className="text-sm text-gray-500">{footerText}</p>}
        {/* Mark only — the learnhouse.app destination was removed and
            LearnOrbit has no marketing site yet. */}
        {showWatermark && (
          <Image
            src="/lrn.svg"
            alt="LearnOrbit"
            width={24}
            height={24}
            style={{ height: 'auto' }}
            className="opacity-15 hover:opacity-40 transition-opacity duration-300"
          />
        )}
      </div>
    </footer>
  )
}

function LayoutContent({ children, orgslug }: { children: ReactNode; orgslug: string }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const primaryColor = org?.config?.config?.customization?.general?.color || org?.config?.config?.general?.color || ''
  const customFont = org?.config?.config?.customization?.general?.font || org?.config?.config?.general?.font || ''
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // chrome=none strips the org navigation/footer so this route can be embedded
  // inside another view (e.g. a Resource activity iframe) without duplicate chrome.
  const chromeless = searchParams?.get('chrome') === 'none'

  // Inject Google Font stylesheet into document head
  useEffect(() => {
    if (!customFont || customFont === DEFAULT_FONT) return

    const fontId = `gfont-${customFont.replace(/\s/g, '-')}`
    if (document.getElementById(fontId)) return

    // Add preconnect hints
    const preconnect1 = document.createElement('link')
    preconnect1.rel = 'preconnect'
    preconnect1.href = 'https://fonts.googleapis.com'
    document.head.appendChild(preconnect1)

    const preconnect2 = document.createElement('link')
    preconnect2.rel = 'preconnect'
    preconnect2.href = 'https://fonts.gstatic.com'
    preconnect2.crossOrigin = 'anonymous'
    document.head.appendChild(preconnect2)

    // Add font stylesheet
    const link = document.createElement('link')
    link.id = fontId
    link.rel = 'stylesheet'
    link.href = getGoogleFontUrl(customFont)
    document.head.appendChild(link)

    return () => {
      document.head.removeChild(preconnect1)
      document.head.removeChild(preconnect2)
      const existing = document.getElementById(fontId)
      if (existing) document.head.removeChild(existing)
    }
  }, [customFont])

  const pathParts = pathname?.split('/').filter(Boolean) || []

  // Pages that use a full-bleed layout (no footer/watermark)
  const noFooterPaths = ['copilot', 'shorts']
  const isFullBleedPage = noFooterPaths.some((p) => pathParts.includes(p))

  // Phase 9D (M3): Shorts is the one route that owns the whole visible viewport
  // on mobile (docs/DESIGN_SYSTEM.md §16). Everywhere else the bottom padding
  // clears the fixed tab bar, but here it would push the one-viewport-tall slide
  // below the fold and make the page scroll behind the chrome. Instead the
  // route drops the padding and sizes itself against --org-content-viewport —
  // the height actually left between the fixed chrome above and below.
  const isFullViewportPage = pathParts.includes('shorts')
  const { isVisible: isJoinBannerVisible } = useJoinBannerVisible()
  const chromeHeight =
    (isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0) + HEADER_HEIGHT + BOTTOM_TAB_BAR_HEIGHT

  return (
    <div
      // lh-org-font-root gives globals.css a hook to override this inline
      // font-family in Arabic, where Tajawal replaces the org's custom face
      // outright. An inline style beats any normal rule, so the override has to
      // target this element specifically.
      className="lh-org-font-root flex flex-col min-h-screen"
      style={{
        backgroundColor: primaryColor ? hexToRgba(primaryColor, 0.05) : 'transparent',
        ...(customFont ? { fontFamily: `'${customFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` } : {}),
      }}
    >
      <PageViewTracker />
      {/* Phase 9C: the only bypass mechanism past the top nav + sidebar (~12
          links) that precede content on every org page. Hidden until focused,
          so it costs nothing visually. */}
      {!chromeless && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{ zIndex: 'var(--z-nav)' }}
        >
          {t('a11y.skipToContent', { defaultValue: 'Skip to main content' })}
        </a>
      )}
      {!chromeless && <OrgJoinBanner />}
      {!chromeless && <OrgMenu orgslug={orgslug} />}
      {/* Org-wide 2FA policy: renders nothing unless this user is non-compliant. */}
      {!chromeless && <OrgMFAPolicyGate />}
      {/* Desktop (>= lg) primary nav; mobile/tablet use OrgMenu's bottom tab bar */}
      {!chromeless && <OrgSidebar orgslug={orgslug} />}
      {/* Phase 9C: the page's `main` landmark and the skip link's target.
          Was a plain div, which left every org page without a main landmark
          (docs/DESIGN_SYSTEM.md §22, WCAG 2.4.1). `tabIndex={-1}` makes the
          skip link's jump actually move focus, not just the scroll position. */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 relative focus:outline-hidden ${
          // Phase 9D (M8): the tab bar adds env(safe-area-inset-bottom) to its
          // own padding, but <main> cleared only the bar's 4rem — so on a
          // notched device the last row of content sat under the home
          // indicator. `lg:pb-0` still drops all of it once the sidebar takes
          // over, so desktop gains no stray spacing.
          !chromeless
            ? `lg:ps-60 ${isFullViewportPage ? '' : 'pb-[calc(4rem_+_env(safe-area-inset-bottom))] lg:pb-0'}`
            : ''
        }`}
        style={
          {
            zIndex: 'var(--z-content)',
            // A custom property rather than an inline height: an inline style
            // would beat the `sm:`-prefixed overrides the Shorts viewer uses to
            // fall back to its centred desktop layout.
            '--org-content-viewport': `calc(100dvh - ${chromeHeight}px - env(safe-area-inset-bottom))`,
          } as CSSProperties
        }
      >
        {children}
      </main>
      {!isFullBleedPage && !chromeless && (
        <div className="lg:ps-60">
          <OrgFooter />
        </div>
      )}
      {!isFullBleedPage && !chromeless && <Watermark />}
    </div>
  )
}

export function OrgMenuChrome({ orgslug, children }: { orgslug: string; children: ReactNode }) {
  return (
    <>
      <SessionGate>
      <OrgJoinBannerProvider>
        <PodcastPlayerProvider>
          <LayoutContent orgslug={orgslug}>
            {children}
          </LayoutContent>
          <PodcastPlayer />
        </PodcastPlayerProvider>
      </OrgJoinBannerProvider>
      </SessionGate>
    </>
  )
}
