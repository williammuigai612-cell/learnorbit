# LearnOrbit — Design System

## Status
Version 1.0 — initial design system. This is the visual source of truth for LearnOrbit. Every UI phase in
`docs/UI_UX_IMPLEMENTATION_PLAN.md` must follow this document. If a screen needs something this document
doesn't define, extend this document first, then build the screen — don't invent a one-off pattern.

**Scope note:** this document is design specification only. No application code, `tailwind.config.*`,
`styles/globals.css`, or component file was modified while writing it. Where a token below is genuinely new
(not yet present in `apps/web/styles/globals.css`), it is explicitly marked **[NEW]**. Everything else reuses
infrastructure that already exists in the codebase today.

## Grounding — what already exists (reused, not reinvented)
Confirmed by inspecting `apps/web` before writing this document:
- **Framework**: Next.js + Tailwind CSS v4, CSS-first theme (`@theme` block in `styles/globals.css`, no
  `tailwind.config.js`).
- **Component system**: shadcn/ui, `"style": "new-york"`, `"baseColor": "neutral"`, CSS variables on, no class
  prefix (`components.json`). 19 primitives already exist in `components/ui/`: `button`, `badge`, `input`,
  `textarea`, `select`, `checkbox`, `switch`, `dialog`, `tabs`, `table`, `tooltip`, `dropdown-menu`,
  `hover-card`, `hover-menu`, `popover`, `toggle`, `toggle-group`, `alert`, `label`, `navigation-menu`.
- **Icons**: `lucide-react` (`"iconLibrary": "lucide"` in `components.json`).
- **Styling utilities**: `class-variance-authority` (variant/size APIs), `clsx` + `tailwind-merge` via
  `lib/utils.ts`'s `cn()`, `tailwindcss-animate`.
- **Fonts**: `next/font/google` in `app/layout.tsx` — **Wix Madefor Text** (`--font-default`, Latin) is the
  product's font for every locale; **Tajawal** (`--font-arabic`) is force-applied for Arabic/RTL only (never
  used as a silent per-glyph fallback — see the comment in `layout.tsx`).
- **Color tokens**: HSL CSS variables in `@layer base` (`:root` / `.dark`), consumed as `hsl(var(--x))` via the
  `@theme` block. Currently the *shadcn neutral scaffold* — every token is 0% saturation (pure gray). No brand
  hue has been chosen yet. `docs/ROADMAP.md` Phase 0 lists "Establish LearnOrbit branding" as unchecked — this
  document is where that gets defined, by adding a hue to the existing tokens, not by renaming or restructuring
  them.
- **Radius**: `--radius: 0.5rem`, with `--radius-lg/md/sm` derived from it in the `@theme` block.
- **Z-index**: a full layering scale already exists (`--z-behind` through `--z-max`) — reused as-is in §9, not
  redefined.
- **Existing utility classes**: `.nice-shadow`, `.light-shadow` (elevation via `shadow` + `outline`, not heavy
  drop shadows) — reused as the basis for §9.
- **Motion**: the codebase explicitly replaced `framer-motion` with plain CSS `@keyframes`/transitions
  (`.animate-fade-in` comment: "replaces framer-motion"). This document does not reintroduce a JS animation
  library.
- **Breakpoints**: no custom breakpoints found — Tailwind v4 defaults apply (`sm 640px / md 768px / lg 1024px /
  xl 1280px / 2xl 1536px`).

---

## 1. Design Philosophy

### Core principles
1. **Education-first.** Every screen answers "does this help someone learn or find something to learn?" before
   "does this increase engagement?" Directly reflects `docs/PRD.md` §7: *"Learning comes first. Social features
   should improve discovery, motivation and interaction without turning the product into a generic social
   network."*
2. **Content-first.** The video, the resource, the question — not the chrome around it — is the visual focus.
   Navigation, metadata, and social affordances (likes, comments, follows) are supportive and secondary, never
   competing with content for attention.
3. **Simplicity.** One clear primary action per screen. Prefer removing an element over adding a setting to hide
   it. A dashboard with fewer, well-organized panels beats one with more panels of information.
4. **Trust.** Verified/institutional information must be visually distinguishable from unverified/user-submitted
   information wherever both exist (e.g., a `SCHOOL` channel vs. an `INSTRUCTOR` channel, per
   `docs/ARCHITECTURE.md` Phase 1A). Never imply verification, licensing, or endorsement without a legitimate
   backend source for that claim.
5. **Accessibility.** WCAG 2.1 AA is the floor, not a stretch goal — see §22.
6. **Mobile-first.** Design and build for the smallest viewport first, then progressively enhance for tablet and
   desktop (§7). A large share of the target audience (Kenyan students) is primarily on mid-range Android
   devices and variable-quality mobile data.

### Why this matters for LearnOrbit specifically
LearnOrbit sits between two failure modes it must actively avoid: a generic social/video app that happens to
have education content bolted on (loses trust, feels like a distraction platform), and a childish "school app"
that talks down to teenage and young-adult learners (loses engagement, feels babyish). Every principle above is
a guardrail against one of those two failure modes.

---

## 2. Brand Identity

