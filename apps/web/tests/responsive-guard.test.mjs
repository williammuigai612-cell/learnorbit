import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Guards the Phase 9D mobile-responsive invariants (M1-M8).
 * M9 (touch-target sizes) is out of scope and deliberately unguarded.
 *
 * Same rationale and shape as tests/a11y-guard.test.mjs: these are layout
 * contracts spread across several files that no lint rule can see, and the
 * repo has no DOM-rendering test setup for .tsx. Asserting on the source is
 * what the existing guard tests do, so this follows that pattern rather than
 * introducing a new test stack for one increment.
 */

const webRoot = path.resolve(import.meta.dirname, '..')
const read = (p) => fs.readFileSync(path.join(webRoot, p), 'utf8')

// Several assertions below are "this class must not appear". The Phase 9D
// comments quote the replaced values verbatim, so those checks have to read
// code only — same stripping helper as the 9C guard.
const codeOnly = (src) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, '') // line comments

// --- M1 + M2: the mobile/tablet "More" panel -------------------------------

describe('M1 — every primary destination stays reachable below lg', () => {
  // The bottom tab bar shows Home + Shorts + MAX_TABS config items. With the
  // default 6-item menu that strands Library, Podcasts, Communities,
  // Playgrounds and Store with no mobile entry point at all.
  test('OrgBottomTabBar exports MAX_TABS so the More panel can agree on the split', () => {
    const src = codeOnly(read('components/Objects/Menus/OrgBottomTabBar.tsx'))
    expect(src).toMatch(/export const MAX_TABS\b/)
  })

  test('OrgMenu renders the destinations the tab bar could not fit', () => {
    const src = codeOnly(read('components/Objects/Menus/OrgMenu.tsx'))
    // Reuses the shared menu data, not a second hardcoded list.
    expect(src).toContain('useOrgMenuItems')
    expect(src).toContain('MAX_TABS')
    // The overflow list is a real navigation landmark, like the other two.
    expect(src).toMatch(/<nav\s+aria-label=/)
  })
})

describe('M2 — the More panel works at tablet widths', () => {
  // The bar is `lg:hidden` but the panel it opens was `md:hidden`, so between
  // 768px and 1023px tapping More did nothing at all.
  test('the panel is gated at lg, matching the bar that opens it', () => {
    const src = codeOnly(read('components/Objects/Menus/OrgMenu.tsx'))
    const panel = src.slice(src.indexOf('--z-nav-menu') - 600, src.indexOf('--z-nav-menu'))
    expect(panel).toContain('lg:hidden')
    expect(panel).not.toMatch(/\bmd:hidden\b/)
  })
})

// --- M3: Shorts is a true full-viewport mobile experience ------------------

