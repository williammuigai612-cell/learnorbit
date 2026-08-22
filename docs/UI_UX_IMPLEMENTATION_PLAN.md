# LearnOrbit — UI/UX Implementation Plan

## Status
Planning document. No application code changes result from this file. It defines the order and scope
of future UI/UX work; each phase still requires its own `PLAN → IMPLEMENT → TEST → REVIEW → COMMIT`
cycle when it is actually started (see root `CLAUDE.md`).

This plan sequences UI/UX work against the existing product roadmap (`docs/ROADMAP.md`) and architecture
decisions (`docs/ARCHITECTURE.md`). It does not redefine product scope — see `docs/PRD.md` for that.

Visual identity (color, typography, spacing, component styling) is governed by `docs/DESIGN_SYSTEM.md`,
including its approved color token system (§3: Blue primary, Teal secondary accent, Amber for
achievements/streaks/scores/warnings, Green for success, Red for errors, Info cyan for informational
messaging). Every phase below implements against those tokens rather than defining or choosing color
values itself.

---

## 1. UI/UX Objectives

- Give LearnOrbit a coherent, distinct visual identity built on top of LearnHouse's existing component
  system, rather than a wholesale redesign.
- Make academic content (videos, Shorts, channels, resources, quizzes) easy to discover, browse, and
  consume with minimal friction, on both desktop and mobile.
- Keep the interface honest: verified/institutional information (e.g., a `SCHOOL` channel type) must be
  visually distinguishable from unverified/user-submitted information wherever both exist.
- Per `docs/PRD.md` §7, the UI must keep learning content in front, with social affordances (likes,
  comments, follows) secondary and supportive.
- Every phase should ship a usable, testable increment — no phase should leave the app in a broken or
  half-wired visual state.

## 2. Core UX Principles

1. **Learning first.** Academic content (videos, resources, quizzes) is the primary object on every
   screen; social chrome (like counts, follow buttons, comment threads) supports it and never crowds it
   out (PRD §7).
2. **Reuse before redesign.** Extend existing LearnHouse UI components, layout primitives, and design
   tokens before introducing new ones. A new component is justified only when nothing existing fits.
3. **Progressive complexity.** Each UI phase should be independently shippable and testable; later
   phases build on earlier ones without requiring them to be redone.
4. **Consistent states everywhere.** Every screen accounts for loading, empty, error, and populated
   states — not just the happy path.
5. **Mobile-aware from the start.** Layouts are built responsively as they're created; a dedicated
   mobile-polish phase (UI-12) exists to refine, not to retrofit from a desktop-only baseline.
6. **Accessible by default.** Semantic structure, keyboard access, and contrast are considered during
   implementation, not bolted on afterward in UI-13.
7. **No speculative UI.** Don't build screens or states for features not yet in `docs/ROADMAP.md`.

## 3. UI Implementation Order

Phases are ordered so each one has what it needs from the phases before it. The order intentionally
tracks the product roadmap (Channels → Video → Shorts → Social → Resources → Exams → Parents →
polish), with foundational shell/navigation/design work pulled to the front since every later phase
depends on it.

### UI-0 — Design Foundations
**Goal:** Implement the visual language (color, type, spacing, core primitives) already approved in
`docs/DESIGN_SYSTEM.md` into the codebase's actual tokens (`styles/globals.css` CSS variables, shadcn
component primitives) — this phase applies the design system, it does not define it.

**Main screens/components:** None (tokens/primitives only — buttons, inputs, cards, badges, spacing
scale, typography scale).

**Key UX requirements:**
- Extend, don't replace, LearnHouse's existing Tailwind config and component primitives.
- Implement the approved semantic color tokens from `docs/DESIGN_SYSTEM.md` §3, light and dark mode:
  `--primary`/`--primary-hover`/`--primary-active` (Blue), `--accent`/`--accent-tint` (Teal),
  `--warning` (Amber — achievements/streaks/scores and warnings), `--success` (Green), `--destructive`
  (Red), `--info` (cyan), plus `--surface-elevated` and the revised `--muted`/`--secondary` mapping —
  no new color values invented at implementation time.
- Establish a "verified/institutional" visual treatment (badge/label style) for later reuse (channel
  types, resource provenance), using the `--info`/`--secondary` badge tokens as specified in
  `docs/DESIGN_SYSTEM.md` §17.

**Important states:** N/A (foundational, not screen-specific).

