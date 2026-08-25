import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Guards the Phase 9C accessibility invariants that ESLint can't see.
 *
 * `eslint-config-next` already ships a subset of eslint-plugin-jsx-a11y, but
 * the rules that would catch these (label association, contrast, ARIA pattern
 * misuse) either don't exist or would light up the whole inherited LearnHouse
 * tree — and CI lints WHOLE changed files, so enabling them would block PRs on
 * debt they merely walked past. Same reasoning as the React Compiler rules in
 * eslint.config.mjs. These assertions are scoped to the LearnOrbit-added
 * surface instead, which is what Phase 9C actually reviewed.
 */

const webRoot = path.resolve(import.meta.dirname, '..')
const read = (p) => fs.readFileSync(path.join(webRoot, p), 'utf8')

// Several assertions below are "this attribute must not appear". The Phase 9C
// comments explain what was removed and quote the old attribute verbatim, so
// those checks have to read code only — otherwise a comment describing the fix
// trips the guard against it.
const codeOnly = (src) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, '') // line comments

describe('landmarks and bypass blocks', () => {
  // WCAG 2.4.1. Every org page renders through OrgMenuChrome, so this one
  // file decides whether the whole (withmenu) tree has a main landmark.
  test('OrgMenuChrome renders a <main> landmark and a skip link', () => {
    const src = read('components/Objects/Menus/OrgMenuChrome.tsx')
    expect(src).toContain('<main')
    expect(src).toContain('id="main-content"')
    expect(src).toContain('href="#main-content"')
    expect(src).toMatch(/sr-only\s+focus:not-sr-only/)
  })

  // The name belongs on the navigation landmark, not the <aside> wrapping it.
  test('OrgSidebar labels the <nav>, not the <aside>', () => {
    const src = read('components/Objects/Menus/OrgSidebar.tsx')
    const aside = src.slice(src.indexOf('<aside'), src.indexOf('<nav'))
    expect(aside).not.toContain('aria-label')
    expect(src).toMatch(/<nav\s+aria-label=/)
  })
})

describe('current-page state is exposed, not colour-only', () => {
  for (const file of [
    'components/Objects/Menus/OrgSidebar.tsx',
    'components/Objects/Menus/OrgBottomTabBar.tsx',
  ]) {
    test(`${file} marks the active destination with aria-current`, () => {
      const src = read(file)
      // Home, Shorts, and the config-driven items each need their own.
      expect([...src.matchAll(/aria-current=/g)].length).toBeGreaterThanOrEqual(3)
    })
  }
})

describe('form controls have accessible names', () => {
  // docs/DESIGN_SYSTEM.md §22 forbids placeholder-only labels outright.
  const placeholderOnly = [
    ['components/Objects/Channel/ChannelVideoCommentsPanel.tsx', 'Textarea'],
    ['app/orgs/[orgslug]/dash/questions/client.tsx', 'input'],
    ['app/orgs/[orgslug]/dash/quizzes/client.tsx', 'input'],
    ['components/Objects/Dash/QuestionPickerModal.tsx', 'input'],
  ]

  for (const [file, tag] of placeholderOnly) {
    test(`${file}: every <${tag}> with a placeholder also carries a name`, () => {
      const src = read(file)
      const opens = [...src.matchAll(new RegExp(`<${tag}\\b[^>]*?/?>`, 'gs'))]
      expect(opens.length).toBeGreaterThan(0)
      for (const [openTag] of opens) {
        if (!openTag.includes('placeholder')) continue
        expect(
          /aria-label|aria-labelledby|\bid=/.test(openTag),
          `unnamed placeholder-only control in ${file}: ${openTag.slice(0, 90)}`
        ).toBe(true)
      }
    })
  }

  test('quiz answer inputs are labelled by the question prompt', () => {
    const src = read('app/orgs/(withmenu)/[orgslug]/quizzes/[quizid]/attempt/[attemptid]/attempt.tsx')
    expect([...src.matchAll(/aria-labelledby=\{promptId\}/g)].length).toBeGreaterThanOrEqual(2)
  })
})