describe('M3 — Shorts owns the visible viewport below sm', () => {
  test('OrgMenuChrome drops the footer and the tab-bar padding on /shorts', () => {
    const src = codeOnly(read('components/Objects/Menus/OrgMenuChrome.tsx'))
    expect(src).toMatch(/noFooterPaths\s*=\s*\[[^\]]*'shorts'/)
    // pb-16 clears the bottom tab bar everywhere else, but on Shorts it would
    // push the 100dvh slide below the fold and make the page scroll.
    expect(src).toMatch(/isFullViewportPage/)
    expect(src).toMatch(/--org-content-viewport/)
  })

  test('the chrome offset accounts for the join banner, header and tab bar', () => {
    const src = codeOnly(read('components/Objects/Menus/OrgMenuChrome.tsx'))
    expect(src).toContain('JOIN_BANNER_HEIGHT')
    expect(src).toContain('HEADER_HEIGHT')
    expect(src).toContain('BOTTOM_TAB_BAR_HEIGHT')
  })

  for (const file of [
    'app/orgs/(withmenu)/[orgslug]/shorts/[channelvideoid]/short.tsx',
    'app/orgs/(withmenu)/[orgslug]/shorts/shorts-index.tsx',
  ]) {
    test(`${file} sizes against the chrome-aware viewport, not raw 100dvh`, () => {
      const src = codeOnly(read(file))
      // A bare 100dvh height ignores the 60px fixed header above and the 64px
      // fixed tab bar below, so the slide overflows the visible area.
      expect(src).not.toMatch(/-\[(?:min\()?100dvh/)
      expect(src).toContain('var(--org-content-viewport,100dvh)')
    })
  }

  test('the snap scroller, its spacers and the slide all share one height', () => {
    const src = codeOnly(read('app/orgs/(withmenu)/[orgslug]/shorts/[channelvideoid]/short.tsx'))
    // IntersectionObserver-driven swipe navigation only works while the
    // spacers and the slide are exactly one viewport tall each.
    const heights = [...src.matchAll(/h-\[var\(--org-content-viewport,100dvh\)\]/g)]
    expect(heights.length).toBeGreaterThanOrEqual(4)
  })
})

// --- M5: the exam timer neither hides nor covers anything ------------------

describe('M5 — the quiz timer clears the chrome and the answer column', () => {
  test('the timer offsets from the same header/banner geometry as the chrome', () => {
    const src = codeOnly(read('components/Objects/Channel/QuizTimer.tsx'))
    // `fixed top-20` (80px) sits *under* the 60px header + 48px join banner,
    // so with the banner up the timer disappeared behind the chrome entirely.
    expect(src).not.toMatch(/\btop-20\b/)
    expect(src).toContain('useJoinBannerVisible')
    expect(src).toContain('JOIN_BANNER_HEIGHT')
    expect(src).toContain('HEADER_HEIGHT')
  })

  test('the timer is in-flow below sm and only fixed above it', () => {
    const src = codeOnly(read('components/Objects/Channel/QuizTimer.tsx'))
    // Fixed at every width, it floated over the right edge of the answer
    // options on a full-width mobile column.
    expect(src).toContain('sticky')
    expect(src).toContain('sm:fixed')
  })
})

// --- M6: dialogs stay usable when the keyboard eats the viewport -----------

describe('M6 — the comments and report dialogs fit narrow viewports', () => {
  for (const file of [
    'components/Objects/Channel/ChannelVideoCommentsPanel.tsx',
    'components/Objects/Channel/ReportChannelVideoDialog.tsx',
  ]) {
    test(`${file} sizes its DialogContent for small screens`, () => {
      const src = codeOnly(read(file))
      // The primitive is `w-full max-w-lg` with no inset, so at 360px the
      // dialog ran edge to edge.
      expect(src).toContain('w-[95vw]')
      expect(src).toContain('sm:w-full')
      // dvh, not vh: vh ignores the on-screen keyboard, so the composer and
      // the submit button ended up underneath it.
      expect(src).toContain('max-h-[85dvh]')
      expect(src).not.toMatch(/max-h-\[85vh\]/)
    })
  }

  test('the shared dialog primitive still does not size individual dialogs', () => {
    const src = codeOnly(read('components/ui/dialog.tsx'))
    expect(src).not.toContain('w-[95vw]')
  })
})

// --- M7: stacked dialog buttons do not touch -------------------------------

describe('M7 — DialogFooter separates its stacked mobile buttons', () => {
  const footer = () => {
    const src = codeOnly(read('components/ui/dialog.tsx'))
    const i = src.indexOf('DialogFooter')
    return src.slice(i, src.indexOf('DialogFooter.displayName', i))
  }

  test('the column-reverse stack gets a gap', () => {
    // `flex flex-col-reverse` with no gap: measured 0px between the two
    // buttons at 360x640 and 390x844 before this fix.
    expect(footer()).toMatch(/\bgap-y-2\b/)
  })

  test('desktop spacing is untouched — the gap is axis-scoped, not zeroed', () => {
    const f = footer()
    // `sm:gap-0` would have been the obvious pair, but five callers pass their
    // own `gap-2` (four `mt-5 gap-2` footers plus Modal.tsx). twMerge keeps a
    // caller's unprefixed `gap-2` *and* the base's `sm:gap-0`, so those five
    // lost 8px of desktop button spacing (measured 20px -> 12px). Scoping to
    // the row axis fixes the stack and is a no-op in a single-row flex, which
    // measured desktop-identical to the pre-fix baseline.
    expect(f).toMatch(/\bsm:gap-y-0\b/)
    expect(f).not.toMatch(/\bsm:gap-0\b/)
    // The pre-existing desktop rule must survive untouched.
    expect(f).toContain('sm:space-x-3')
  })

  test('the callers that supply their own gap were not edited', () => {
    for (const file of [
      'app/home/home.tsx',
      'app/(hub)/account/page.tsx',
      'components/Objects/Account/subpages/AccountDangerZone.tsx',
    ]) {
      expect(read(file)).toContain('<DialogFooter className="mt-5 gap-2">')
    }
    expect(read('components/Objects/StyledElements/Modal/Modal.tsx')).toContain(
      'flex flex-row justify-end gap-2'
    )
  })
})

// --- M8: the tab-bar padding clears the home indicator ---------------------

describe('M8 — mobile bottom padding includes the safe-area inset', () => {
  test('OrgMenuChrome pads past env(safe-area-inset-bottom), but only below lg', () => {
    const src = codeOnly(read('components/Objects/Menus/OrgMenuChrome.tsx'))
    // The tab bar already adds the inset to itself; <main> did not, so on a
    // notched device the last row of content sat under the home indicator.
    expect(src).toMatch(/pb-\[calc\(4rem_\+_env\(safe-area-inset-bottom\)\)\]/)
    expect(src).not.toMatch(/'lg:ps-60 \$\{[^}]*\} ?pb-16/)
    // Desktop must not inherit the extra padding.
    expect(src).toContain('lg:pb-0')
  })
})

// --- M4: engagement controls fit narrow viewports --------------------------

describe('M4 — the engagement bar does not overflow at 360px', () => {
  test('the inline bar layout wraps', () => {
    const src = codeOnly(read('components/Objects/Channel/ChannelVideoEngagementBar.tsx'))
    // The `rail` layout is already a column and wraps nothing; this is the
    // inline `bar` layout used on the long-form watch page, which packs
    // like/save/share/comments/report into one unwrapped row.
    expect(src).toContain('flex flex-wrap items-center gap-2')
  })
})