**Dependencies:** None. This is the prerequisite for every other phase. `docs/DESIGN_SYSTEM.md` is a
prerequisite input (already approved) rather than an output of this phase.

**Out of scope:** Choosing or revising color/type/spacing values — those are already approved in
`docs/DESIGN_SYSTEM.md`; this phase implements them, it doesn't redecide them. Also out of scope: dark
mode activation (unless already present in LearnHouse), any screen-level implementation.

---

### UI-1 — Global Application Shell
**Goal:** Establish the persistent app frame (header, primary nav, footer/utility areas, layout
container) that every other screen renders inside.

**Main screens/components:** Top-level layout, header/app bar, primary navigation shell, auth
entry points (sign in/sign up affordances), user menu.

**Key UX requirements:**
- Shell must work unauthenticated (public browsing) and authenticated (personalized entry points).
- Consistent container widths/spacing reused by every later phase.
- Clear, minimal wayfinding: user always knows what app/section they're in.

**Important states:** Logged-out shell, logged-in shell, loading shell (auth check pending).

**Dependencies:** UI-0 (tokens/primitives).

**Out of scope:** Feed content, channel content, search results — this phase is frame only.

---

### UI-2 — Navigation & Discovery
**Goal:** Build the navigational and search/browse scaffolding students and teachers use to move
between channels, videos, Shorts, and resources.

**Main screens/components:** Primary/secondary nav items, search entry point and results scaffold,
category/subject browse affordances.

**Key UX requirements:**
- Navigation surfaces only what exists per-phase (e.g., don't surface a Shorts nav item before UI-6
  ships) — nav should grow incrementally alongside the roadmap, not all at once.
- Search must degrade gracefully before full search functionality exists (placeholder/empty states).

**Important states:** No results, loading results, populated results.

**Dependencies:** UI-1 (shell).

**Out of scope:** Actual search ranking/backend logic, algorithmic discovery/recommendations (explicit
PRD non-goal).

---

### UI-3 — Home Experience
**Goal:** Build the logged-in and logged-out home/landing experience students and teachers see first.

**Main screens/components:** Home feed layout, logged-out landing/marketing-lite view, empty-state
home (new user, nothing followed yet).

**Key UX requirements:**
- Logged-out home should clearly explain what LearnOrbit is and prompt sign-up (no gated dead end).
- Logged-in home should prioritize followed channels' content once follows exist (Phase 1 dependency),
  falling back sensibly before that.
- No algorithmic ranking — reverse-chronological or simple curated ordering only (PRD §5 non-goal).

**Important states:** Logged-out, logged-in with no follows, logged-in with content, loading, error.

**Dependencies:** UI-1, UI-2. Functionally depends on Channels (roadmap Phase 1) for follow-based
content and Video/Shorts (roadmap Phases 2–3) for populated content — UI can be built against mocked/
empty data ahead of those, but full behavior lands after.

**Out of scope:** Feed ranking algorithms, personalization beyond "things I follow."

---

### UI-4 — Channel Experience
**Goal:** Present teacher, creator, and school/institution channels clearly, distinguishing channel
type and (where applicable) verification status.

**Main screens/components:** Channel profile/header (already partially implemented per
`docs/PROGRESS.md` Phase 1B — `ChannelHeader.tsx`), channel content listing, follow/following control,
channel creation flow refinement.

**Key UX requirements:**
- Channel type (`SCHOOL` vs `INSTRUCTOR`) must be visually distinct (badge/iconography), reusing the
  UI-0 verified/institutional treatment — `--info` (cyan) tint for School, `--secondary` (neutral) tint
  for Instructor/Creator, per `docs/DESIGN_SYSTEM.md` §17 — never implying official verification without
  an authorized source, and never implying one channel type is "more official" than the other.
- Follow/Following control must reflect real state and be usable by anonymous viewers (see follower
  count) and authenticated users (follow/unfollow), consistent with the existing
  `useOrgFollowStatus`/`useFollowOrg`/`useUnfollowOrg` hooks.
- Channel content listing should be ready to display videos/Shorts/resources as those phases land.

**Important states:** Own channel vs. visiting another channel, following vs. not following, empty
channel (no content yet), loading, anonymous viewer.

**Dependencies:** UI-1, UI-2, UI-0. Builds directly on roadmap Phase 1 (Channels) backend work already
completed (channel_type, follows).