describe('ARIA patterns are not over-promised', () => {
  // role="radio"/"radiogroup" promises a roving-tabindex + arrow-key contract
  // that plain buttons don't implement (WCAG 4.1.2). Phase 9C swapped these
  // for toggle buttons in a labelled group.
  test('quiz multiple-choice does not claim the radiogroup pattern', () => {
    const src = codeOnly(
      read('app/orgs/(withmenu)/[orgslug]/quizzes/[quizid]/attempt/[attemptid]/attempt.tsx')
    )
    expect(src).not.toContain('role="radiogroup"')
    expect(src).not.toContain('role="radio"')
    expect(src).toContain('aria-pressed={selected}')
  })

  // aria-label on a bare <span> is not exposed — a generic role prohibits
  // naming. Visually-hidden text is.
  test('engagement counts use sr-only text, not aria-label on a span', () => {
    const src = codeOnly(read('components/Objects/Channel/ChannelVideoEngagementBar.tsx'))
    expect(src).not.toMatch(/<span[^>]*\n?[^>]*aria-label=/)
    expect(src).toContain('sr-only')
  })
})

describe('live regions do not flood', () => {
  // A region that re-renders every second must not be assertive: it would
  // interrupt a screen reader once per second during a timed exam.
  test('QuizTimer keeps the countdown out of the live region', () => {
    const src = read('components/Objects/Channel/QuizTimer.tsx')
    expect(src).toContain('aria-live="off"')
    expect(src).not.toContain("aria-live={state.urgency")
    expect(src).toContain('ANNOUNCE_AT_SECONDS')
  })
})

describe('contrast: no known-failing text colours on the LearnOrbit surface', () => {
  // Measured on --background (white) in styles/globals.css:
  //   text-success 3.31:1 | text-warning 2.16:1 | *-400 greys ~2.6:1
  //   text-red-500 ~3.3:1 — all below the 4.5:1 floor for body text.
  // The *-strong variants (5.02:1 / 5.05:1) exist for text; the base
  // --success/--warning tokens stay valid for icons, fills and borders,
  // which only need 3:1.
  const BANNED_TEXT = /className="[^"]*\btext-(?:neutral|gray|zinc|slate)-[1-4]00\b[^"]*"/
  const BANNED_STATE = /\btext-(?:success|warning)\b(?!-strong)/
  const BANNED_RED = /\btext-red-500\b/

  const surface = [
    'components/Objects/Menus/NotificationBell.tsx',
    'components/Objects/Menus/OrgSidebar.tsx',
    'components/Objects/Menus/OrgBottomTabBar.tsx',
    'components/Objects/Channel/ChannelVideoCommentsPanel.tsx',
    'components/Objects/Channel/ChannelVideoEngagementBar.tsx',
    'components/Objects/Channel/ReportChannelVideoDialog.tsx',
    'components/Objects/Channel/QuizTimer.tsx',
    'components/Objects/Account/subpages/AccountFamily.tsx',
    'components/Objects/Account/subpages/AccountFamilyChildActivity.tsx',
    'app/orgs/(withmenu)/[orgslug]/quizzes/[quizid]/results/results.tsx',
    'app/orgs/(withmenu)/[orgslug]/progress/progress.tsx',
  ]

  for (const file of surface) {
    test(`${file} uses no sub-4.5:1 text colour`, () => {
      const src = codeOnly(read(file))
      expect(BANNED_TEXT.test(src), `low-contrast grey text in ${file}`).toBe(false)
      expect(BANNED_RED.test(src), `text-red-500 (3.3:1) in ${file}`).toBe(false)
      // Icon-only uses of the base state tokens are fine; this file set has none.
      if (/text-(success|warning)/.test(src)) {
        expect(BANNED_STATE.test(src), `bare text-success/text-warning in ${file}`).toBe(false)
      }
    })
  }

  test('the text-safe state tokens are defined for both themes', () => {
    const css = read('styles/globals.css')
    expect(css).toContain('--color-success-strong')
    expect(css).toContain('--color-warning-strong')
    expect([...css.matchAll(/--success-strong:/g)].length).toBe(2)
    expect([...css.matchAll(/--warning-strong:/g)].length).toBe(2)
  })
})