### Visual personality
LearnOrbit is **calm, competent, and current** — closer in spirit to a well-designed productivity or fintech
product (Linear, Notion, Duolingo's non-mascot screens) than to a video app or a school portal. It should look
like a tool a serious student *chooses* to spend time in, not one they're assigned to use.

### Brand voice (visual translation)
| Voice trait | Visual translation |
|---|---|
| Encouraging, not patronizing | Confident typography, no cutesy illustration, no exclamation-heavy microcopy baked into UI chrome |
| Clear, not clever | Plain iconography (Lucide, no custom illustrated icon set), literal labels over cute ones |
| Focused, not noisy | A disciplined two-hue brand system (blue primary, teal secondary, §3) used sparingly, generous whitespace (§5), few simultaneous animations (§21) |
| Kenyan-context aware, not generic | Content-organization metadata (subject/level/institution/exam type, per `docs/PRD.md` §4) is a first-class visual element, not an afterthought tag |

### Visual characteristics
- **Color**: one confident primary hue (blue, §3) for primary actions, navigation, links and focus, paired with
  a secondary teal for learning-related highlights and secondary actions; the rest of the interface is neutral.
  Color communicates function (this is clickable, this is a warning), not decoration.
- **Type**: a single, highly legible sans-serif (Wix Madefor Text) carries the whole product; hierarchy comes
  from size/weight, not from mixing typefaces.
- **Shape**: consistent, moderate corner radius (§8) — soft enough to feel approachable, sharp enough to feel
  professional. No pill-everything, no sharp-everything.
- **Density**: comfortable, not cramped and not sparse. Dashboards in particular must stay legible at a glance
  (§13, §19) rather than becoming data walls.
- **Motion**: present but quiet — motion confirms an action happened, it doesn't perform for the user (§21).

### What LearnOrbit should NOT look like
- **Not YouTube**: no red accent, no black/white-only chrome mimicking YouTube's player and channel layout
  conventions.
- **Not TikTok**: Shorts (§16) must feel like an educational format that happens to be vertical-video, not a
  reskin of TikTok's UI (its specific icon placement, comment-drawer styling, sound-attribution treatment).
- **Not a childish school app**: no primary-color-block illustrations, no mascot characters, no rounded
  "kids-app" typography, no gamification dominating the visual hierarchy (badges/streaks are supportive
  elements — see §19 Exam UI — not the main event).
- **Not gradient/glassmorphism-heavy**: no frosted-glass panels, no multi-stop gradients as backgrounds, no
  neumorphism. Flat surfaces with a restrained elevation system (§9) throughout.
- **Not animation-heavy**: no parallax scrolling, no auto-playing decorative motion, no bouncing/springing UI
  chrome. See §21.
- **Not a cluttered admin dashboard**: creator/admin surfaces (§10 Creator Experience territory) get the same
  restraint as public-facing pages — grouped, prioritized information, not every metric on screen at once.

---

## 3. Color System — **Final, Approved**

Colors are defined as HSL triplets on CSS custom properties (matching the existing `--background: 0 0% 100%;`
style already in `styles/globals.css`), consumed through `hsl(var(--token))`. This section **extends** the
existing shadcn scaffold with LearnOrbit's approved brand hues — it does not rename or restructure any existing
token, so adopting it is additive to `styles/globals.css`, not a rewrite. Tokens marked **[NEW]** don't exist in
the file yet; every other token name already exists and only its value changes.

**Approved conceptual hierarchy** (2026-08 brand decision, final):
- **Blue** — primary LearnOrbit identity: primary actions, navigation, links, focus.
- **Teal** — secondary learning/product accent: learning-related highlights, secondary actions. Maps onto the
  existing `--accent` token slot (already consumed by every `outline`/`ghost` button's `hover:bg-accent`, §11)
  rather than adding a new token — teal now *is* what "secondary action" looks like.
- **Amber** — achievements, streaks, scores, and warnings (a single token, `--warning`, deliberately serves both
  roles per the approved palette — never used for primary or secondary actions).
- **Green** — success/correct states.
- **Red** — errors/destructive states.
- **Info (cyan)** — informational messaging only. Deliberately a distinct cyan hue, not a lighter/darker step of
  primary blue, so an informational notice never gets mistaken for a primary action or vice versa.

### Semantic tokens — light mode

| Token | Hex (source) | Value (HSL) | Usage |
|---|---|---|---|
| `--background` | `#FFFFFF` | `0 0% 100%` | Page background |
| `--foreground` | `#0F172A` | `222.2 47.4% 11.2%` | Default text color |
| `--card` (= Surface) | `#F8FAFC` | `210 40% 98%` | Card/panel surface — a subtle step off pure white; card definition leans on `--border` as well as fill |
| `--card-foreground` | `#0F172A` | `222.2 47.4% 11.2%` | Text on surfaces |
| `--surface-elevated` **[NEW]** | `#FFFFFF` | `0 0% 100%` | Modals, dropdowns, popovers — pure white, brighter than `--card`, always paired with `--shadow-md`/`lg` (§9) so it visibly "pops" above the surface/muted layers beneath it |
| `--popover` | `#FFFFFF` | `0 0% 100%` | Popovers/menus (maps to Surface elevated) |
| `--primary` | `#2563EB` | `221.2 83.2% 53.3%` | LearnOrbit blue — primary actions, navigation, links, focus |
| `--primary-hover` **[NEW]** | `#1D4ED8` | `224.3 76.3% 48%` | Hover state for primary-filled elements |
| `--primary-active` **[NEW]** | `#1E40AF` | `225.9 70.7% 40.2%` | Pressed/active state for primary-filled elements |
| `--primary-foreground` | `#FFFFFF` | `0 0% 100%` | Text/icons on primary fill |
| `--secondary` | `#F1F5F9` | `210 40% 96.1%` | Low-emphasis fills (secondary buttons, chips) — now aligned to the Muted tier, one step quieter than Surface |
| `--secondary-foreground` | `#0F172A` | `222.2 47.4% 11.2%` | Text on secondary fill |
| `--accent` (= Teal, secondary brand) | `#0F766E` | `175.3 77.4% 26.1%` | Learning-related highlights, secondary actions (drives existing `outline`/`ghost` button hover, §11). Never used for primary actions |
| `--accent-foreground` | `#FFFFFF` | `0 0% 100%` | Text on accent (teal) fill |
| `--accent-tint` **[NEW]** | `#CCFBF1` | `167.2 85.5% 89.2%` | Light teal fill for badges/highlight chips where full-strength teal would be too heavy; pair with `--accent` as the text color on top of it |
| `--muted` | `#F1F5F9` | `210 40% 96.1%` | Muted backgrounds (disabled fills, subtle section backgrounds) |
| `--muted-foreground` | `#64748B` | `215.4 16.3% 46.9%` | Secondary/caption text |
| `--border` | `#E2E8F0` | `214.3 31.8% 91.4%` | Default borders/dividers |
| `--input` | `#E2E8F0` | `214.3 31.8% 91.4%` | Form control borders |
| `--ring` | `#2563EB` | `221.2 83.2% 53.3%` | Focus ring (= primary blue) |
| `--destructive` (= Error) | `#DC2626` | `0 72.2% 50.6%` | Errors, destructive actions |
| `--destructive-foreground` | `#FFFFFF` | `0 0% 100%` | Text on error fill |
| `--success` **[NEW]** | `#16A34A` | `142.1 76.2% 36.3%` | Success states, correct-answer indicators |
| `--warning` **[NEW]** (= Achievement) | `#F59E0B` | `37.7 92.1% 50.2%` | Warnings/caution **and** achievements, streaks, scores, special highlights (one token, per the approved palette) |
| `--info` **[NEW]** | `#0891B2` | `191.6 91.4% 36.5%` | Informational messaging only — distinct cyan, no longer hue-adjacent to primary blue |

### Semantic tokens — dark mode (`.dark`) — **approved**

| Token | Hex (source) | Value (HSL) | Usage |
|---|---|---|---|
| `--background` | `#020617` | `222.2 84% 4.9%` | Page background (slate-950) |
| `--foreground` | `#F1F5F9` | `210 40% 96.1%` | Default text color |
| `--card` (= Surface) | `#0F172A` | `222.2 47.4% 11.2%` | Card/panel surface (slate-900) |
| `--card-foreground` | `#F1F5F9` | `210 40% 96.1%` | Text on surfaces |
| `--muted` | `#1E293B` | `217.2 32.6% 17.5%` | Muted backgrounds (slate-800) |
| `--muted-foreground` | *(derived)* | `215 20.2% 65.1%` | Secondary/caption text (slate-400) — no explicit hex given, carried from prior derivation |
| `--secondary` | `#1E293B` | `217.2 32.6% 17.5%` | Low-emphasis fills — aligned to Muted, matching the light-mode mapping |
| `--surface-elevated` **[NEW]** | `#334155` | `215.3 25% 26.7%` | Modals, dropdowns, popovers (slate-700) — one step lighter than Muted, consistent with the light-mode hierarchy of Background < Card < Muted < Surface-elevated |
| `--popover` | `#334155` | `215.3 25% 26.7%` | Popovers/menus (= Surface elevated) |
| `--border` / `--input` | *(derived)* | `217.2 32.6% 17.5%` | Aligned to Muted (slate-800) — no explicit hex given, carried from prior derivation |
| `--primary` | `#3B82F6` | `217.2 91.2% 59.8%` | LearnOrbit blue (blue-500) |
| `--primary-hover` **[NEW]** | *(derived)* | `213.1 93.9% 67.8%` | blue-400 — brighter on hover (inverted from light mode), not explicitly specified |
| `--primary-active` **[NEW]** | *(derived)* | `211.7 96.4% 78.4%` | blue-300 — not explicitly specified |
| `--primary-foreground` | | `222.2 47.4% 11.2%` | Text/icons on primary fill (slate-900) |
| `--accent` (Teal) | `#2DD4BF` | `172.5 66% 50.4%` | Learning-related highlights, secondary actions (teal-400) |
| `--accent-foreground` | | `222.2 47.4% 11.2%` | Text on accent fill (slate-900 reads better on brightened dark-mode teal) |
| `--accent-tint` **[NEW]** | *(derived)* | `175.9 60.8% 17.8%` | teal-900 dark tinted fill — not explicitly specified |
| `--ring` | | `217.2 91.2% 59.8%` | Focus ring (= primary) |
| `--destructive` (Error) | `#EF4444` | `0 84.2% 60.2%` | Errors, destructive actions |
| `--success` **[NEW]** | `#22C55E` | `142.1 70.6% 45.3%` | Success states |
| `--warning` **[NEW]** (Achievement) | `#FBBF24` | `43.3 96.4% 56.3%` | Warnings and achievements/streaks/scores |
| `--info` **[NEW]** | `#22D3EE` | `187.9 85.7% 53.3%` | Informational messaging only (cyan-400) |

Elevation hierarchy in dark mode now reads: `--background` (darkest) → `--card` → `--muted` → `--surface-elevated`
(lightest), a direct parallel to the light-mode Background → Surface → Muted → Surface-elevated progression.

### Documented color roles (final)
| Color | Role |
|---|---|
| **Blue** | Primary LearnOrbit identity |
| **Teal** | Secondary learning/product accent |
| **Amber** | Achievements, streaks, scores, and warnings |
| **Green** | Success/correct |
| **Red** | Errors/destructive |
| **Info (cyan)** | Informational messaging only |

### Why blue + teal
- **Blue** is the approved primary brand hue: the strongest cross-cultural association with "trust, technology,
  focus" for an edtech product, distinct from YouTube's red and TikTok's black/cyan/pink, and it now directly
  drives navigation, links, and focus rings — the highest-frequency UI touchpoints — for maximum brand
  consistency.
- **Teal** is the secondary/educational accent: it reuses the existing `--accent` token slot (no new plumbing
  needed), so every `outline`/`ghost` button and any existing `hover:bg-accent` usage automatically becomes
  "the secondary/teal action color" — a clean mapping from the approved hierarchy onto infrastructure that
  already exists.
- **Amber stays narrow**: it exclusively means achievement/streak/score/warning, never a general "accent."
- **Info is now a true fifth hue (cyan)**, not a lighter step of primary blue — resolves the earlier open
  question about `--info` being hue-adjacent to `--primary`.
- Chart colors (`--chart-1..5`) and z-index scale remain untouched — reused as-is for any future
  data-visualization needs (e.g., exam performance charts, §19).

### Light/dark strategy
- Respect system preference by default (`prefers-color-scheme`), matching the existing `.dark` class convention
  already wired via `@custom-variant dark (&:is(.dark *))` in `styles/globals.css`.
- Every component must be built against the semantic token, never a raw color value — this is what makes dark
  mode "free" for every future screen. **Never hardcode a hex/HSL value in a component; always reference a
  token** (§24).
- Contrast requirement: every foreground/background pairing above meets WCAG AA (4.5:1 for text, 3:1 for large
  text/UI components) in both modes — verify any new token addition against this bar before adding it.
- **Exception — `--success` and `--warning` are fill/icon tokens, not text tokens.** The Phase 9C
  accessibility review measured them on `--background` in light mode and found `--success` at **3.31:1** and
  `--warning` at **2.16:1** — both below the 4.5:1 text floor (`--warning` is below the 3:1 UI floor too). They
  remain correct for fills, borders and icons, which only need 3:1. For **text** in those states use the
  companion tokens added in 9C:

  | Token | Light | Contrast on `--background` | Use for |
  |---|---|---|---|
  | `--success-strong` | `142.4 71.8% 29.2%` | 5.02:1 | success **text** (badges, labels) |
  | `--warning-strong` | `26 90.5% 37.1%` | 5.05:1 | warning **text** (badges, exam timer) |

  In dark mode the relationship inverts — the base tokens are already the readable ones — so the `-strong`
  variants are defined lighter there. No dark theme ships in V1; the pair is kept coherent for when one does.
  Consumed as `text-success-strong` / `text-warning-strong`. Enforced by `apps/web/tests/a11y-guard.test.mjs`.

---

## 4. Typography

### Font families (existing infrastructure, reused as-is)
- **Primary**: Wix Madefor Text, via `var(--font-default)` — every non-Arabic screen, all weights.
- **RTL/Arabic**: Tajawal, via `var(--font-arabic)` — force-applied for `:lang(ar)`/`:lang(fa)`/`[dir="rtl"]`,
  already wired in `layout.tsx` and `globals.css`. Do not introduce a second Latin font "for variety" — one
  typeface is a deliberate simplicity choice (§1).
- **Monospace**: none introduced. If a future screen needs tabular/code-like alignment (e.g., an exam timer,
  §19), use `font-variant-numeric: tabular-nums` on the primary font rather than switching families.

### Type scale
| Role | Size / line-height | Weight | Tracking | Usage |
|---|---|---|---|---|
| Display | `2.5rem` / `1.15` (mobile: `2rem`/`1.2`) | 700 | `-0.02em` | Landing/marketing hero only |
| H1 | `2rem` / `1.2` (mobile: `1.5rem`/`1.25`) | 700 | `-0.02em` | Page title (one per page) |
| H2 | `1.5rem` / `1.3` (mobile: `1.25rem`/`1.3`) | 700 | `-0.02em` | Section heading |
| H3 | `1.25rem` / `1.4` | 600 | `-0.01em` | Subsection / card group heading |
| H4 | `1.0625rem` / `1.4` | 600 | `-0.01em` | Card title, dialog title |
| Body | `1rem` / `1.6` | 400 | `-0.02em` (existing global `letter-spacing`) | Default paragraph/UI text |
| Body emphasis | `1rem` / `1.6` | 500 | `-0.02em` | Emphasized inline text, form labels |
| Small | `0.875rem` / `1.5` | 400 | `-0.01em` | Secondary text, metadata rows |
| Caption | `0.75rem` / `1.4` | 400 | `0` | Timestamps, helper text, legal-style microcopy |

RTL note: the existing global override resets `letter-spacing: normal` for `[dir='rtl']`/`:lang(ar)` — this
scale's negative tracking values apply to Latin/Wix Madefor Text only, exactly as already implemented.

### Weight usage
Wix Madefor Text ships 200–900 with **no 600** (per the existing code comment in `layout.tsx`) — `font-semibold`
(600) automatically rounds up to 700. Design with only **400 (regular), 500 (medium), 700 (bold)** as the
effective weight palette; never target a visual "600-weight" look, it doesn't exist in this font.

### Rules
- One H1 per page/screen.
- Never skip heading levels for visual effect (don't use H1 styling on a div for "just because it's big" — use
  Display or an explicit utility instead, keep heading tags semantic for §22).
- Body text minimum size is `1rem` (16px) on mobile — never shrink body copy below that for density; use Small
  or Caption roles instead, which are for genuinely secondary content, not a way to fit more body text on
  screen.

---

## 5. Spacing System

4px base unit, scale: **4, 8, 12, 16, 24, 32, 48, 64, 96** (px), expressed via Tailwind's default spacing scale
(`1 = 4px` through `24 = 96px` — no custom spacing tokens needed, the default scale already covers this exactly).

| Token | px | Tailwind | When to use |
|---|---|---|---|
| xs | 4 | `1` | Icon-to-label gap, tight inline spacing |
| sm | 8 | `2` | Compact control internal padding, chip gaps |
| md | 12 | `3` | Default gap between related small elements (form field internal spacing) |
| base | 16 | `4` | Default gap between components, card internal padding on mobile |
| lg | 24 | `6` | Section internal padding, card internal padding on desktop, gap between unrelated components |
| xl | 32 | `8` | Gap between major page sections |
| 2xl | 48 | `12` | Page-top spacing on desktop, hero section padding |
| 3xl | 64 | `16` | Large section separation on desktop (landing/marketing-style pages only) |
| 4xl | 96 | `24` | Rare — top-level page shell breathing room on large desktop viewports only |

Rules:
- Never use an arbitrary spacing value (`p-[13px]`, `mt-[22px]`). If the scale doesn't have what a layout needs,
  that's a signal to reconsider the layout, not to reach for an arbitrary value.
- Related elements use the smaller end of the scale (xs–md); unrelated elements/sections use the larger end
  (lg+). This is the primary tool for establishing visual grouping without adding borders/backgrounds.
- Mobile paddings default one step down from desktop equivalents (e.g., card padding `base` on mobile, `lg` on
  desktop) — see §7.

---

## 6. Layout System

- **Max content width**: `1280px` (`max-w-7xl`) for standard content pages (home feed, channel page, resource
  library). Video watch pages and Shorts use their own full-bleed rules (§15, §16).
- **Page margins**: `16px` mobile, `24px` tablet, `32px`+ desktop (auto-centered beyond max width) — matches the
  spacing scale's base/lg/xl steps.
- **Grid behavior**: CSS Grid for card collections (video grids, resource grids, exam-subject grids), Flexbox
  for one-dimensional layouts (headers, toolbars, form rows). Card grids: 1 column mobile → 2 columns tablet →
  3–4 columns desktop, driven by container width via `auto-fill`/`minmax()` where content count is variable,
  fixed column counts where it's a curated section.
- **Sidebar behavior**: persistent left sidebar on desktop (≥ `lg`, primary nav, §14), collapses to a bottom tab
  bar + slide-over drawer on mobile/tablet. The sidebar never overlays content on desktop; it always reflows it.
- **Content columns**: single-column reading layout for long-form content surfaces (resource detail, article-
  style content) capped at `~72ch` for body text readability, independent of the page's outer max width.
- **Vertical rhythm**: sections within a page are separated using the xl/2xl spacing steps consistently — a page
  should never visibly mix a 48px gap and a 64px gap between structurally equivalent sections.

---

## 7. Responsive Design

Breakpoints (Tailwind v4 defaults, unmodified):

| Name | Min width | Role |
|---|---|---|
| (base) | 0 | Mobile |
| `sm` | 640px | Large mobile / small tablet |
| `md` | 768px | Tablet |
| `lg` | 1024px | Small desktop / desktop nav breakpoint |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

Mobile-first means every component's *base* (unprefixed) styles are the mobile styles; breakpoint prefixes only
add/override for larger viewports — never the reverse.

- **Navigation**: bottom tab bar (mobile/tablet, < `lg`) ↔ persistent left sidebar (≥ `lg`). Search moves from a
  full-screen overlay (mobile) to an inline header field (desktop). See §14.
- **Card behavior**: full-width single column (mobile) → 2-up (`sm`/`md`) → 3–4-up grid (`lg`+). Card internal
  padding steps from `base` (16px) to `lg` (24px) at `md`.
- **Typography scaling**: H1/H2/Display step down one size at mobile per the scale in §4 — never a fluid/`clamp()`-only
  scale, use the discrete steps so text metrics stay predictable and testable.
- **Video behavior**: player is full-width edge-to-edge on mobile (16:9 letterboxed, no side margins), inset
  within the content column on desktop with metadata alongside (not below) at `lg`+. See §15.
- **Shorts behavior**: full-viewport vertical player on mobile (the native format). On desktop, Shorts render in
  a centered, fixed-aspect vertical player (never stretched full-bleed on wide viewports) with prev/next
  controls beside it, since edge-to-edge vertical video makes no sense on a wide screen. See §16.
- **Touch targets**: minimum `44×44px` for any interactive element on touch viewports (< `lg`), regardless of
  the element's visual size — pad the hit area even when the icon/label is smaller.
- **Sidebar behavior**: see §6 — reflow, never overlay, on desktop; slide-over drawer with a scrim on mobile.

### Lower-bandwidth considerations
Treat "works acceptably on a throttled 3G/4G connection" as a first-class constraint, not an edge case, given
the target audience — see §23 for the concrete performance rules this implies.

---

## 8. Border Radius

Base `--radius: 0.5rem` (8px, existing token, unchanged) with derived steps already defined in `@theme`:
`--radius-lg = var(--radius)`, `--radius-md = var(--radius) - 2px`, `--radius-sm = var(--radius) - 4px`.

| Element | Token | Value |
|---|---|---|
| Small controls (checkbox, switch track, chip) | `--radius-sm` | 4px |
| Inputs, buttons | `--radius-md` | 6px |
| Cards, dropdowns, popovers | `--radius-lg` | 8px |
| Modals/dialogs | `--radius-lg` | 8px |
| Large surfaces (page-level panels, hero sections) | `--radius-lg` | 8px — do not scale radius up with element size |
| Avatars | full (`rounded-full`) | — always circular, never a rounded-square avatar |
| Video thumbnails | `--radius-md` | 6px |

Rule: radius does not scale with component size beyond the three steps above — a full-width hero card uses the
same `--radius-lg` as a small card, not a larger custom radius.

---

## 9. Shadows & Elevation

Reuses the existing `.nice-shadow` / `.light-shadow` utility pattern (shadow + subtle outline, not a heavy drop
shadow) and the existing z-index scale (`--z-*`, already defined in `globals.css`) rather than introducing a
parallel system.

| Level | Use | Style basis |
|---|---|---|
| 0 — Flat | Default card/page surface, no elevation | none |
| 1 — Raised | Hovered card, resting popover trigger | `.light-shadow` equivalent (`shadow-lg shadow-gray-300/15` + 1px outline) |
| 2 — Overlay | Dropdown menu, tooltip, hover-card | `.nice-shadow` equivalent (`shadow-md shadow-gray-300/25` + 1px outline) |
| 3 — Modal | Dialog, drawer | `.nice-shadow` + backdrop scrim, uses `--z-modal`/`--z-modal-content` |
| 4 — Toast/notification | Toast, critical alert | strongest shadow tier, uses `--z-toast`/`--z-notification` |

Rules:
- Maximum 5 elevation levels, total — do not invent a per-component custom shadow.
- Elevation increases only on interaction (hover/open), never as static decoration on a resting element.
- Dark mode: shadows alone are nearly invisible on dark surfaces — elevation in dark mode is communicated
  primarily through the `--surface-elevated` fill step (§3), with shadow as a secondary cue, not the only one.

---

## 10. Iconography

- **Library**: `lucide-react` exclusively (already the project's configured icon library — `components.json`
  `"iconLibrary": "lucide"`). Do not add a second icon library for "one icon we couldn't find" — Lucide's set is
  large enough that this should not come up; if it genuinely does, raise it rather than mixing libraries.
- **Style**: outline/stroke icons only (Lucide's default style), `strokeWidth={2}` as the default — never mix in
  filled/solid icon variants alongside outline ones in the same view.
- **Default size**: `16px` (`size-4`, matches the existing button component's `[&_svg]:size-4` rule) inline with
  body/small text.
- **Button icon sizes**: `16px` inside default/sm buttons, `20px` (`size-5`) inside `lg` buttons — matches
  existing `Button` size variants in `components/ui/button.tsx`.
- **Navigation icon sizes**: `20–24px` (`size-5`/`size-6`) in sidebar/tab-bar nav items — one size larger than
  inline icons, since nav icons often stand alone without an adjacent label (mobile tab bar).
- **Accessibility**: every icon-only interactive element (icon button, nav item collapsed to icon-only) must
  have an accessible name via `aria-label` or equivalent — never ship an icon-only control with no text
  alternative. Decorative icons paired with visible text get `aria-hidden="true"` so screen readers aren't shown
  the icon and the label redundantly.

---

## 11. Buttons

Reuses the existing `components/ui/button.tsx` variant/size API as-is — this section documents it as the
standard, it does not propose new variant names.

Variants: **default** (primary-filled), **secondary**, **outline**, **ghost**, **destructive**, **link**.
Icon-only buttons use any variant + `size="icon"` (a square hit area, not a new variant).

Sizes: **default** (h-9), **sm** (h-8), **lg** (h-10), **icon** (h-9 w-9, square).

| State | Default (primary) | Secondary/Outline/Ghost | Destructive |
|---|---|---|---|
| Default | `--primary` fill, `--primary-foreground` text | `--secondary` fill / transparent+border / transparent | `--destructive` fill |
| Hover | `--primary-hover` | `--accent` fill (per existing `hover:bg-accent`) | `--destructive` at 90% opacity |
| Active/pressed | `--primary-active` | `--accent` at higher emphasis | `--destructive` darker step |
| Focus | 2px `--ring` focus ring, 2px offset (existing `focus-visible:ring-2 ring-offset-2`) | same | same |
| Disabled | 50% opacity, `pointer-events: none` (existing `disabled:opacity-50 disabled:pointer-events-none`) | same | same |
| Loading | disabled state + inline spinner (Lucide `Loader2`, `animate-spin`) replacing or preceding the label; button retains its width to avoid layout shift | same | same |

Rules:
- One `default`-variant (primary) button per view for the single primary action; every other action uses
  `secondary`/`outline`/`ghost`.
- `destructive` variant only for irreversible or high-consequence actions (delete, reject application, remove
  member) — never for a merely negative-toned but reversible action (e.g., "unfollow" is a plain
  `outline`/`ghost` button, not destructive).

---

## 12. Forms

All form primitives already exist (`input`, `textarea`, `select`, `checkbox`, `switch`, `label` in
`components/ui/`) — this section defines the shared behavioral contract across them, not new components.

- **Input / Textarea**: `--input` border, `--radius-md`, `--background` fill; focus gets a 2px `--ring` ring
  (matches Button's focus treatment for consistency across all interactive controls).
- **Select**: same visual contract as Input; open state uses the Overlay elevation tier (§9).
- **Checkbox / Radio**: `--radius-sm`, `--primary` fill when checked, `--ring` focus outline.
- **Switch**: `--primary` fill when on, `--muted` track when off.
- **Validation**: inline, per-field, shown on blur or submit (not on every keystroke — that reads as hostile on
  slower connections/devices). Error text uses `--destructive`, success/valid state (where meaningful, e.g. a
  slug-availability check) uses `--success`.
- **Error states**: field border switches to `--destructive`, an icon (Lucide `AlertCircle`) + message appears
  directly below the field in `--destructive` text, Caption size. The error message is programmatically
  associated with the field (`aria-describedby`) — not just visually adjacent (§22).
- **Help text**: `--muted-foreground`, Caption size, appears below the field when present and is replaced (not
  stacked) by an error message if one appears.
- **Focus behavior**: focus order follows visual/DOM order; every focusable control has a visible focus ring —
  never `outline: none` without a replacement (§22).

---

## 13. Cards

One shared card shell (surface = `--card`, `--radius-lg`, elevation level 0 at rest → level 1 on hover) with
content-specific internals:

- **Video card**: thumbnail (16:9, `--radius-md`) → duration badge (bottom-right, on the thumbnail) → title
  (H4, max 2 lines, truncated) → creator/channel name + avatar (small) → metadata row (views · relative date, Small/Caption size). Hover: elevation step up, no thumbnail zoom/crop-shift (that reads as a YouTube-specific
  affordance — see §2).
- **Channel card**: avatar (circular, §8) + name + channel-type indicator (§17) → follower count (Caption) →
  Follow button (`outline` variant by default, filled `default` variant if not yet following, to keep the
  primary action visually obvious) → short description (1–2 lines, truncated).
- **Resource card**: file-type icon/badge (PDF, past paper, etc.) → title → metadata (subject · level ·
  institution, per `docs/PRD.md` §4) as small chips → view/download action.
- **Exam card**: title → subject/level chips → question count + estimated time (Caption) → progress indicator
  if previously attempted (§19) → primary action ("Start"/"Resume"/"Review").
- **Subject card**: icon or short label (no illustration) → subject name → sub-count (e.g., "12 topics · 340
  resources") — a navigational card, kept visually lighter/flatter than content cards since it's a category
  entry point, not content itself.

All card variants share: consistent internal padding (§5 — `base` mobile / `lg` desktop), consistent title
truncation rules, and consistent hover elevation. None use a colored/gradient background — differentiation
between card types comes from their icon/badge and metadata, not from card background color.

---

## 14. Navigation

- **Desktop sidebar** (≥ `lg`): persistent, left-aligned, icon + label nav items (§10 sizing), current route
  indicated by `--primary`-tinted background + `--primary` icon/text (not just a bold weight change — needs a
  non-text-only cue for §22). Collapsible to icon-only on request, not by default.
- **Mobile navigation** (< `lg`): bottom tab bar, 4–5 top-level destinations max, icon + short label, current
  route indicated the same way as desktop (color, not just position). Anything beyond the top-level
  destinations lives behind a "More"/profile entry, not a hamburger drawer duplicating the tab bar.
- **Header**: persistent across breakpoints — logo/wordmark (left), search (center/expandable, see below),
  user menu (right). On mobile, search collapses to an icon that expands to a full-screen search overlay rather
  than permanently occupying header width.
- **Search**: single global search entry point (per `docs/PRD.md` §3 item 15) — not a per-section search. Results
  are grouped by type (channels, videos, resources, exams) rather than a flat undifferentiated list.
- **User menu**: avatar-triggered dropdown (Overlay elevation, §9) — profile, settings, sign out. Role-specific
  entries (e.g., "Creator dashboard" / "Admin") only appear for users who actually have that role — never shown
  disabled/grayed-out as a teaser.
- **Active states**: every nav surface uses the same active-state language (color + icon fill/weight shift) so
  "where am I" is answered identically whether the user is on mobile tabs or desktop sidebar.

---

## 15. Video UI

- **Video card**: see §13.
- **Player container**: 16:9 aspect ratio maintained via CSS aspect-ratio (`@radix-ui/react-aspect-ratio` is
  already a dependency — reuse it), full-bleed edge-to-edge on mobile, inset with rounded corners
  (`--radius-lg`) on desktop.
- **Metadata**: title (H2/H3) directly below the player, then creator/channel row (avatar, name, follow button
  inline), then engagement row (like/save/share — secondary in visual weight per §1 principle 2), then
  description (collapsible after ~3 lines), then academic metadata chips (subject/topic/level, per
  `docs/PRD.md` §4) — placed *with* the video's identity, not buried in a separate tab.
- **Creator information**: avatar + name + channel-type indicator (§17), consistent with how it appears on
  Channel cards/pages — never a visually distinct "mini" treatment that looks like a different component.
- **Progress**: a thin `--primary`-filled bar under the player scrubber reflecting watch progress on return
  visits (supports `docs/PRD.md` §6 "basic learning/progress information") — Caption-weight, not a prominent
  element.
- **Controls**: standard play/pause, scrub, volume, playback speed, fullscreen, captions toggle. Custom-styled
  to match the token system (dark scrim + `--primary` accents on the progress fill) rather than the browser's
  unstyled native controls, but no invented control paradigm.
- **Loading**: skeleton player (dark neutral block matching player aspect ratio) + skeleton lines for
  title/metadata — never a blank white flash (§23).
- **Error**: inline error state inside the player container (icon + short message + retry action) — never a
  full-page error for a single video failing to load.
- **Captions**: WCAG-required for any video with dialogue (§22) — captions toggle always present in controls
  when a caption track exists; captions render in a legible, semi-opaque background band, not raw
  transparent-background text.
- **Mobile behavior**: tap-to-play controls overlay (auto-hide after a few seconds of playback), full-width
  player, metadata stacks below in a single column.

---

## 16. Shorts UI

- **Vertical video presentation**: 9:16, full-viewport on mobile (native format), one Short filling the screen
  at a time — swipe/scroll to advance, matching the format's established interaction language, but with
  LearnOrbit's own control styling (§2 — not a TikTok chrome reskin).
- **Interaction controls**: right-side vertical rail (like, comment, save, share) — icon + count, Caption size,
  `--foreground`-on-scrim styling so it's legible over any video content. Creator attribution and title/subject
  metadata anchor the bottom-left, above the safe area.
- **Metadata**: creator name/avatar + channel-type indicator (§17), short title/caption (1–2 lines), academic
  metadata chip (subject/topic) — kept minimal, since the format is inherently space-constrained, but the
  subject/topic chip is non-negotiable (it's what makes this "educational Shorts" rather than generic Shorts,
  per `docs/PRD.md`).
- **Mobile behavior**: full-viewport player as above; system back gesture/button exits to the previous
  discovery context (feed, channel page) rather than always returning to a Shorts home.
- **Desktop behavior**: centered fixed-aspect (9:16) vertical player — never stretched full-bleed on a wide
  viewport (§7) — with prev/next controls (up/down arrows or on-screen buttons) beside the player, and the same
  interaction rail alongside it rather than overlaid, since there's room on desktop to give it its own space.

---

## 17. Channel UI

Builds directly on the already-shipped `components/Objects/Channel/ChannelHeader.tsx` (Phase 1B/1C, per
`docs/PROGRESS.md`) — this section documents its visual contract, it does not propose replacing it.

- **Banner**: full-width, `--muted` fallback background when no custom banner image is set (never a broken-image
  state).
- **Avatar**: circular (§8), overlapping the bottom edge of the banner on desktop, stacked above name on mobile.
- **Channel name**: H2, paired inline with the channel-type indicator.
- **Description**: Body text, collapsible after ~3 lines, below name.
- **Follower count**: Small text, sourced from the existing `useOrgFollowStatus` hook — always shown (public,
  per the existing anonymous-GET support in `services/orgs/follows.py`), even to logged-out viewers.
- **Follow button**: `default` (filled) variant + `UserPlus` icon when not following; switches to `outline`
  variant + `Check` icon and "Following" label when following — the state change itself (fill → outline) is the
  primary signal, not just the label text, so it reads correctly even at a glance.
- **Tabs**: Videos / Shorts / Resources / About — only the tabs relevant to content the channel actually has
  populated are shown as primary; empty categories don't get a dead tab (§19 empty states apply here, but
  prefer omitting the tab entirely over showing a permanently-empty one).
- **Verified state**: rendered only from the actual `channel_type` field (`SCHOOL` | `INSTRUCTOR`) — never an
  invented "verified" checkmark without a real backend signal (§1 principle 4, `docs/ARCHITECTURE.md` Phase 1A).
- **School vs. instructor presentation**: a small `Badge` (existing `components/ui/badge.tsx`) next to the
  channel name — "School" uses `--info` tint, "Creator"/"Instructor" uses `--secondary` (neutral) tint. Both
  read as informational category labels, not as a trust hierarchy where one type looks "more official" than the
  other — Kenyan institutions and individual teachers are equally legitimate content sources in this product.

---

## 18. Resource UI

- **PDF/resource cards**: see §13 Resource card.
- **Resource metadata**: subject, topic, level, institution/curriculum context, resource type (past paper,
  notes, etc.) — rendered as small `Badge`/chip components, filterable (below).
- **Download/view controls**: primary action is contextual — "View" opens an in-app viewer for previewable
  types (PDF), "Download" for types that aren't inline-viewable; never force a download when an inline preview
  is possible, since that's a worse experience on constrained mobile data.
- **Resource filters**: a filter bar (subject/level/institution/type as dropdown or chip-toggle filters) above
  the resource grid — filters use the same `Select`/`Badge` primitives as elsewhere, not a custom filter widget.
- **Loading/error states**: skeleton cards matching the resource card shell while loading; inline error card
  ("couldn't load this resource" + retry) in place of a broken card, never a silently missing card.

---

## 19. Exam UI

- **Exam cards**: see §13.
- **Question cards**: single question per card/screen on mobile (one at a time, reduces cognitive load and
  matches small-screen space); question stem (Body, emphasized) + answer options below.
- **Answer states**: unselected (`--border` outline) → selected (`--primary` outline + tinted `--primary/10`
  background) → (post-submit, if shown) correct (`--success` outline + tint) / incorrect (`--destructive`
  outline + tint) / correct-but-unselected (subtle `--success` outline only, no fill, to show the right answer
  without over-emphasizing the user's miss).
- **Progress**: a persistent slim progress bar or "Question 4 of 20" indicator (Caption/Small) at the top —
  always visible during an attempt, never require scrolling up to check progress.
- **Timer**: when timed, a fixed-position, unobtrusive numeric countdown (tabular numerals, §4) that shifts to
  `--warning` color in the final period and `--destructive` in the last seconds — color-coded urgency, not a
  disruptive animation.
- **Results**: score prominently (H1/H2 scale numeral), then a breakdown by topic/subject, then a
  question-by-question review list.
- **Performance visualization**: simple bar/progress-style visualization per topic (reuse the existing
  `--chart-1..5` tokens already defined in `globals.css` for any multi-series need) — avoid introducing a
  charting library if a simple CSS-based bar comparison suffices; only reach for a charting dependency if the
  visualization genuinely requires it (§24).
- **Weak-topic indicators**: topics below a performance threshold get a `--warning`-tinted badge ("Needs
  review") in the results breakdown — supportive/actionable framing, never a `--destructive`-toned "you failed
  this" treatment, consistent with the "encouraging, not patronizing" voice principle (§2).

---

## 20. UI States

Every component with meaningful interactivity or data-dependency must define, and be reviewed against, this
full set — not just the "happy path" default/hover states:

| State | Baseline treatment |
|---|---|
| Default | Resting visual per this document |
| Hover | Subtle elevation/tint shift (pointer devices only — never simulate hover-driven layout on touch) |
| Active | Deeper tint/elevation than hover, confirms the press |
| Focus | Visible `--ring` outline, keyboard-navigable (§22) |
| Disabled | 50% opacity, no pointer events, no focus stop |
| Loading | Skeleton (for content) or inline spinner (for actions) — never a blank/frozen UI with no feedback |
| Empty | A specific, helpful empty state (icon + short message + a primary action where one exists, e.g. "No videos yet — this channel hasn't published" / "No results — try a different filter") — never a bare blank area |
| Error | Icon + plain-language message + retry action where retrying is meaningful; error copy never exposes raw technical error text to end users |
| Success | Brief, unobtrusive confirmation (inline `--success` cue or a toast, §9 elevation level 4) — never a blocking modal for a routine success |

This checklist is also §25's basis for per-feature review — a feature isn't "done" until it's been checked
against this table, not just its default appearance (see §25).

---

## 21. Motion & Animation

### Philosophy
Motion confirms that something happened; it never performs for its own sake. The codebase has already made this
call once — `framer-motion` was removed in favor of plain CSS transitions/keyframes (see the `.animate-fade-in`
comment in `styles/globals.css`) — this document continues that direction rather than reintroducing a JS
animation dependency.

- **Duration**: `150ms` for micro-interactions (hover, focus-ring appearance), `200–300ms` for
  enter/exit transitions (dialogs, dropdowns, page-section fade-ins — matches the existing `0.3s` in
  `.animate-fade-in`), never exceeding `400ms` for any UI transition.
- **Easing**: `ease-out` for entrances, `ease-in` for exits, standard `ease`/`cubic-bezier(0.22, 1, 0.36, 1)`
  (already used for the board-enter animations) for anything that needs a slightly more deliberate feel — no
  bouncy/spring/overshoot easing outside that one existing, deliberate case.
- **Hover transitions**: color/background/shadow transitions only (`transition-colors`, matching the existing
  Button component) — never move, scale, or rotate an element purely on hover.
- **Page transitions**: a simple fade-in on route content mount (reusing `.animate-fade-in`) is sufficient;
  no shared-element/morph transitions between routes.
- **Loading animations**: a single spinner style (Lucide `Loader2` + `animate-spin`) and a single skeleton-pulse
  style, used everywhere loading is shown — not a different loading animation per screen.

### What to avoid
No parallax, no auto-playing decorative animation, no bounce/spring easing outside the one existing board
exception, no bespoke per-component animation — if a screen seems to need a new animation pattern, that's a
signal to extend this section deliberately, not to add a one-off `@keyframes` block inline (§24).

---

## 22. Accessibility

Floor: **WCAG 2.1 AA**.

- **Keyboard navigation**: every interactive element reachable and operable via keyboard alone, in a logical
  (DOM/visual) order; no keyboard traps (especially in dialogs/drawers — focus must be trappable *within* the
  dialog while open, and returned to the trigger on close, but never trapped permanently).
- **Focus states**: always visible (§3, §11, §12 — the `--ring` treatment); never suppressed with
  `outline: none` without an equally visible replacement.
- **Color contrast**: 4.5:1 minimum for body text, 3:1 for large text (≥ 24px or 19px bold) and UI component
  boundaries — verified for every token pairing in §3, and required for any new pairing introduced later.
  Color is never the only signal for state (§14 active nav, §19 answer states, §12 error fields all pair color
  with an icon, weight, or text change).
- **Screen readers**: semantic landmarks (`nav`, `main`, `header`, `footer`), correct heading hierarchy (§4),
  live-region announcements for async state changes that aren't otherwise obvious (e.g., form submission
  result, follow/unfollow toggle).
- **Semantic HTML**: real `<button>`/`<a>` elements for actions/navigation (not clickable `div`s), real form
  elements for form controls — the shadcn primitives already in `components/ui/` are built on Radix, which
  handles this correctly; don't bypass them with custom-styled raw `div`s.
- **Form labels**: every input has a real, associated `<label>` (via the existing `Label` primitive) — never a
  placeholder-only "label."
- **Captions**: required for all video/Shorts content with spoken dialogue (§15, §16).
- **Alt text**: required for every meaningful image (avatars get a name-based alt, banners/thumbnails get a
  content-based alt); purely decorative images get `alt=""`, not omitted `alt`.
- **Touch targets**: 44×44px minimum (§7), regardless of visual icon size.

---

## 23. Performance

UI performance is a design constraint here, not just an engineering concern, given the target audience's
device/connectivity profile (§1, §7).

- **Image optimization**: use Next.js `Image` for every raster image (automatic responsive sizing/format) —
  never a raw `<img>` for content images.
- **Lazy loading**: below-the-fold images, video thumbnails in long grids, and off-screen Shorts in a feed all
  lazy-load; only the current viewport's content loads eagerly.
- **Skeleton loading**: every data-dependent surface shows a skeleton matching its final layout (§20) rather
  than a spinner-only or blank state — reduces perceived load time and avoids layout shift when content arrives.
- **Video loading**: thumbnail-first (never auto-load the full video stream for an off-screen/unplayed card),
  adaptive quality where the underlying video infrastructure supports it (deferred to Phase 2/3 backend work,
  per `docs/ROADMAP.md` — this document specifies the UI contract, not the streaming implementation).
- **Avoid unnecessary JavaScript**: prefer the existing CSS-based interaction/animation approach (§21) over
  JS-driven equivalents; don't add a client-side dependency for something CSS or an already-installed
  primitive (Radix, already in use) can do.
- **Mobile performance**: mobile is the primary target, not a scaled-down afterthought (§1) — performance
  budgets and testing should be mobile-first, not "works on desktop, check mobile after."
- **Lower-bandwidth considerations**: design every data-heavy screen (video grids, Shorts feed) so it's usable
  with images/thumbnails loaded but before video content has buffered — the UI should never feel broken just
  because video hasn't loaded yet, only "still loading" (§20 Loading state).

---

## 24. UI Implementation Rules

Binding rules for any Claude Code session (or developer) building LearnOrbit UI:

1. **Follow this document before creating UI.** If a needed pattern isn't here, extend this document first
   (explicitly, as a reviewable change), then build — don't improvise silently.
2. **Reuse existing components where appropriate.** Check `components/ui/` and `components/Objects/` before
   creating a new component; extend an existing shadcn primitive via its variant API (`cva`) before writing a
   new one from scratch.
3. **Do not introduce new design patterns without updating this document.** A new card type, a new button
   treatment, a new color — all get added here first.
4. **Do not invent random colors, spacing, typography, or component styles.** Every value used must trace back
   to a token in §3–§8. No arbitrary Tailwind values (`text-[15px]`, `#3b5fae`) in component code.
5. **Do not redesign unrelated screens.** A feature addition touches the screens it needs to and nothing else —
   matches the root `CLAUDE.md` rule against unrelated rewrites.
6. **Keep components reusable.** Favor props/variants over copy-pasted near-duplicate components.
7. **Build mobile-first.** Base styles are mobile; breakpoint prefixes only add for larger viewports (§7).
8. **Test responsive behavior.** Verify at minimum: mobile (< `sm`), tablet (`md`), desktop (`lg`+) before
   calling a UI change done.
9. **Test loading/error/empty states.** Not just the default/happy-path state (§20, §25).
10. **Preserve accessibility.** Every rule in §22 applies to every new screen, not just flagship ones.
11. **Prefer existing dependencies.** `lucide-react`, `class-variance-authority`, `clsx`/`tailwind-merge`,
    Radix primitives, `@radix-ui/react-aspect-ratio` — reach for these before adding anything new.
12. **Avoid unnecessary packages.** Matches root `CLAUDE.md`: "Do not install packages unless clearly
    necessary" — a new dependency needs a reason this document's existing toolset can't satisfy.
13. **Do not create one-off styling when an existing design token/component applies.** If a screen "needs" a
    slightly different shade of gray or a slightly different radius, that's almost always a sign to reuse the
    nearest existing token, not to add a new one.

---

## 25. Design Quality Checklist

Before any UI feature is considered complete:

- [ ] Follows this design system (colors, type, spacing, radius, elevation all trace to a token above)
- [ ] Responsive at mobile / tablet / desktop (§7)
- [ ] Accessible (keyboard nav, focus states, contrast, semantics, labels, alt text — §22)
- [ ] Loading state implemented (§20)
- [ ] Empty state implemented (§20)
- [ ] Error state implemented (§20)
- [ ] Typography consistent with §4 (no ad-hoc sizes/weights)
- [ ] Spacing consistent with §5 (no arbitrary values)
- [ ] Colors consistent with §3 (semantic tokens only, no hardcoded values)
- [ ] Components consistent with existing patterns (§11–§19, no unnecessary one-offs)
- [ ] No unnecessary dependencies added (§24 rule 12)
- [ ] Browser-tested (not just type-checked/linted — per root `CLAUDE.md`'s UI verification expectation)
- [ ] Looks and feels like **LearnOrbit** — matches §1/§2's philosophy and brand identity — rather than reading
      as generic unstyled LearnHouse or a generic shadcn starter