**Out of scope:** Channel analytics/insights dashboards beyond "basic engagement information" (PRD §6),
monetization or billing UI (explicitly out of scope per architecture — `/new` SaaS wizard stays
untouched).

---

### UI-5 — Video Experience
**Goal:** Deliver the long-form educational video viewing experience.

**Main screens/components:** Video page (player + metadata + subject/topic tags + channel
attribution), video listing/grid components reused across channel and home surfaces.

**Key UX requirements:**
- Video metadata (subject, topic, level) must be visible and scannable, per PRD §4 content
  organization requirements.
- Player states must be handled explicitly (buffering, error, ended) — don't assume the happy path.
- Attribution to the originating channel must always be visible and link back to it (reinforces UI-4).

**Important states:** Loading/buffering, playback error, unauthenticated viewer, video not found/
removed.

**Dependencies:** UI-1, UI-2, UI-4 (channel attribution). Corresponds to roadmap Phase 2.

**Out of scope:** Video upload/creator publishing UI (belongs to UI-10 Creator Experience), live
streaming (PRD non-goal), monetization overlays.

---

### UI-6 — Shorts Experience
**Goal:** Deliver a vertical, swipeable short-form educational video experience distinct from the
long-form video page.

**Main screens/components:** Shorts viewer (vertical, full-viewport), swipe/next navigation, creator
attribution overlay, engagement affordances entry points (wired fully in UI-7).

**Key UX requirements:**
- Distinct interaction model from UI-5 (swipe-based, not a standard page navigation) — should not
  reuse the long-form video page layout.
- Must work as a focused, single-purpose surface; avoid pulling in unrelated chrome from UI-1's shell
  where it would compete with the vertical viewer.

**Important states:** Loading next Short, end-of-queue (no more Shorts), error/skip-on-failure,
autoplay-blocked (user gesture required) state.

**Dependencies:** UI-1, UI-4 (attribution). Corresponds to roadmap Phase 3.

**Out of scope:** Short creation/upload UI (UI-10), algorithmic "for you" ranking (PRD non-goal) —
ordering should be simple (e.g., chronological/followed-first) until/unless the roadmap changes.

---

### UI-7 — Social Interaction
**Goal:** Layer likes, comments, saves, and sharing onto video, Shorts, and (where applicable) resource
surfaces, without letting them dominate the learning content (Core UX Principle 1).

**Main screens/components:** Like control, comment list + composer, save/bookmark control, share
affordance, basic notification indicator/list.

**Key UX requirements:**
- Comment UI must handle empty, populated, and moderated/removed-comment states.
- Save/bookmark must be reachable from a personal "saved content" surface (may be minimal in V1).
- Notifications are "basic" per PRD §3 — a simple list/indicator, not a full real-time system.

**Important states:** Not authenticated (prompt to sign in rather than silently failing), empty
comments, comment submission in-flight/error, saved vs. not saved.

**Dependencies:** UI-5, UI-6 (surfaces to attach engagement to). Corresponds to roadmap Phase 4.

**Out of scope:** Real-time notification delivery, messaging/chat (PRD non-goal unless required for
core community interaction, which has not been established), comment threading beyond a flat/simple
model unless the roadmap calls for it.

---

### UI-8 — Academic Resources
**Goal:** Present PDFs, past papers, and other academic resources with clear metadata and a safe
viewing/download flow.

**Main screens/components:** Resource listing/browse (with subject/topic/level filtering per PRD §4),
resource detail view, viewer/download flow.

**Key UX requirements:**
- Resource provenance (which channel/institution published it) must be visible, reusing the UI-0
  verified/institutional treatment (`docs/DESIGN_SYSTEM.md` §17 badge tokens) — never imply official
  endorsement without a legitimate source.
- Download/view flow must clearly indicate file type and size before the user commits to opening it.
- Filtering/search must degrade gracefully if a filter combination returns nothing.

**Important states:** No matching resources, loading, restricted/unavailable resource, download
in-progress.

**Dependencies:** UI-1, UI-2, UI-4 (channel/institution attribution). Corresponds to roadmap Phase 5.

**Out of scope:** In-browser PDF annotation/markup, resource versioning UI, private-document access
control UI beyond what's needed to hide non-public documents from public listings (backend
responsibility per root `CLAUDE.md` document-safety rules, referenced here only as a UI constraint).

---

### UI-9 — Exam Preparation
**Goal:** Deliver quiz-taking and exam-practice screens, with results and basic progress feedback.

**Main screens/components:** Quiz/question listing, question-taking flow, results/score screen, basic
progress view.

**Key UX requirements:**
- Question flow must clearly show progress (e.g., "question 3 of 10") and allow safe exit without
  losing obviously-recoverable state.
- Results screen must be encouraging and clear, not just a raw score — appropriate for a learning
  context. Answer/result states use the approved semantic tokens (`docs/DESIGN_SYSTEM.md` §19): `--success`
  (Green) for correct, `--destructive` (Red) for incorrect, `--warning` (Amber) for "needs review"/
  weak-topic indicators — framed supportively, never as a `--destructive`-toned "you failed" treatment.
- Progress view stays "basic" per PRD §3 — no complex analytics dashboards in V1.

**Important states:** In-progress attempt, submitted/scored, abandoned attempt, empty (no quizzes
available for a subject/topic yet).

**Dependencies:** UI-1, UI-2, UI-8 (may share subject/topic filtering patterns). Corresponds to
roadmap Phase 6.

**Out of scope:** Adaptive/ML-driven question selection, timed/proctored exam UI unless explicitly
added to the roadmap, detailed analytics/reporting dashboards.

---

### UI-10 — Creator Experience
**Goal:** Give teachers/creators/schools the screens needed to publish and manage content on their
channel.

**Main screens/components:** Content publishing flows (video, Shorts, resources), channel content
management/listing (creator's own view), basic engagement summary (view/like/comment counts),
question bank authoring and quiz authoring (question picker/attach/reorder) for Phase 6 — added by the
Phase 6A/6D architecture decisions, which postdate this doc's original scope; see
`docs/ARCHITECTURE.md` § "Exams & Practice (Phase 6A)".

**Key UX requirements:**
- Publishing flows must clearly show upload/processing state and validation errors (file type, size)
  before submission completes.
- Creator-facing screens must be clearly distinct from the public channel view (management chrome
  should never leak into the public-facing UI-4 experience).
- Engagement summary stays "basic" per PRD §6 — counts and simple lists, not a full analytics suite.

**Important states:** Upload/processing in-progress, upload failed (with actionable error), draft vs.
published content, empty (no content published yet).

**Dependencies:** UI-4 (channel context), UI-5, UI-6, UI-8 (the content types being published).

**Out of scope:** Monetization/payout UI, advanced analytics, collaborative/multi-editor publishing
workflows.

---

### UI-11 — Parent Experience
**Goal:** Provide a minimal parent-facing view into a connected child's learning activity, per PRD's
"planned for V1/V1.x, do not expand unnecessarily" scoping.

**Main screens/components:** Parent account/connection flow, basic child-activity view.

**Key UX requirements:**
- Must stay minimal: a basic activity view only, not a parental-control system (explicit PRD/root
  CLAUDE.md non-goal).
- Parent-child connection flow must be clear about what data is shared and require explicit
  connection (no silent linking).

**Important states:** No connected child yet, connected with activity, connected with no activity yet.

**Dependencies:** UI-1, UI-2, and functionally on whatever learning-activity data exists from UI-5/
UI-6/UI-9 by the time this phase starts.

**Out of scope:** Advanced parental controls (screen time limits, content restrictions, messaging
between parent and teacher) — explicitly out of scope per root `CLAUDE.md` and PRD §5.

---

### UI-12 — Mobile & Responsive Refinement
**Goal:** Audit and refine every prior phase's screens for mobile and small-viewport use.

**Main screens/components:** No new screens — refinement pass across UI-1 through UI-11.

**Key UX requirements:**
- Touch target sizing, mobile navigation patterns (e.g., collapsed/hamburger nav if not already
  responsive from UI-1), and Shorts-specific mobile ergonomics (UI-6 is inherently mobile-first and
  should need the least rework here).
- No layout should require horizontal scrolling on standard mobile viewports.

**Important states:** Same states as each underlying phase, verified at mobile breakpoints.

**Dependencies:** All of UI-1 through UI-11 must exist first.

**Out of scope:** Native mobile apps (explicit PRD non-goal) — this is responsive web only.

---

### UI-13 — Accessibility & UX Quality
**Goal:** Audit and remediate accessibility and general UX-quality issues across the app.

**Main screens/components:** No new screens — audit pass across all prior phases.

**Key UX requirements:**
- Keyboard navigability, semantic HTML/ARIA correctness, color contrast, focus management (especially
  for the UI-6 Shorts viewer and UI-9 quiz flow, which have non-standard interaction patterns). Contrast
  is checked against the approved token pairs in `docs/DESIGN_SYSTEM.md` §3 (WCAG AA, 4.5:1 text / 3:1
  large text/UI) — a failure here means a token pairing needs revisiting, not an ad hoc color override.
- Form validation and error messaging must be clear and programmatically associated with their fields.

**Important states:** Keyboard-only navigation, screen-reader announced states, reduced-motion
preference (relevant to UI-6 swipe transitions).

**Dependencies:** All of UI-1 through UI-12.

**Out of scope:** Full WCAG conformance certification/audit-by-external-party (may be a separate,
later effort), internationalization/localization beyond what already exists in LearnHouse.

---

### UI-14 — Final Visual Polish
**Goal:** Final consistency and craft pass once all functional UI phases are complete.

**Main screens/components:** No new screens — polish pass across the full application.

**Key UX requirements:**
- Visual consistency audit against the approved tokens in `docs/DESIGN_SYSTEM.md` (spacing, color, type)
  across every screen built since — including verifying no screen has drifted onto a hardcoded color
  value instead of a semantic token (`docs/DESIGN_SYSTEM.md` §24).
- Micro-interaction/animation consistency, empty-state illustration/copy consistency, error-message
  tone consistency.

**Important states:** N/A (cross-cutting polish, not new states).

**Dependencies:** All prior phases (UI-0 through UI-13).

**Out of scope:** New features or screens of any kind — this phase is refinement only.

---

## 4. Feature Implementation Rule

- Each UI phase is implemented only when its dependencies (listed above) are met and its corresponding
  product-roadmap phase (`docs/ROADMAP.md`) has the backend/data support it needs, or the phase is
  explicitly being built against mocked/placeholder data with that noted in the commit.
- One UI phase is completed, tested, and committed before the next begins — no parallel, unrelated UI
  phases in flight at once (mirrors the root `CLAUDE.md` "small increments" rule).
- A UI phase must not silently expand into building product features not yet on `docs/ROADMAP.md`.
- If a phase's dependencies turn out to be wrong or incomplete once work starts, stop and update this
  document rather than improvising scope.

## 5. Claude Code / Token Efficiency Rules

- Before starting any UI phase: read only the files relevant to that phase (its listed
  screens/components) plus this document's entry for that phase — do not re-read the entire codebase
  or this entire plan's other phases.
- Do not perform broad repository scans to start a UI phase; use targeted inspection of the
  components/routes named in that phase.
- Update `docs/PROGRESS.md` when a UI phase is completed, following its existing format — this document
  (`UI_UX_IMPLEMENTATION_PLAN.md`) records the plan, `PROGRESS.md` records what shipped.
- Keep phase-completion responses concise: changed files, tests run, issues found, next step — consistent
  with root `CLAUDE.md` token-efficiency rules.
- Do not re-explain this whole plan in future conversations; reference the specific phase (e.g., "UI-4")
  by name.

## 6. UI Definition of Done

A UI phase is done when:

1. It implements only what its "Main screens/components" and "Key UX requirements" sections describe —
   nothing from a later phase, nothing outside `docs/ROADMAP.md` scope.
2. All "Important states" listed for the phase are handled (not just the happy path).
3. It reuses existing LearnHouse/LearnOrbit components and the approved tokens from
   `docs/DESIGN_SYSTEM.md` (implemented in UI-0) wherever they fit; any new component is justified by
   the absence of a reusable existing one, and no color value is hardcoded outside those tokens.
4. Relevant tests/type checks pass (per root `CLAUDE.md` — "run relevant tests/type checks after
   meaningful changes").
5. The UI has been manually exercised (not just type-checked) for its golden path and its listed edge
   states, per root `CLAUDE.md`'s UI-testing rule — with any untestable state (e.g., local-dev
   multi-channel limitations noted in `docs/PROGRESS.md`) explicitly called out rather than assumed.
6. Mobile responsiveness is at least functional (full refinement is UI-12, but nothing should ship
   visibly broken on mobile before then).
7. `docs/PROGRESS.md` is updated with what shipped, and a focused commit is made per root `CLAUDE.md`
   git rules.
