# LearnOrbit V1 Progress

## Environment
- [x] WSL Ubuntu available
- [x] Docker installed and working
- [x] Bun installed and working
- [x] LearnHouse repository cloned
- [x] `learnorbit-v1` Git branch created
- [x] API dependencies installed
- [x] Web dependencies installed
- [x] Development database/services running
- [x] Original LearnHouse web application opens locally

## Current Phase
**Phase 9 — V1 Hardening: IN PROGRESS.** 9A (Security review), 9B (Performance review), 9C (Accessibility
review), 9D (Mobile-responsive polish) and 9E (Testing) are all complete. 9D landed M1–M8 across three
batches, every one live-verified; **M9 is intentionally deferred** under 9C's existing Low-findings decision.
9E added 18 backend and 48 frontend tests across four increments — exam-integrity IDOR/answer-key regression
tests, per-channel follow isolation, a cross-feature moderation→discovery integration file, and a query-key
cache-isolation guard — every security assertion mutation-checked, and **no implementation code changed**
(no new defect was found; G1–G6 were gaps in coverage, not in the guards). See their entries at the end of
this file for the full records. Phases 1–8 are done. **9A's F2 rate-limiting increment is now complete**
(2026-08-24) — see the "F2 — Rate Limiting" entry at the end of this file; `docs/SECURITY_REVIEW.md` has no
DEFERRED item left except F3 CSRF, which 9F owns. Next: **9F — Deployment plan**, the last Phase 9 item.
Not started; do not begin automatically. Six items are queued ahead of it if wanted first: seeding a
published short, a timed exam attempt and a signed-in session to close 9D's four unexercised live checks
(the Shorts snap geometry, the engagement-bar wrap, the timer over real answer controls, and the dialogs
with the on-screen keyboard), 9C's runtime keyboard verification of H5/H6, 9C's deferred reduced-motion
support (M11) and 7 Low findings, 9A's F3 CSRF-middleware decision (belongs
to 9F itself), 9B's two measurement-gated candidates (the combined engagement endpoint, the Shorts composite
index), and 9D's declined `interactiveWidget: 'resizes-content'` follow-up (responsive infrastructure, not
testing — see 9E's deferred list). 9E also recorded, without fixing, a pre-existing test-isolation defect in
inherited LearnHouse code: `test_active_users.py::TestRecordActivity::test_ee_records` passes only on the
first run per UTC day per Redis instance (see 9E's Verification section for the mechanism and the fix).

## Status Snapshot
- **Infrastructure fix (2026-08-19): both repo-wide dev-environment blockers
  logged since Phase 2G-3/3F are resolved** — `tsc --noEmit`'s `baseUrl`
  deprecation error, and the Next.js `[dynamicSegment]/(routeGroup)/page.tsx`
  404 that blocked live browser verification of every `/orgs/[orgslug]/*`
  page. See `docs/ARCHITECTURE.md` § "Repo-wide dev-environment blockers
  (fixed)" for the full fix (tsconfig `paths` restructure + 23 bare-import
  fixes; `(withmenu)` route group moved before `[orgslug]` via `git mv`, with
  the shared org layout/chrome split into `components/Contexts/OrgRootLayout.tsx`
  + `components/Objects/Menus/OrgMenuChrome.tsx` + `lib/seo/orgFaviconMetadata.ts`
  to avoid duplicating that JSX across the two resulting physical layout
  files). Verified: `tsc --noEmit` clean; live dev server + curl confirmed
  routing reaches application code (not a framework 404) across both the
  `(withmenu)` and `dash` trees for a nonexistent org slug; `bun test tests`
  unchanged (112 passed, same pre-existing 12 failures/1 error). Every prior
  phase entry below that notes "verified via backend tests + lint only" due
  to this blocker (3F, 3G, 3H, UI-1, 4B, 4C, 4D) is a historically accurate
  record of what was verified *at the time* — none of it has been
  retroactively re-verified live in this fix; that remains available as a
  follow-up if wanted, not done automatically here.
- Phase 1 (1A–1C — Channels): complete
- UI-0 (Design Foundations): complete
- UI-1 (Global Application Shell): complete
- Phase 2A–2F (Educational Video, through creator video upload): complete
- Phase 2G-1 (ChannelVideo metadata update endpoint), 2G-2 (creator metadata
  edit UI), 2G-3 (Subject/Topic/Level filtering): complete
- Phase 2G-4 (thumbnail upload): **deferred** — reusable storage
  infrastructure confirmed, but out of scope for current Phase 2
  educational-video functionality (creator polish, not a functional
  dependency of any other Phase 2 unit)
- **Phase 3A (Shorts architecture decision): complete** — documentation only,
  no code. See `docs/ARCHITECTURE.md` § "Videos / Shorts (Phase 3A)" for the
  full decision. Summary:
  - Extend the existing `ChannelVideo` table with a `content_format`
    (`"long"` default | `"short"`) discriminator — no new `Short` table.
    Upload/storage/HLS/captions/streaming are confirmed format-agnostic
    (`hls_transcode.py`'s `scale=-2:h` already preserves source aspect ratio,
    so vertical video transcodes correctly with zero pipeline changes).
  - Shorts discovery is a **global `/shorts` feed**: a new cross-org listing
    (no `org_id` filter) reusing the existing `published+public` visibility
    predicate and reverse-chronological ordering already proven in
    `list_channel_videos`. Channel pages keep showing that channel's own
    Shorts via the same org-scoped endpoint plus a new `content_format`
    filter — one table, one predicate, two filtered views.
  - Navigation: Shorts becomes a **fixed, non-configurable entry** on both
    existing nav surfaces (`OrgBottomTabBar`, `OrgSidebar`) rendered
    alongside — not through — the per-org, feature-gated
    `useOrgMenuItems`/`BUILTIN` system (Shorts isn't a per-org toggleable
    feature). Mobile's configurable slice shrinks from `MAX_TABS=4` to `3` so
    total visible destinations (Shorts + 3 + "More") stays within
    `docs/DESIGN_SYSTEM.md` §14's documented 4–5 cap, rather than exceeding
    it.
  - Security: create/publish/update/delete reuse `_require_channel_admin`
    unchanged; single-Short fetch reuses `get_channel_video`'s existing
    published+public-vs-403 split; the global feed endpoint can only ever
    return rows that already pass the same predicate; no direct storage-path
    exposure — playback stays behind the existing RBAC-gated
    `stream.py`/HLS endpoints.
  - Deferred to Phase 4: likes, comments, saves, ranking/recommendation,
    personalized feed, notifications, broader engagement systems.
- **Phase 3B (`ChannelVideo.content_format` migration + model): complete** —
  added `ChannelVideo.content_format: str = "long"` per the Phase 3A schema
  decision, via migration `a4286436d85d_add_content_format_to_channel_video`
  (server_default-backed, so every pre-Phase-3 row backfills to `"long"` and
  keeps behaving exactly as before). Verified against the real local
  Postgres instance.
- **Phase 3C (Shorts API): complete** — `GET /orgs/{org_id}/videos` extended
  with a `content_format=long|short` filter (existing subject/topic/level/
  institution/resource-type filters and authorization behavior unchanged;
  omitting `content_format` preserves prior behavior). New public, cross-org
  `GET /shorts` endpoint (mounted at `/api/v1/shorts`) for global Shorts
  discovery, reusing `list_channel_videos`' proven visibility predicate via a
  new `list_public_shorts` service function rather than duplicating query
  logic. Global discovery requires `content_format="short"`,
  `published=true`, and `visibility="public"`, ordered by `creation_date
  DESC`; no frontend filtering is used for security. Existing channel-scoped
  cross-org isolation is unchanged.
  - Verified: 107 relevant backend tests passed, 0 failed (TDD throughout —
    new tests written and watched to fail before implementation); ruff
    (pinned CI version, 0.15.9) clean on all changed/new Python files.
    Confirmed anonymous access to `/shorts`; exclusion of draft, unlisted/
    private, and long-form videos from the global feed; multi-org Shorts
    aggregation and reverse-chronological ordering; existing channel-scoped
    cross-org isolation preserved. `test_root_router.py` has a pre-existing
    `ImportError` unrelated to this change — confirmed present on the
    unmodified baseline, not caused by Phase 3C.
  - No frontend changes, no packages installed, nothing committed or pushed.
- **Phase 3D (Standalone Shorts Viewer): complete** — new route
  `/orgs/[orgslug]/(withmenu)/shorts/[channelvideoid]`, resolving under the
  existing org-scoped routing convention (`page.tsx`, `loading.tsx`,
  `error.tsx`, `short.tsx`); single tenancy resolves the browser path as
  `/shorts/{id}`, same as Phase 2D's `/videos/{id}`. Reuses
  `VideoActivity`/`LearnHousePlayer` unchanged and the existing `ChannelVideo`
  query/activity/course infrastructure (`useChannelVideo`/
  `useChannelVideoActivity`/`useChannelVideoCourse`) — no new authorization
  mechanism, no new API. Presents the Short in the documented 9:16 layout with
  a bottom-left attribution overlay (channel avatar, name, channel-type badge,
  title, subject/topic metadata). States covered: loading, not found,
  inaccessible/unpublished Short, not-a-Short (a long-form video hit at a
  Shorts URL is rejected rather than played), and player error (inherited
  from the existing player's own retry overlay). Autoplay-blocked fallback
  was **not** implemented — `LearnHousePlayer` doesn't expose that state to
  consumers, so no artificial state was invented for it. Swipe/next-previous
  queue navigation is explicitly **not** part of 3D and remains Phase 3E.
  - Fixed a layout bug caught during verification: `Video.tsx`'s 16:9
    `aspect-video` wrapper sits behind an intermediate auto-height `<div>`,
    so a simple percentage-height override couldn't reach it and the player
    collapsed to a sliver instead of filling the 9:16 frame. Fixed by pinning
    the wrapper chain to `position: absolute; inset: 0` off the Shorts frame
    (scoped via `<style jsx global>`) rather than editing the shared player —
    confirmed both the HLS/video.js path and the YouTube iframe path now
    fill the frame exactly.
  - Verified live via the full dev stack (Postgres/Redis already running, API
    + `next dev` started for this session): temporarily flipped two existing
    `ChannelVideo` rows to `content_format="short"` for testing (reverted
    after). Confirmed the 9:16 frame renders and fills correctly, the
    attribution overlay renders (avatar, name, badge, title, subject/topic
    chip), back navigation works, and all four error/guard states render
    their correct copy. Unpublished-Short 403 verified against the existing
    API (both direct `curl` and an in-page anonymous `fetch`); a long-form
    video at a Shorts URL correctly renders "not a Short" instead of playing.
    YouTube playback stalled on buffering in this sandboxed environment —
    the same limitation already present on Phase 2D's identical embed, not
    specific to this page; frame sizing and player controls (mute, captions,
    settings) were confirmed rendering correctly. No console errors caused
    by this implementation. ESLint clean on all four new files. `tsc
    --noEmit` remains blocked repo-wide by the pre-existing TypeScript 6
    `baseUrl` deprecation issue already logged under Phase 2G-3;
    `tsconfig.json` itself was confirmed untouched. No backend, package, or
    lockfile changes. Nothing committed or pushed.
- **Phase 3E (Swipe / Sequential Shorts Navigation): complete** — adds a
  queue/navigation layer around the Phase 3D viewer, unchanged in itself.
  Queue source is the existing `GET /shorts` (Phase 3C), wrapped by a new
  `services/organizations/shorts.ts: listPublicShorts` + `hooks/queries/
  useShorts.ts: useShortsQueue` (React Query, `staleTime: 60_000`, new
  `queryKeys.shorts.queue()` key) — no second Shorts listing endpoint, no
  client-side ranking/filtering; the API's `published+public` predicate and
  reverse-chronological order are the only ordering used. All logic lives in
  the existing `short.tsx` (no extraction was needed — the whole queue is one
  Short at a time, so there was nothing to split out): the current Short's
  position is found by matching its id against the fetched queue, giving
  prev/next ids; a Short reached by direct link that isn't in the public
  queue (e.g. an admin's own unpublished draft) degrades to a singleton — no
  prev/next, identical to plain Phase 3D behavior.
  - **Mobile swipe**: a real vertical `overflow-y-scroll` + `scroll-snap-type:
    y mandatory` container around the existing frame, with an empty
    `snap-start` spacer above/below wherever a prev/next id exists. Swiping a
    spacer into view — genuine touch scrolling, no gesture library — is
    detected via `IntersectionObserver` (threshold 0.6) and triggers the same
    navigation as the desktop controls. Disabled at `sm:` and up
    (`sm:snap-none sm:overflow-visible`, spacers `sm:hidden`), where desktop
    instead gets `ChevronUp`/`ChevronDown` icon buttons beside the frame
    (`aria-label`, `disabled` at either end) plus `ArrowUp`/`ArrowDown`
    keyboard handlers (ignored while focus is in a form field).
  - **Navigation/state**: advancing calls `router.push` (`next/navigation`)
    to `/shorts/{id}` via the existing `getUriWithOrg` convention — a real
    client-side route change (confirmed via `performance.getEntriesByType
    ('navigation')` staying at a single `"navigate"` entry across several
    hops, i.e. never a full reload), so the existing org shell/layout is
    never torn down. Each hop remounts `short.tsx` for the new id (standard
    Next.js App Router behavior for a changed dynamic segment — this is not a
    persistent single-instance carousel), which is also what guarantees the
    previous Short's player is fully disposed rather than continuing in the
    background (verified: exactly one `<video>`/`<iframe>` in the DOM after
    navigating, never two). The cached queue list (`staleTime: 60_000`) means
    each hop's *queue* fetch is a cache hit; only that Short's own
    `ChannelVideo`/`Activity`/`Course` data fetches fresh, same as any other
    Phase 3D/2D navigation.
  - **Skip-on-error (requirement 6)**: if the id being navigated to errors
    (404/403) or turns out not to be a Short, and the (now-stale) queue still
    has a next-or-previous id to try, the page auto-navigates past it instead
    of showing the error screen — capped at 8 consecutive auto-skips via an
    `?autoskip=` counter threaded through the URL (a plain `useRef` counter
    would reset on every hop, since each is a real remount, so it can't cap
    anything on its own). With nowhere left to skip to, it falls through to
    the unchanged Phase 3D `ShortUnavailableState`.
  - Verified live via the full dev stack, reusing the Phase 3D
    workaround (temporarily marking real `ChannelVideo` rows
    `content_format="short"`, reverted after): queue loads (3-item queue
    confirmed via direct `GET /shorts`); initial Short renders; `Next Short`/
    `Previous Short` buttons both navigate correctly and correctly
    disable/enable at each end of the queue; `ArrowUp`/`ArrowDown` do the
    same and correctly no-op at the boundaries; URL updates on every hop
    with no full reload (Navigation Timing API check above); end-of-queue
    (no further id) confirmed at both ends; a mid-queue item that changed
    from Short to long-form *after* the queue was cached (simulating a race)
    was skipped automatically and safely, landing on the next valid Short
    with no visible error and no console errors; exactly one player element
    ever present in the DOM, confirming the previous Short's player doesn't
    keep playing after navigating away; not-found and not-a-Short states
    (with an empty/no-skip-target queue) still render exactly as in Phase
    3D, unregressed. No console errors caused by this implementation.
    ESLint clean on all changed/new files. `bun test tests`: 104 pass, 12
    fail, 1 error — all in `billing-internal-key.test.mjs`, the `ar.json`
    coverage timeout, and `catalog-pagination.test.mjs`, the same pre-existing
    failures already documented as unrelated under Phase 2G-3; none touch
    `queryKeys` or Shorts. `tsc --noEmit` remains blocked by the same
    pre-existing repo-wide `baseUrl` issue (unchanged from Phase 3D). No
    backend, package, or lockfile changes. Nothing committed or pushed.
  - **Known limitation**: the swipe gesture's `IntersectionObserver` firing
    could not be verified through an actual touch/scroll gesture live —
    this environment's browser tab reports `document.visibilityState:
    "hidden"` at all times (a different manifestation of the same automation
    limitation already logged for `resize_window` under UI-1/Phase 2D/2E),
    and Chrome throttles `IntersectionObserver` callbacks entirely for
    hidden tabs — confirmed by attaching a fresh, isolated observer to the
    same elements, which also never fired. Verified instead: the scroller
    becomes genuinely scrollable and the spacer's geometry fully overlaps
    the viewport once scrolled (via `getBoundingClientRect`), and the exact
    same `goTo` navigation function the observer calls was independently
    proven correct via the button and keyboard tests above — the only
    unverified link is specifically "does the browser fire the
    `IntersectionObserver` callback," which is standard, spec-defined
    browser behavior blocked here purely by tab visibility, not by this
    code.
- **Phase 3F (Creator Shorts Upload Flow): complete** — the backend side of
  this (`ChannelVideo.content_format` accepted at create time, per Phase
  3B/3C) already existed; 3F's actual new work was entirely frontend. Reused
  the existing Phase 2F upload pipeline unchanged: `UploadChannelVideoModal.tsx`
  gained a `content_format: 'long' | 'short'` field on its `FormState`
  (default `'long'`), surfaced only in upload mode as a `ToggleGroup` ("Video"
  / "Short") above the file input, with a one-line hint per mode. No new
  uploader, no new form, no new endpoint. `UploadChannelVideoInput`
  (`channelVideoUpload.ts`) and `ChannelVideoCreateInput`
  (`channelVideos.ts`) both gained an optional `content_format` field;
  `uploadChannelVideo()` now passes `input.content_format || 'long'` straight
  through to the existing `createChannelVideo()` call — the only
  Shorts-specific line in the whole flow. Container-course orchestration,
  Activity upload/progress, draft/publish, and React Query invalidation are
  all unchanged from Phase 2F. No engagement controls (likes/comments/saves)
  were added, per Phase 4 deferral.
  - **Tests (TDD)**: new `apps/web/tests/channel-video-upload-content-format.test.mjs`
    (4 tests, `bun:test` with `mock.module` on every `uploadChannelVideo`
    collaborator) — written first and confirmed failing (payload missing
    `content_format`) before the implementation, then passing after: Short
    upload sends `content_format: "short"`; omitting it defaults to `"long"`;
    explicit `"long"` stays `"long"`; publish-now still fires for a Short.
    Backend Shorts-creation coverage (`content_format="short"` persists at
    create time, defaults to `"long"`, unauthorized/anonymous creation
    blocked) already existed from Phase 3B/3C
    (`test_channel_video_model.py`, `test_channel_videos_service.py`,
    `test_channel_videos_router.py`) — re-ran all four targeted backend
    files (49 passed, 0 failed) to confirm no regression; no backend files
    were touched this phase.
  - **Security**: unchanged from Phase 2F/3A — `POST /orgs/{org_id}/videos`
    still requires `_require_channel_admin` server-side regardless of
    `content_format`; the frontend toggle is presentation only. Verified via
    the existing backend test suite (anonymous → 401, regular member → 403),
    not re-verified live in-browser (see limitation below).
  - **Full suite**: `bun test tests` — 108 passed, 12 failed, 1 error, all
    pre-existing and already documented under Phase 3E
    (`billing-internal-key.test.mjs`, `catalog-pagination.test.mjs`'s missing
    fixture, the `ar.json` coverage timeout) — 4 more passing than Phase 3E's
    104 baseline, matching the 4 new tests added here; none of the
    pre-existing failures touch Shorts/channel-video code. ESLint clean on
    all four changed/new frontend files. `tsc --noEmit` remains blocked
    repo-wide by the same pre-existing TypeScript 6 `baseUrl` issue logged
    since Phase 2G-3, unrelated to this change.
  - **Known limitation — live browser verification not possible this
    session**: discovered (not caused by this phase's diff — confirmed via
    `git diff`, which is clean on every file involved) that this local dev
    environment's Next.js 16.2.9 cannot currently resolve **any** route
    shaped `[dynamicSegment]/(routeGroup)/page.tsx`. `/orgs/[orgslug]/(withmenu)/page.tsx`
    matches that shape, so every org-scoped page — not just Shorts/upload —
    404s (`/`, `/orgs/{slug}`, `/orgs/{slug}/videos`, `/orgs/{slug}/dash/*`,
    all of it). Isolated by direct HTTP testing across multiple route trees,
    independent of both bundlers (`next dev --turbopack` and `--webpack` fail
    identically) and independent of middleware (`proxy.ts`/`instance/info`
    all resolve correctly; the backend API itself is fully healthy):
    `/board/[boarduuid]/page.tsx` (dynamic segment, no route group) → 200;
    `/admin/(dashboard)/organizations/[orgId]/page.tsx` (route group *then*
    dynamic segment) → 200; `/orgs/[orgslug]/(withmenu)/page.tsx` (dynamic
    segment *then* route group) → 404. A separate, real issue was found and
    fixed along the way (not this bug's cause, but a real local-machine
    misconfiguration): a stray `package.json`/`package-lock.json` sitting
    directly in the WSL home directory (for an unrelated project) was being
    picked up by Turbopack's workspace-root auto-detection instead of
    `apps/web`, which the user resolved by moving those files aside. This
    Next.js dynamic-segment/route-group bug is a pre-existing, app-wide
    regression unrelated to any Phase 3F code (confirmed against
    unmodified/committed files) — fixing it would mean either changing the
    pinned Next.js version or restructuring the `(withmenu)` route group
    relative to `[orgslug]` app-wide, both far outside this phase's scope.
    Per user direction, 3F is being completed on code review + the automated
    test suite only; this blocks live verification for every future phase's
    UI work too until it's fixed in a dedicated task.
- **Phase 3G (Channel Shorts Section): complete** — the channel home page
  (`home-client.tsx`) now shows a dedicated "Shorts" section
  (`ChannelShortsSection.tsx`) above the existing "Videos" section, reusing
  the already-shipped `GET /orgs/{org_id}/videos?content_format=short`
  filter (Phase 3B/3C) via the existing `useChannelVideos` hook/cache-key
  convention — no new endpoint, service, or query hook. New
  `ChannelShortCard.tsx` is a 9:16 vertical card variant of the Phase 2E
  `ChannelVideoCard` (same thumbnail/badge/chip/edit-trigger conventions),
  linking to the existing `/shorts/{id}` viewer (Phase 3D) via the
  established `getUriWithOrg` convention, laid out as a horizontal-scroll row
  rather than the long-form grid. Deliberately filterless in 3G (no
  subject/topic/level controls — see Next Actions) and always rendered, even
  with zero Shorts, using the same empty-state pattern as
  `ChannelVideosSection`. No tabs were introduced — §17's aspirational
  Videos/Shorts/Resources/About tab system remains undone; this is a page
  section, matching the channel page's existing section-stack layout.
  - **Correctness fix**: `ChannelVideosSection` (the long-form "Videos"
    section) previously queried `GET /orgs/{org_id}/videos` with no
    `content_format` filter, so it silently included Shorts in its 16:9
    grid. It now explicitly passes `content_format: 'long'`, so Shorts only
    ever appear in the new Shorts section.
  - **Upload flow**: `UploadChannelVideoModal` gained an optional
    `defaultContentFormat` prop (upload mode only) so the Shorts section's
    "Upload" trigger opens with the existing Phase 3F Format toggle
    preselected to "Short" — the toggle itself is unchanged and still
    editable; edit mode is unaffected.
  - **No backend, API, player, or HLS changes** — `content_format=short`
    filtering, RBAC (`_require_channel_admin`, published+public visibility),
    and playback all reuse Phase 3B/3C/2A infrastructure unchanged. No
    likes/comments/saves/share — unchanged Phase 4 deferral.
  - **Tests (TDD)**: 4 new tests in
    `tests/channel-video-filters.test.mjs` for the `content_format` filter
    param (written first, confirmed failing, then implemented) — file now 16
    tests total, all passing. Full `bun test tests`: 112 passed, 12 failed, 1
    error — the same pre-existing, unrelated baseline documented since Phase
    3E/3F (`billing-internal-key.test.mjs`, `catalog-pagination.test.mjs`
    missing fixture, `ar.json` coverage timeout); 4 more passing than Phase
    3F's 108-pass baseline, matching the 4 new tests. Backend regression
    check (no backend files touched): `test_channel_videos_service.py` +
    `test_channel_videos_router.py` + `test_shorts_router.py` +
    `test_channel_video_model.py` — 49 passed, 0 failed. ESLint
    (`lint:strict`) clean on all 8 changed/new files (pre-existing
    errors/warnings elsewhere in the repo are unrelated). `tsc --noEmit`
    remains blocked at config validation by the same pre-existing repo-wide
    `tsconfig.json` `baseUrl` issue logged since Phase 2G-3;
    `tsconfig.json` itself untouched.
  - **Known limitation — live browser verification not possible**: same
    app-wide Next.js `[dynamicSegment]/(routeGroup)/page.tsx` 404 regression
    logged under Phase 3F (`/orgs/[orgslug]/(withmenu)/*` — including the
    channel home page these sections mount on — is unreachable in this local
    dev server). Already exhaustively isolated as unrelated to any phase's
    code; not re-diagnosed here. Per instruction, no Next.js/package version
    change was attempted. Verified via code review + the test suites above
    only.
  - **Deferred within 3G**: subject/topic/level filtering for the Shorts
    section (parity with `ChannelVideosSection`'s existing filters) — kept
    out to hold the diff narrow; a reasonable fast-follow, not required for
    3G's core requirement.
- **Phase 3H (Shorts Navigation): complete** — closes the last outstanding
  piece of the Phase 3A decision: `docs/ARCHITECTURE.md` §7's fixed,
  non-configurable Shorts entry on both `OrgSidebar.tsx` and
  `OrgBottomTabBar.tsx`. Both now render a Shorts entry directly (same
  icon/active-state/spacing/a11y conventions as every other nav item, icon
  via `@phosphor-icons/react`'s `FilmSlate` matching the existing nav icon
  library) — rendered outside the per-org `useOrgMenuItems`/`BUILTIN`
  system entirely, sourced from `getUriWithOrg(orgslug, '/shorts')` instead
  of the config-driven item list, since Shorts is a global destination, not
  a per-org toggleable feature. `OrgBottomTabBar.tsx`'s `MAX_TABS` dropped
  from `4` to `3` per the Phase 3A decision, keeping total visible mobile
  destinations at Shorts + 3 configurable + "More" = 5 — unchanged from
  `docs/DESIGN_SYSTEM.md` §14's documented 4–5 cap, not exceeding it. Both
  surfaces now always render (the previous `items.length === 0` early
  return is gone), since Shorts is present regardless of an org's own
  feature configuration.
  - **New landing route**: neither surface previously had anywhere to link
    — `/orgs/[orgslug]/(withmenu)/shorts/` only contained
    `[channelvideoid]/` (Phase 3D/3E's single-Short viewer); there was no
    `page.tsx` at `/shorts` itself, so a nav link to it would have 404'd.
    Added a minimal `/shorts` index route (`page.tsx`/`shorts-index.tsx`/
    `loading.tsx`, mirroring the sibling route's param-await convention)
    that redirects into the first Short of the existing, unmodified global
    queue (`useShortsQueue`, Phase 3E — no new hook or endpoint), falling
    back to a "No Shorts yet" empty state (`docs/DESIGN_SYSTEM.md` §20) if
    none are published anywhere yet. The Phase 3D/3E viewer itself
    (`short.tsx`) was not touched.
  - **No engagement rail** — per the Phase 3A deferral (§8) and this
    phase's explicit scope, no likes/comments/saves/shares/view counts were
    added anywhere in this phase.
  - **Tests**: no existing test file exercises `OrgSidebar`/
    `OrgBottomTabBar`/menu components — no React component-render harness
    exists in `apps/web/tests/` (every existing test there is a pure-logic
    `bun:test` file) — so per instruction not to invent a test framework for
    this single change, none was added. `lint:strict` clean on all five
    changed/new files. Full `bun test tests`: 112 passed, 12 failed, 1
    error — identical to the pre-existing baseline documented since
    Phase 3E/3F/3G (`billing-internal-key.test.mjs`,
    `catalog-pagination.test.mjs`'s missing fixture, the `ar.json` coverage
    timeout); no new failures, no new passes. `tsc --noEmit` remains
    blocked repo-wide by the same pre-existing `tsconfig.json` `baseUrl`
    issue logged since Phase 2G-3, unrelated to this change;
    `tsconfig.json` itself untouched.
  - **Security**: navigation-only change — no new endpoints, no new
    client-server surface, no auth logic added or modified. The `/shorts`
    index route's redirect target comes from the existing, unmodified
    `GET /shorts` public endpoint (Phase 3C) via the existing
    `useShortsQueue` hook (Phase 3E); the single-Short viewer it redirects
    into enforces the same published+public/403 rules as before (Phase
    3C/3D), unchanged.
  - **Known limitation — live browser verification not possible**: same
    app-wide Next.js `[dynamicSegment]/(routeGroup)/page.tsx` 404
    regression logged under Phase 3F/3G (`/orgs/[orgslug]/(withmenu)/*` —
    including `OrgSidebar`/`OrgBottomTabBar`'s mount point and the new
    `/shorts` index route — is unreachable in this local dev server). Not
    re-diagnosed here (already exhaustively isolated as unrelated to any
    phase's code under Phase 3F); no dev-server infrastructure was started
    or modified to work around it. Verified via code review, lint, and the
    test suite above only.
- **Phase 3 overall: COMPLETE** — 3A through 3H (architecture decision,
  schema, API, viewer, swipe navigation, upload flow, channel section, nav
  entry) are all done; Phase 3H above closes the last outstanding piece of
  the Phase 3A decision. Deferred, not blocking: Phase 3G's subject/topic/
  level filtering for the channel Shorts section (fast-follow, not required
  for 3G's core requirement, unchanged from its original deferral) and
  Phase 4's engagement systems (likes, comments, saves, shares, view
  counts, notifications, ranking — explicitly out of scope per
  `docs/ARCHITECTURE.md` §8).
- **Phase 4 planning/scoping: complete** — full architecture/data-model/API/
  frontend/notification plan produced and broken into increments 4A–4H
  (a chat-session deliverable, not a committed doc); the schema/service
  decisions actually implemented are recorded in `docs/ARCHITECTURE.md` §
  "Social Engagement (Phase 4A/4B)".
- **Phase 4A (Social Engagement schema): complete** — four new tables,
  direct FK to `channelvideo.id` (`ondelete="CASCADE"`), no polymorphism:
  `ChannelVideoLike`, `ChannelVideoSave` (toggle shape, unique per
  channelvideo+user — mirrors `OrganizationFollow`), `ChannelVideoComment`
  (flat, no threading/voting — mirrors `DiscussionComment` minus those
  fields), `ChannelVideoShare` (append-only event log, no uniqueness
  constraint, required non-nullable `user_id` — no anonymous-identity infra
  exists in this schema). Migration `d7bab4bd5914` (chained onto
  `a4286436d85d`), verified upgrade+downgrade+re-upgrade clean against the
  real local Postgres. No endpoints/services/UI — schema only. 19 new model
  tests (`test_channel_video_engagement_models.py`) + 7 pre-existing
  `ChannelVideo` model tests re-run: 26 passed, 0 failed. Ruff (pinned
  0.15.9) clean.
- **Phase 4B (Likes end-to-end): complete** — authenticated like/unlike →
  live count → frontend hook → engagement bar → long-form watch page, for
  `ChannelVideo` (Shorts wiring intentionally deferred to Phase 4F).
  - **Backend**: `services/orgs/channel_video_likes.py`
    (`get_like_status`/`like_channel_video`/`unlike_channel_video`, live
    `func.count()` — no denormalized counter) + three endpoints on the
    existing `orgs` router (`GET/POST/DELETE
    /orgs/{org_id}/videos/{channelvideo_id}/like`), returning a combined
    `ChannelVideoLikeStatus` (`is_liked`+`like_count`), the same shape as
    `OrganizationFollowStatus`. Visibility/ownership is not
    re-implemented: every function calls the existing `get_channel_video`
    first (published+public → anyone; otherwise this channel's owner/admin
    only), so a video can only be liked/its status seen by a viewer who
    could actually watch it. Concurrent duplicate likes handled via
    `IntegrityError` → idempotent success, mirroring `follow_organization`.
  - **Tests (TDD)**: 14 new service tests
    (`test_channel_video_likes_service.py` — duplicate prevention,
    idempotent unlike, live count correctness incl. a DB-direct-insert
    check that bypasses the service, per-user isolation, anonymous/401/403
    rules, owner-can-like-own-draft, cross-org rejection) + 6 new router
    tests (`TestChannelVideoLikeEndpoints` appended to
    `test_orgs_router.py`, mirroring `TestOrgFollowEndpoints`). Full
    regression run (router + channel-videos service + likes service +
    follows service + both model test files): **148 passed, 0 failed.**
    Ruff (pinned 0.15.9) clean on all changed backend files.
  - **Frontend**: `hooks/queries/useChannelVideoEngagement.ts`
    (`useChannelVideoLikeStatus`/`useLikeChannelVideo`/
    `useUnlikeChannelVideo`, mirrors `useOrgFollowStatus`/`useFollowOrg`/
    `useUnfollowOrg`) + `queryKeys.channelVideos.like(orgId, id)`; three
    new fetchers in `services/organizations/channelVideos.ts`. New
    `components/Objects/Channel/ChannelVideoEngagementBar.tsx` (like-only
    for 4B; built as a row so Save/Comment/Share can be added as siblings
    later without a redesign — no placeholder controls rendered for them).
    Mounted in `video.tsx` directly below `ChannelRow`, per
    `docs/DESIGN_SYSTEM.md` §15's documented engagement-row placement.
    `bun test tests`: 112 passed, 12 failed, 1 error — identical to the
    documented pre-existing baseline (billing-internal-key,
    catalog-pagination missing fixture, ar.json timeout); no new failures.
    `lint:strict` (eslint) clean on all changed/new frontend files.
  - **Known limitations**: `tsc --noEmit` remains blocked repo-wide by the
    pre-existing `tsconfig.json` `baseUrl` deprecation issue logged since
    Phase 2G-3 (confirmed still present; `tsconfig.json` itself untouched).
    Live browser verification not possible — same app-wide Next.js
    `[dynamicSegment]/(routeGroup)/page.tsx` 404 regression logged since
    Phase 3F (`/orgs/[orgslug]/(withmenu)/*`, including the watch page this
    mounts on, is unreachable in this local dev server); verified via
    backend tests + lint only, per the same standing limitation already
    accepted for Phase 3F/3G/3H.
  - **Deferred (per task scope)**: Saves, Comments, Shares, Notifications,
    Shorts engagement rail (4F), card-level engagement counts, engagement
    batching, denormalized counters, comment moderation, threaded replies.
- **Phase 4C (Comments end-to-end): complete** — authenticated
  create/list/edit-own/delete-own → engagement bar → long-form watch page,
  for `ChannelVideo` (Shorts wiring intentionally deferred to Phase 4F, same
  as 4B).
  - **Backend**: `services/orgs/channel_video_comments.py`
    (`create_channel_video_comment`/`list_channel_video_comments`/
    `update_channel_video_comment`/`delete_channel_video_comment`) + four
    endpoints on the existing `orgs` router (`GET/POST
    /orgs/{org_id}/videos/{channelvideo_id}/comments`, `PUT/DELETE
    .../comments/{comment_uuid}`), returning `ChannelVideoCommentRead`
    (nested `UserReadAuthor`, same shape as `DiscussionCommentReadWithAuthor`
    minus vote status). Visibility for create/list is not re-implemented:
    both call the existing `get_channel_video` first (published+public →
    anyone; otherwise this channel's owner/admin only). Edit/delete are
    author-only (403 otherwise) — no channel-admin moderation override in
    this phase; a comment's `channelvideo_id` is checked against the URL's
    on edit/delete (404 on mismatch), same defense as the like service's
    cross-org-id test. Validation is a single hard-coded
    `MAX_COMMENT_LENGTH = 2000` plus a non-empty-after-strip check — no
    configurable per-org moderation (`services/communities/moderation.py`'s
    `validate_comment_content` confirmed non-reusable, per
    `docs/ARCHITECTURE.md`). List is newest-first (`creation_date.desc()`),
    a deliberate deviation from `DiscussionComment`'s ascending order for a
    video comments panel's UX, not a copy error.
  - **Tests (TDD)**: 22 new service tests
    (`test_channel_video_comments_service.py` — create/list/update/delete
    happy paths, empty/over-length content rejection, anonymous/401/403
    rules, owner-can-comment-on-own-draft, cross-org and
    cross-channelvideo-id rejection, list ordering/limit) + 8 new router
    tests (`TestChannelVideoCommentEndpoints` appended to
    `test_orgs_router.py`, mirroring `TestChannelVideoLikeEndpoints`).
    Scoped regression (router + channel-videos service + comments service +
    likes service + both model test files, matching Phase 4B's verification
    scope exactly): **168 passed, 0 failed.** Full backend suite also run:
    **5381 passed, 10 failed, 29 skipped** — the 10 failures are pre-existing
    and unrelated (`test_custom_domains_service.py`,
    `test_org_invites_service.py`, `test_podcasts_service.py`,
    `test_core_events*.py`; none touch orgs/channel-video/comment/like code).
    Ruff (pinned 0.15.9) clean on all changed backend files.
  - **Frontend**: `hooks/queries/useChannelVideoEngagement.ts` gains
    `useChannelVideoComments`/`useCreateChannelVideoComment`/
    `useUpdateChannelVideoComment`/`useDeleteChannelVideoComment` (same
    status-query + `setQueryData`-on-success shape as the Like hooks) +
    `queryKeys.channelVideos.comments(orgId, id)`; four new fetchers in
    `services/organizations/channelVideos.ts`. No pagination UI — the list
    is fetched once with `limit=100`, mirroring the existing
    `CommentSection.tsx` (community discussions) precedent exactly. New
    `components/Objects/Channel/ChannelVideoCommentsPanel.tsx`: a
    self-contained `Dialog`-based trigger+panel (no `Sheet` primitive exists
    in this codebase) showing the comment count, list, and composer;
    mounted as one line inside `ChannelVideoEngagementBar.tsx` alongside the
    existing Like button, no changes to `video.tsx` itself (the bar already
    receives `orgId`/`channelVideoId`). `lint:strict` (eslint) clean on all
    changed/new frontend files (one pre-existing-pattern unused-arg warning
    self-fixed with a `_` prefix before commit).
  - **Known limitations**: same two standing, pre-existing environment
    issues as Phase 4B — `tsc --noEmit` blocked repo-wide by the
    `tsconfig.json` `baseUrl` deprecation issue, and live browser
    verification blocked by the app-wide Next.js
    `[dynamicSegment]/(routeGroup)/page.tsx` 404 regression
    (`/orgs/[orgslug]/(withmenu)/*`, including the watch page this mounts
    on). Verified via backend tests + lint only, same accepted standard as
    3F/3G/3H/4B.
  - **Deliberately not built (per explicit task scope)**: threaded replies,
    comment likes/upvotes, configurable moderation settings, notifications,
    ranking, ChannelVideoCommentsPanel-external pagination, card-level
    comment counts, channel-admin "delete any comment" moderation (only
    author-delete is in scope — flagged as a possible future gap, not
    implemented).
- **Phase 4D (Saves end-to-end): complete** — authenticated save/unsave →
  engagement bar, for `ChannelVideo` (Shorts wiring intentionally deferred to
  Phase 4F, same as 4B/4C). Mirrors 4B's `ChannelVideoLike` pattern exactly,
  per the Phase 4A schema decision that a save is the same (channelvideo,
  user) toggle shape as a like, just with no public count.
  - **Backend**: `services/orgs/channel_video_saves.py`
    (`get_save_status`/`save_channel_video`/`unsave_channel_video`,
    returning `ChannelVideoSaveStatus{is_saved}` — no `save_count`, since a
    save is a private per-user bookmark, not a public metric) + three
    endpoints on the existing `orgs` router (`GET/POST/DELETE
    /orgs/{org_id}/videos/{channelvideo_id}/save`). Visibility/ownership not
    re-implemented: every function calls the existing `get_channel_video`
    first (published+public → anyone; otherwise this channel's owner/admin
    only), identical to the like service. `get_save_status` supports
    anonymous viewers of a public video (`is_saved` always `false`), matching
    `get_like_status`'s behavior for API-shape consistency even though
    anonymous save state is trivially always-false. The `ChannelVideoSave`
    table itself already existed from the Phase 4A migration
    (`d7bab4bd5914_add_channel_video_engagement_tables`) — no new migration
    needed for this increment.
  - **Tests (TDD)**: 12 new service tests
    (`test_channel_video_saves_service.py` — save/unsave happy paths,
    idempotency, per-user isolation, anonymous/401/403 rules,
    owner-can-save-own-draft, cross-org rejection) + 7 new router tests
    (`TestChannelVideoSaveEndpoints` appended to `test_orgs_router.py`,
    mirroring `TestChannelVideoLikeEndpoints`). Scoped regression (router +
    saves service + likes service + comments service + engagement model
    tests, matching Phase 4B/4C's verification scope): **145 passed, 0
    failed.** Ruff (pinned 0.15.9) clean on all changed backend files (an
    unpinned newer ruff surfaced unrelated style findings — import order,
    `Union`→`|`, `datetime.UTC` — that are pre-existing in the mirrored
    `channel_video_likes.py` too; confirmed clean at the CI-pinned version).
  - **Frontend**: `hooks/queries/useChannelVideoEngagement.ts` gains
    `useChannelVideoSaveStatus`/`useSaveChannelVideo`/`useUnsaveChannelVideo`
    (same status-query + `setQueryData`-on-success shape as the Like hooks)
    + `queryKeys.channelVideos.save(orgId, id)`; three new fetchers in
    `services/organizations/channelVideos.ts`. `ChannelVideoEngagementBar.tsx`
    gains a bookmark-icon toggle button next to Like, authenticated-only (no
    anonymous read-only fallback, since there's no public count to show).
    `lint:strict` (eslint) clean on all changed/new frontend files.
  - **Known limitations**: same two standing, pre-existing environment
    issues as Phase 4B/4C — `tsc --noEmit` blocked repo-wide by the
    `tsconfig.json` `baseUrl` deprecation issue, and live browser
    verification blocked by the app-wide Next.js
    `[dynamicSegment]/(routeGroup)/page.tsx` 404 regression. Verified via
    backend tests + lint only, same accepted standard as 4B/4C.
  - **Deliberately not built (per explicit task scope)**: a "my saved
    videos" listing page/endpoint (only the per-video toggle is in scope
    this increment — listing would need a new `GET
    /orgs/{org_id}/videos/saved` or similar and its own UI, not implied by
    "Saves end-to-end" as scoped here), save counts, Shorts wiring.
- **Phase 4E (Shares end-to-end): complete** — authenticated share → live
  count → engagement bar, for `ChannelVideo` (Shorts wiring intentionally
  deferred to Phase 4F, same as 4B/4C/4D). Unlike Like/Save, `ChannelVideoShare`
  is an append-only event log per the Phase 4A schema decision: no
  uniqueness constraint, no unshare, repeated shares by the same user are
  all valid and all counted.
  - **Backend**: `services/orgs/channel_video_shares.py`
    (`get_share_status`/`share_channel_video`, live `func.count()` — no
    denormalized counter, same as likes) + two endpoints on the existing
    `orgs` router (`GET/POST /orgs/{org_id}/videos/{channelvideo_id}/share`).
    No DELETE endpoint — there is nothing to undo for an event log.
    `share_channel_video` unconditionally inserts a new row and commits on
    every call (no idempotency/`IntegrityError` guard, unlike
    like/save — there is no unique constraint to violate). Visibility/
    ownership not re-implemented: reuses the existing `get_channel_video`
    first, identical to the like/save/comment services.
  - **Tests (TDD)**: 9 new service tests
    (`test_channel_video_shares_service.py` — event creation, cumulative
    count across repeated shares by the same user, count shared publicly
    across users, anonymous/401/403 rules, owner-can-share-own-draft,
    cross-org rejection) + 4 new router tests
    (`TestChannelVideoShareEndpoints` appended to `test_orgs_router.py`,
    mirroring `TestChannelVideoLikeEndpoints` minus the DELETE case).
    Scoped regression (router + channel-videos service + likes + saves +
    comments + shares services + engagement/channel-video model tests,
    matching Phase 4B/4C/4D's verification scope): **199 passed, 0
    failed.** Ruff (pinned 0.15.9, via `uvx ruff@0.15.9` — the local `uv`
    environment has no ruff installed directly) clean on all changed
    backend files.
  - **Frontend**: `hooks/queries/useChannelVideoEngagement.ts` gains
    `useChannelVideoShareStatus`/`useShareChannelVideo` (status-query +
    single mutation, no "un-" counterpart) + `queryKeys.channelVideos.share
    (orgId, id)`; two new fetchers in `services/organizations/channelVideos.ts`.
    `ChannelVideoEngagementBar.tsx` gains a Share button (icon + public
    count, same anonymous-vs-authenticated display split as Like) that
    gained an `orgslug` prop (now also passed from `video.tsx`) purely to
    build the copied link — clicking it records the share event and copies
    the video's absolute URL to the clipboard via `navigator.clipboard
    .writeText`, reusing the existing `new URL(path, window.location.origin)`
    resolution pattern from `CourseShare.tsx` and the try/catch clipboard
    pattern from `ActivityShareDropdown.tsx`, rather than inventing new
    logic. No social-platform share-target dropdown (LinkedIn/X/WhatsApp/
    Reddit) was added — out of scope for this wiring increment, see
    `docs/ARCHITECTURE.md`. `lint:strict` (eslint) clean on all changed/new
    frontend files (one `no-console` warning in the clipboard catch block
    self-fixed by dropping the log, since the failure is already
    non-fatal).
  - **Verification beyond the standing baseline**: the two repo-wide
    dev-environment blockers (`tsconfig.json` `baseUrl`, the Next.js
    `[dynamicSegment]/(routeGroup)/page.tsx` 404) were fixed just before this
    phase (see the Status Snapshot entry above) — `tsc --noEmit` now runs
    clean (confirmed for this phase's changes), and `bun test tests`: 112
    passed, 12 failed, 1 error, matching the documented pre-existing
    baseline exactly (`billing-internal-key.test.mjs`,
    `catalog-pagination.test.mjs`'s missing fixture, the `ar.json` coverage
    timeout) — no regressions, no new frontend test file added (no fetcher
    test file exists for the Like/Save fetchers either, so none was invented
    here to stay consistent). Live in-browser verification of the Share
    button itself was **not** performed this session (no dev server was
    started); the routing fix means it's newly possible as a follow-up,
    unlike 4B/4C/4D which were structurally blocked.
  - **Deliberately not built (per explicit task scope)**: social-platform
    share targets, Shorts wiring, view/impression tracking beyond the share
    event itself, a "who shared this" listing.
- **Phase 4F (Shorts engagement rail): complete** — Like/Comment/Save/Share
  now live on the Shorts viewer (`short.tsx`), reusing Phase 4A–4E's
  hooks/endpoints unchanged (no backend/schema work). `docs/DESIGN_SYSTEM.md`
  §16 requires a vertical icon+count rail (`--foreground`-on-scrim, overlaid
  on mobile, alongside-not-overlaid on desktop) — visually incompatible with
  the existing light horizontal bar built for the watch page, so rather than
  forking the engagement logic into a Shorts-only component,
  `ChannelVideoEngagementBar` gained a `layout?: 'horizontal' | 'rail'` prop
  (default `'horizontal'`; watch page usage unchanged) and
  `ChannelVideoCommentsPanel` gained an optional `trigger` render-prop so the
  rail can supply its own icon+count Dialog trigger. See
  `docs/ARCHITECTURE.md` § "Social Engagement (Phase 4A/4B/4C/4E/4F)" for the
  full decision record.
  - **Frontend only**: `short.tsx` mounts the rail twice, mirroring the
    file's existing dual-markup convention for breakpoint-specific controls
    (same pattern as its up/down nav buttons) — absolutely positioned inside
    `.short-viewer-frame` for mobile (`sm:hidden`, scrolls with its own
    slide, same technique as `ShortAttributionOverlay`), and a
    `hidden sm:flex` column beside the frame for desktop.
  - **Verification**: ESLint (`lint:strict`) clean on all three changed
    files. `tsc --noEmit` clean project-wide. `bun test tests`: 112 passed,
    12 failed, 1 error — matching the documented pre-existing baseline
    exactly (same three known failures as 4E), no regressions. No new
    component tests added (this repo's frontend suite is service/logic-level
    only, no component-render harness — consistent with 4B–4E).
  - **Live browser verification**: performed against the real dev stack
    (`npx learnhouse dev`, Postgres/Redis already running). No seeded Short
    existed locally, so an existing published long-form `ChannelVideo`
    (id 1, a real working YouTube-backed Activity) was temporarily flipped
    to `content_format='short'` via direct DB update to reach the Shorts
    viewer, then reverted to `'long'` immediately after — a temporary,
    reversible QA fixture, not a schema or seed-data change. Confirmed at
    desktop width (1400px): rail renders alongside the frame (not overlaid)
    with correct Like/Comment/Share icon+count styling and contrast: Comment
    trigger opens the same `ChannelVideoCommentsPanel` Dialog correctly
    (`RailCommentTrigger`'s forwardRef/asChild wiring confirmed working); the
    long-form watch page (`/videos/1`) was re-checked after reverting the
    fixture and its horizontal bar is unchanged. **Not verified live**: the
    mobile overlay placement — this environment's `resize_window` tool does
    not actually shrink the rendered viewport (same pre-existing tool
    limitation already logged for UI-1's mobile bottom tab bar), so the
    `sm:hidden` mobile rail was code-reviewed only, not pixel-verified.
  - **Pre-existing, unrelated**: a Radix `DialogContent` missing-Description
    console warning on the Comments dialog — present before this phase
    (`ChannelVideoCommentsPanel`'s `DialogContent` was not modified), not a
    regression from this change.
- **Phase 4G (Home feed): complete** — the roadmap's "Home feed" item.
  Reverse-chronological, long-form-only feed of videos from channels the
  authenticated user follows, reusing `ChannelVideoCard`'s `channel` prop
  (added in Phase 2G-2 in anticipation of exactly this) rather than
  introducing a new card component. See
  `docs/ARCHITECTURE.md` § "Home Feed (Phase 4G)" for the full decision
  record (cross-org query over `OrganizationFollow`, why Shorts are
  excluded, the 401-for-anonymous convention, and the nav-cap tradeoff).
  - **Backend**: `list_home_feed` (new, `services/orgs/channel_videos.py`)
    joins `ChannelVideo`→`Organization` filtered to the caller's followed
    org ids; `GET /feed` (new router, `routers/feed.py`, mounted in
    `router.py`). 401 for anonymous, `[]` for a user following nobody.
  - **Frontend**: new route `app/orgs/(withmenu)/[orgslug]/feed/` (`page.tsx`
    + `feed-client.tsx`), `services/organizations/feed.ts`,
    `hooks/queries/useHomeFeed.ts`, a `feed.home` query key. "Home" added as
    a second fixed, global nav destination (same pattern as Shorts) in
    `OrgSidebar.tsx`/`OrgBottomTabBar.tsx`; the mobile tab bar's
    config-driven `MAX_TABS` dropped `3 → 2` to hold the documented 4–5
    top-level-destination cap with two fixed tabs now.
  - **Verification**: backend — 8 new service tests + 1 new router test
    (`test_home_feed_*`, `test_home_feed_rejects_anonymous_caller`), all
    passing; ruff clean (pinned 0.15.9); full suite
    `TESTING=true uv run pytest src/tests/`: **5420 passed, 29 skipped, 11
    failed** — all 11 failures pre-existing and unrelated (EE hooks, custom
    domains, org invites, podcasts service), none touch orgs/follows/
    channel_videos/feed. Frontend — ESLint (`lint:strict`) clean, `tsc
    --noEmit` clean project-wide, `bun test tests`: 112 passed, 12 failed, 1
    error — the same documented pre-existing baseline as 4E/4F, no
    regressions.
  - **Live browser verification**: performed against the real dev stack
    (already running: web:3000, api:1338, Postgres/Redis). Confirmed
    unauthenticated: "Home" nav renders first (both sidebar and, implicitly,
    the mobile tab bar via the same fixed-entry code path) and is
    highlighted active on `/feed`; the signed-out empty state ("Sign in to
    see your feed") renders correctly. Confirmed authenticated end-to-end
    using a temporary QA account (created via signup, email-verified via a
    direct DB update since local dev has no SMTP configured — `smtp_host: ""`
    in `config.yaml` — a temporary, reversible fixture, deleted after use,
    same pattern as 4F's temporary content_format flip): followed the
    default org via its existing Follow button, then `/feed` correctly
    rendered both of that channel's published long-form videos as
    `ChannelVideoCard`s with the channel attribution badge, subject/topic
    chips, and relative published date; clicking a card navigated correctly
    to its `/videos/{id}` watch page with a working player. No console
    errors on either page. **Not verified live**: a true cross-org
    click-through (this environment's single-tenancy dev collapse means
    only one real org exists locally, so the accepted "card links use the
    page's own orgslug, not the item's" limitation — same as Shorts — could
    not be exercised against a second distinct org); the mobile nav layout
    (same pre-existing `resize_window` limitation logged for UI-1/4F).
- **Phase 4H (Basic notifications): complete** — the roadmap's last Phase 4
  item. In-app notifications created when a user comments on another user's
  `ChannelVideo`, no self-notification when the video's own admin comments
  on it. See `docs/ARCHITECTURE.md` § "Basic Notifications (Phase 4H)" for
  the full decision record (recipient resolution via existing org-admin
  role checks, the best-effort call-site pattern reused from
  `_try_record_org_admin_in_loops`, and the minimal endpoint/UI surface).
  - **Backend**: new `notification` table/model (`db/notifications.py`,
    migration `f9a1b2c3d4e5`) — single-purpose FKs to `user`
    (recipient/actor) and `channelvideo`, plain-string `notification_type`
    (`"COMMENT"` today, extensible to `LIKE` later without a migration).
    `services/notifications/notifications.py`: `create_comment_notifications`
    (notifies the video's org admin(s)/maintainer(s) except the actor),
    `list_notifications`, `get_unread_notification_count`,
    `mark_notification_read`, `mark_all_notifications_read` — all
    recipient-scoped, 401 for anonymous, 404 (not 403) for a
    non-recipient's `notification_uuid`. New global router
    `routers/notifications.py` (`GET /notifications`,
    `GET /notifications/unread-count`, `PATCH /notifications/{uuid}/read`,
    `PATCH /notifications/read-all`), mounted in `router.py` under
    `/notifications`, same unscoped-router pattern as `routers/feed.py`.
    Best-effort integration: `create_channel_video_comment`
    (`services/orgs/channel_video_comments.py`) now builds its response
    *before* calling `_try_create_comment_notifications` (try/except +
    `logging.exception` + `db_session.rollback()` on failure), so a
    notification-layer exception can never break comment creation and
    can't leave a stale/expired ORM instance in the returned response.
  - **Frontend**: `services/organizations/notifications.ts` (fetchers),
    `hooks/queries/useNotifications.ts` (`useNotifications`,
    `useUnreadNotificationCount` — 60s `refetchInterval`,
    `useMarkNotificationRead`, `useMarkAllNotificationsRead`), a
    `notifications` query-key group in `lib/query/keys.ts`. New
    `components/Objects/Menus/NotificationBell.tsx`: a bell icon + unread
    badge + `DropdownMenu` list (actor avatar, "commented on your video",
    relative time, unread dot, "mark all read"), reusing `OrgMenu.tsx`'s
    existing `CopilotMenuButton` dropdown pattern rather than a new nav
    destination or page — matches `docs/UI_UX_IMPLEMENTATION_PLAN.md`
    UI-7's "simple list/indicator, not a full real-time system." Wired into
    `OrgMenu.tsx` in both the desktop header row (`hidden md:flex`,
    authenticated-only) and the existing mobile hamburger panel (alongside
    `HeaderProfileBox`), so no new mobile surface was added.
  - **Tests (TDD: RED confirmed before each GREEN)**: 12 new service tests
    (`test_notifications_service.py`) + 3 new integration tests appended to
    `test_channel_video_comments_service.py` (notification-on-comment,
    no-self-notification, comment survives a monkeypatched notification
    failure) + 8 new router tests (`test_notifications_router.py`,
    anonymous-401 and cross-user 404/scoping cases) — **23 new tests, all
    passing**. Full backend suite
    (`TESTING=true uv run pytest src/tests/`): **5443 passed, 29 skipped,
    11 failed** — the same 11 pre-existing, unrelated failures as 4G's
    documented baseline (EE hooks, custom domains, org invites, podcasts
    service), +23 vs. 4G's 5420 passed, confirming no regressions. Ruff
    (pinned 0.15.9 via `uvx ruff@0.15.9`) clean on every new/changed
    backend file. Frontend: ESLint (`lint:strict`) clean on every
    new/changed frontend file (the repo-wide run surfaces ~751 pre-existing
    problems in unrelated files, none touching this change); `tsc --noEmit`
    clean project-wide; `bun test tests`: 112 passed, 12 failed, 1 error —
    the same documented pre-existing baseline as 4E–4G, no regressions.
    `git diff --check`: clean (CRLF-normalization notices only, no actual
    whitespace errors).
  - **Live browser verification**: **not performed.** This environment's
    dev stack was not started for this increment (no live `npx learnhouse
    dev` session was running), so the bell's rendering, dropdown behavior,
    and mark-read interaction were code-reviewed against existing working
    patterns (`CopilotMenuButton`, `ChannelVideoCommentsPanel`) but not
    pixel/interaction-verified in a real browser. This is a real gap, not
    the previously-logged `resize_window`/routing limitations.
  - **Known limitations / deferred**: LIKE notifications (type column
    supports it, no call site added — out of scope per the task); email
    notifications, push notifications, notification preferences, threaded
    notifications (all explicitly out of scope); card-level engagement
    counts and comment moderation (already deferred since 4E/4F, unchanged).
- **Phase 5A (Academic Library architecture decision): complete** — documentation
  only, no code, same treatment as Phase 3A. See `docs/ARCHITECTURE.md` §
  "Academic Library (Phase 5A)" for the full decision. Summary:
  - New `ChannelResource` table (not yet created) — a thin discovery/metadata
    layer over the existing `TYPE_DOCUMENT`/`SUBTYPE_DOCUMENT_PDF` `Activity`
    infrastructure, mirroring `ChannelVideo`'s relationship to `TYPE_VIDEO`
    Activities exactly. No new upload/storage/validation code — reuses
    `create_documentpdf_activity`, `upload_pdf`, and
    `security/file_validation.py`'s existing `document` file type unchanged.
  - Fields: `id`, `channelresource_uuid`, `org_id` (FK CASCADE), `activity_id`
    (FK CASCADE, unique), `title`, `description`, `published`, `visibility`,
    `creation_date`, `update_date`, `subject`, `topic`, `level`,
    `institution_context`, `resource_type`, and a new `year` field (not on
    `ChannelVideo` — needed for past papers to be discoverable). No
    `thumbnail_image` (Resource card is icon/badge-driven per
    `docs/DESIGN_SYSTEM.md` §13, not thumbnail-driven) and no format column
    (V1 is PDF-only).
  - Gets its **own** lazily-created hidden container course ("Channel
    Resources", marker `learnorbit_resource_container`), separate from the
    existing "Channel Videos" container — avoids mislabeling PDFs as videos
    in an admin's course list, and the existing container-lookup pattern is
    single-marker-per-org already, so two content types need two markers.
  - File serving needs **no** `content_files.py` changes (same
    `orgs/.../courses/.../activities/...` path shape already gated by
    `course.public`); viewing reuses `DocumentPdf.tsx`'s existing `<iframe>`
    unchanged.
  - Inherits the same accepted Phase 2A/3A trade-off: the container course
    being `public: true` means a draft resource's raw file is technically
    fetchable by direct URL/UUID knowledge, not just through the app —
    unchanged, not solved here, `ChannelResourceRead` won't expose storage
    paths directly (same rule as `ChannelVideoRead`).
  - Confirmed no existing `audit_logs` precedent for `ChannelVideo`
    create/publish/delete, so Phase 5B does not invent one unilaterally for
    resources alone.
  - Deferred to 5B onward: model file, migration, service/router layer,
    frontend upload flow, resource card/listing/detail UI, filtering
    endpoint. Global cross-channel discovery, full-text search, and
    resource-level likes/comments/saves are out of Phase 5 scope entirely
    (no ROADMAP item, no PRD signal).
- **Phase 5B (`ChannelResource` model + migration + service + router):
  complete.** Implements exactly the Phase 5A decision, mirroring
  `ChannelVideo`'s existing model/service/router pattern:
  - `db/channel_resources.py` — `ChannelResource` table: `id`,
    `channelresource_uuid`, `org_id` (FK CASCADE), `activity_id` (FK CASCADE,
    unique), `title`, `description`, `published`, `visibility`,
    `creation_date`, `update_date`, `subject`, `topic`, `level`,
    `institution_context`, `resource_type`, `year`. No `thumbnail_image`, no
    `content_format` — per the 5A decision, resources are icon/badge-driven
    and PDF-only in V1.
  - Migration `5d1f971f786d_add_channel_resource_table` (chained after the
    existing head `f9a1b2c3d4e5_add_notification_table`) creates the table,
    its three indexes, and the `activity_id` unique constraint — same shape
    as `e77b30b9f1ec_add_channel_video_table`.
  - `services/orgs/channel_resources.py` — `create_channel_resource` (owner/
    admin only; validates the `Activity` belongs to this org and is
    `TYPE_DOCUMENT`, 404s identically for not-found vs. wrong-org, 409s on
    wrong type or duplicate post), `list_channel_resources` (published+public
    predicate for non-admins, admins see drafts/unlisted; filters by
    subject/topic/level/institution_context/resource_type/year;
    newest-first), `get_channel_resource` (public for published+public,
    admin-only otherwise), `set_channel_resource_published`,
    `update_channel_resource` (partial update via `exclude_unset`, rejects a
    blank title), `delete_channel_resource` (removes only the channel post;
    the underlying `Activity` is left untouched, same asymmetry as
    `delete_channel_video`). No container-course helper
    (`ensureChannelResourcesContainer`) was added in this increment — it's a
    frontend upload-flow concern (Phase 5A point 2), out of 5B's
    backend-model/service/router scope; the service only ever operates on an
    `Activity` that already exists in *some* course.
  - Router: six new endpoints on the existing `orgs` router mirroring the
    video ones exactly — `POST/GET /{org_id}/resources`,
    `GET/PUT/DELETE /{org_id}/resources/{channelresource_id}`,
    `PUT /{org_id}/resources/{channelresource_id}/publish`. No
    likes/comments/saves/shares endpoints — confirmed out of Phase 5 scope
    per the 5A decision.
  - **Tests**: `src/tests/courses/test_channel_resource_model.py` (6 tests —
    defaults, `year` nullability, `activity_id` uniqueness, FK CASCADE
    wiring/behavior for both `org_id` and `activity_id`) and
    `src/tests/services/test_channel_resources_service.py` (23 tests —
    creation/ownership/authorization, wrong-activity-type rejection,
    duplicate-post rejection, listing visibility/ordering/metadata+year
    filtering, get/publish/update/delete authorization, cross-org access
    prevention). No dedicated router-HTTP test file was added — mirrors
    `ChannelVideo`'s own precedent, where the base CRUD routes have no
    router-level test file either (only `test_channel_videos_router.py`,
    scoped to `content_format` query-param filtering, which resources don't
    have).
  - **Verification**: `TESTING=true uv run pytest
    src/tests/courses/test_channel_resource_model.py
    src/tests/services/test_channel_resources_service.py -v` — 29 passed.
    `uv run pytest src/tests/routers/test_orgs_router.py -q` (the shared
    router file this change touches) — 82 passed, no regressions. Full suite
    `TESTING=true uv run pytest src/tests/ -q` — 5473 passed, 29 skipped, 10
    failed; all 10 failures are pre-existing and unrelated (`test_core_events*`,
    `test_custom_domains_service`, `test_org_invites_service`,
    `test_podcasts_service` — none touch channels/videos/resources/orgs
    router). `ruff check` clean on all new/changed files (pinned 0.15.9, via
    `uv run --with ruff==0.15.9 ruff check ...` since a bare `ruff` binary
    isn't on PATH in this shell). `uv run alembic upgrade head` was attempted
    but originally failed on a DB/migration-history drift unrelated to this
    change: the local dev Postgres already had a `notification` table that
    migration `f9a1b2c3d4e5_add_notification_table` (the previous head, from
    Phase 4H) tried to (re)create — the new
    `5d1f971f786d_add_channel_resource_table` migration was never reached by
    that failure. Not fixed in this increment (out of Phase 5B's scope); the
    migration file itself was reviewed against
    `e77b30b9f1ec_add_channel_video_table`'s shape and is consistent with it.
    **RESOLVED (2026-08-20)** — see the "Local dev DB migration drift (fixed)"
    entry below; `alembic upgrade head` now succeeds and this migration is
    applied.
  - **Known limitations / deferred**: no `audit_logs` entry (matches the 5A
    finding — no existing precedent for `ChannelVideo` either); no
    container-course creation helper yet (frontend-flow concern, Phase 5C);
    no browser/UI verification (no UI exists yet — backend-only increment).
- **Phase 5C (frontend upload flow, resource card/listing/detail UI):
  complete.** Implements exactly the remaining Phase 5A "deferred to 5B
  onward" list, mirroring the Phase 2F/2G/2D `ChannelVideo` frontend pattern
  file-for-file — no new backend code, no schema change, no packages
  installed:
  - `services/organizations/channelResourceFilters.ts` — pure filter helpers
    (subject/topic/level/institution_context/resource_type/year), mirroring
    `channelVideoFilters.ts`.
  - `services/organizations/channelResources.ts` — fetchers/mutations for the
    Phase 5B endpoints (list/get/create/update/publish/delete). No
    likes/comments/saves/shares wrappers — confirmed out of Phase 5 scope by
    the 5A decision.
  - `services/organizations/channelResourceUpload.ts` — the
    `ensureChannelResourcesContainer` helper (its own hidden container
    course, "Channel Resources", marked via a new
    `learnorbit_resource_container` extra_metadata marker — distinct from
    `CHANNEL_VIDEOS_CONTAINER_MARKER` per the 5A decision) plus
    `uploadChannelResource`, which orchestrates container lookup → the
    existing, unmodified `POST activities/documentpdf` upload (via
    `createFileActivity`, reused as-is — no new XHR-progress path, since
    `createFileActivity` doesn't report progress and PDFs don't need one the
    way large video uploads do) → `createChannelResource` → optional publish.
  - `hooks/queries/useChannelResource.ts`,
    `hooks/queries/useChannelResourceUpload.ts` — React Query wrappers
    mirroring `useChannelVideo.ts`/`useChannelVideoUpload.ts`'s query-key and
    cache-invalidation pattern (new `queryKeys.channelResources` block in
    `lib/query/keys.ts`).
  - `components/Objects/Channel/UploadChannelResourceModal.tsx` — upload/edit
    modal (PDF file input instead of video, adds the resource-only `year`
    field, no `content_format` toggle, no upload-progress percentage since
    the underlying endpoint doesn't report one).
  - `components/Objects/Channel/ChannelResourceCard.tsx` — icon/badge-driven
    card (no thumbnail field on `ChannelResource`) per
    `docs/DESIGN_SYSTEM.md` §13's Resource card spec: file-type icon → title
    → subject/level/institution/resource_type/year chips → view action.
  - `components/Objects/Channel/ChannelResourcesSection.tsx` — channel-page
    section with upload trigger + filter bar (subject/level/institution/type
    dropdowns, per §18's "Resource filters" spec — topic/year remain
    server-filterable but aren't surfaced as dropdowns) + grid, mirroring
    `ChannelVideosSection.tsx`. Wired into `home-client.tsx` alongside the
    existing Shorts/Videos sections.
  - `app/orgs/(withmenu)/[orgslug]/resources/[channelresourceid]/{page,
    loading,error,resource}.tsx` — detail/viewer page mirroring the video
    watch page's not-found/inaccessible/draft-preview states exactly, reusing
    the existing, unmodified `DocumentPdfActivity` iframe viewer in place of
    the video player. No engagement bar (no likes/comments/saves/shares —
    out of Phase 5 scope).
  - **Tests**: `tests/channel-resource-filters.test.mjs` (10 tests — mirrors
    `channel-video-filters.test.mjs`) and `tests/channel-resource-upload.test.mjs`
    (5 tests — container-marker creation and upload-flow orchestration,
    including that the resource-only `year` field reaches
    `createChannelResource`'s payload), written first and watched to fail
    (module-not-found) before implementation, per this repo's
    PLAN→RED→GREEN→REFACTOR→VERIFY→DOCUMENT workflow.
  - **Verification**: `bun test tests/channel-resource-filters.test.mjs
    tests/channel-resource-upload.test.mjs` — 15 passed. Full suite
    `bun test tests` — 123 passed, 13 failed, 2 errors; all failures are
    pre-existing and unrelated (`billing-internal-key.test.mjs` —
    `CLOUD_INTERNAL_KEY` resolution, `catalog-pagination.test.mjs` — missing
    module unrelated to this change, `ar.json covers every en.json key` —
    pre-existing translation-coverage gap/timeout); none touch
    channels/videos/resources. `tsc --noEmit` clean. `bun run build`
    succeeds and includes the new
    `/orgs/[orgslug]/resources/[channelresourceid]` route. `eslint` clean on
    every new/changed file.
  - **Known limitations / deferred**: no live browser verification this
    session — the local dev web/API servers weren't running, and a quick
    `psql` sanity check against the Postgres container failed (used the
    wrong role name, not a real project misconfiguration — see the "Local
    dev DB migration drift (fixed)" entry below for the actual, unrelated
    pre-existing issue this surfaced and its fix). Not fixed in this
    increment (out of scope for a UI-only change). No
    `audit_logs` entry (matches the 5A/5B finding — no existing precedent for
    `ChannelVideo` either). Download-vs-inline-view distinction from
    `docs/DESIGN_SYSTEM.md` §18 was not implemented — V1 resources are
    PDF-only and always inline-viewable via the existing iframe viewer, so
    the "Download for non-previewable types" branch has no current use case.
- **Local dev DB migration drift (fixed, 2026-08-20)** — root-caused and
  fixed the `uv run alembic upgrade head` failure logged in the Phase 5B and
  5C entries above. **Root cause: not a Postgres role/auth problem.** The
  project's DB role is `learnhouse`/`learnhouse` everywhere it's configured
  (`.learnhouse/docker-compose.dev.yml`'s `POSTGRES_USER`/`POSTGRES_PASSWORD`,
  `apps/api/config/config.yaml`'s `sql_connection_string`, and
  `apps/api/alembic.ini`'s fallback `sqlalchemy.url` all agree), and it
  connects successfully — confirmed via `psql -U learnhouse`, `alembic
  current`, and a direct connection through the API's own async engine
  (`src.core.events.database.engine`). The actual cause: `_bootstrap_schema()`
  in `apps/api/src/core/events/database.py` runs
  `SQLModel.metadata.create_all` on every non-testing API startup, which
  silently creates any table missing from the live schema straight from the
  ORM models — bypassing Alembic's version bookkeeping entirely. At some
  point the API was started after the Phase 4H `notification` model existed
  but before its migration (`f9a1b2c3d4e5_add_notification_table`) was run,
  so `create_all` created the table directly. `alembic_version` was left
  behind at the prior revision (`d7bab4bd5914`), so every later `alembic
  upgrade head` tried to re-run `CREATE TABLE notification` and failed with
  `psycopg2.errors.DuplicateTable` — which is what blocked the Phase 5B
  `channelresource` migration from ever being reached, and is what an
  earlier verification attempt (using the wrong `psql -U postgres`, a role
  that was never created) misreported as a role/auth mismatch.
  - **Fix**: `uv run alembic stamp f9a1b2c3d4e5` (from `apps/api`) — reconciles
    `alembic_version` with the schema state that was already actually
    present, without touching any table or data (`ALTER TABLE
    alembic_version` only). Followed by `uv run alembic upgrade head`, which
    then applied only the genuinely-pending
    `5d1f971f786d_add_channel_resource_table` migration cleanly. No source
    files changed, no container recreated, no data reset/deleted — existing
    Alembic tooling only.
  - **Verification**: `alembic current`/`\d channelresource` confirm
    `alembic_version` = `5d1f971f786d` (single head) and the `channelresource`
    table now exists with the exact columns/indexes/FKs its migration
    defines. A second `alembic upgrade head` run is a clean no-op (idempotent).
    The API's own async engine connects successfully (`SELECT current_user,
    current_database()` → `learnhouse`/`learnhouse`, via
    `src.core.events.database.engine` — the same engine object the running
    app uses). `TESTING=true uv run pytest
    src/tests/courses/test_channel_resource_model.py
    src/tests/services/test_channel_resources_service.py -q` — 29 passed
    (this suite runs against an isolated `TESTING=true` DB, independent of
    the dev DB fixed here — included as the smallest relevant regression
    check on the code this migration serves). `git diff --check` clean — no
    working-tree files were touched by this fix.
  - **Known limitations**: `_bootstrap_schema()`'s `create_all`-on-startup
    behavior is pre-existing, unmodified LearnHouse/LearnOrbit application
    behavior (not touched here, per this task's "don't change application
    architecture" constraint) — it can cause the same drift again for any
    future model added without its migration being run before the next API
    startup. No process change was made to prevent recurrence; worth a
    follow-up if it becomes a repeated papercut.
- **Phase 5D (Phase 5C live browser verification): complete** —
  verification-only, no source files changed. Closes the "not live-verified"
  limitation carried since Phase 5C, against the real dev stack (web:3000,
  api:1338, Postgres/Redis already running).
  - **Method**: created a temporary QA account (`phase5dqa@example.com`,
    deleted after use), email-verified and granted org-admin on the default
    org via direct DB update (no SMTP locally, same fixture pattern as
    Phase 4G's QA account). Uploaded two real PDF resources through the
    actual `UploadChannelResourceModal` UI: one left as a draft (all six
    metadata fields filled, including `year`), one uploaded with "Publish
    now" on and a different subject (`Biology`/`Form 2`) to exercise
    filtering.
  - **Confirmed working end-to-end**: upload → `ensureChannelResourcesContainer`
    (real container-course + chapter creation) → `documentpdf` Activity
    upload → `ChannelResource` creation → optional publish; the draft
    resource's card (lock badge, chips) and detail page ("Not published —
    only visible to you", full metadata chips, PDF rendered in the iframe
    viewer); the published resource's card (no draft badge) and detail page;
    anonymous access correctly 403s the draft (`GET
    /orgs/1/resources/{id}` and exclusion from the anonymous list) and
    correctly 200s the published one (confirmed via direct `curl`, no
    session); the Subject filter dropdown (options derived correctly from
    real data, selecting "Mathematics" narrowed the grid and fired
    `GET .../resources?subject=Mathematics`, confirmed via network-request
    inspection); the edit-metadata flow (changed the published resource's
    Topic field via the card's edit pencil, confirmed persisted via a direct
    API fetch).
  - **Bug found and root-caused, not a product defect**: the first upload
    attempt 403'd on `POST /orgs/1/resources` ("Only this channel's
    owner/admins can do this") despite the QA account having an Admin role.
    Root cause: the QA setup had (accidentally) left the account with *two*
    `userorganization` rows for the same org (a `User` row from normal
    signup plus a manually-inserted `Admin` row); `get_user_org()`
    (`apps/api/src/security/org_auth.py`) does `.scalars().first()` with no
    `ORDER BY`, so it non-deterministically picked the non-admin row. Fixed
    by deleting the duplicate row (test-data cleanup, not a code change).
    Flagging as a possible defensive follow-up: nothing in the schema or
    service layer prevents a user from ever having two role rows for the
    same org, and `get_user_org` would silently pick either one if it
    happened for real — not something normal product flows can currently
    trigger, so not fixed in this verification-only session.
  - **Real gap found, not specific to 5C**: there is no UI control to
    publish a draft (or unpublish a live) resource after the initial
    upload — `setChannelResourcePublished`/`PUT
    .../resources/{id}/publish` is fully implemented and tested
    (Phase 5B) but is only ever called from the upload-time "Publish now"
    toggle; neither `ChannelResourceCard` nor the edit modal expose it
    afterward. Checked `ChannelVideoCard`/`channelVideos.ts` and found the
    identical gap already exists there (`setChannelVideoPublished` has the
    same call-site pattern) — so this is a pre-existing product gap 5C
    faithfully mirrored, not a regression introduced here. Not fixed in
    this session (out of scope for verification; a real follow-up for
    either content type).
  - **Minor, pre-existing, mirrored cosmetic issue**: `ChannelResourceCard`
    always renders "Published {{date}}" using `creation_date`, even for an
    unpublished draft (confirmed on the draft card in this session) —
    directly mirrors the identical unconditional copy in `ChannelVideoCard`.
    Not fixed here.
  - **Cleanup**: all test data removed after verification — both
    `ChannelResource` rows, their three `Activity` rows (including one
    orphaned by the 403 above, from the first, failed attempt), the test
    "Channel Resources" container course, and the QA account/its org
    membership. Confirmed via direct DB query: `channelresource` count back
    to 0, user id deleted, only the pre-existing `Algebra Basics` course and
    `Channel Videos` container remain on the default org.
  - **No source files changed** — this increment was verification only.

## Current Task
Phase 2 (2A–2G-3) is functionally complete for V1 scope; 2G-4 (thumbnail
upload) remains deferred to a later creator/UI polish phase (see entry
below). Phase 3A–3H (architecture decision, schema/model, API, viewer,
swipe navigation, upload flow, channel section, nav entry) are all
complete; see the Status Snapshot entries above and
`docs/ARCHITECTURE.md` § "Videos / Shorts (Phase 3A)". **Phase 3 overall is
now complete.** Outstanding, non-blocking items: subject/topic/level
filtering for the Shorts channel section (deferred within 3G, see above),
and the app-wide Next.js dynamic-segment/route-group routing bug logged
under Phase 3F, which blocks live browser verification for `/orgs/*` pages
(including 3H's changes) until fixed in a dedicated task. Phase 4
planning/scoping is complete; Phase 4A (engagement schema), Phase 4B
(Likes end-to-end), Phase 4C (Comments end-to-end), Phase 4D (Saves
end-to-end), Phase 4E (Shares end-to-end), and Phase 4F (Shorts engagement
rail), and 4G (Home feed) are all complete — see the Status Snapshot entries
above, `docs/ARCHITECTURE.md` § "Social Engagement (Phase 4A/4B/4C/4E/4F)",
and § "Home Feed (Phase 4G)". 4F was live-verified against the real dev
stack at desktop width (rail placement, styling, and the Comments Dialog
trigger all confirmed working); the mobile overlay placement is
code-reviewed only, not pixel-verified, due to this environment's
pre-existing `resize_window` limitation (same one already logged for UI-1).
4G was live-verified end-to-end including authenticated feed content (see
its Status Snapshot entry for the temporary QA-account fixture used). Phase
4H (Basic notifications) is now also complete — see its Status Snapshot
entry below and `docs/ARCHITECTURE.md` § "Basic Notifications (Phase 4H)".
**Every `docs/ROADMAP.md` Phase 4 item is now checked off; Phase 4 is
complete.** (`docs/ROADMAP.md`'s Likes/Comments/Saves/Sharing boxes had
drifted out of sync with this file's prior "complete" claims for 4B–4E —
found during 4H, since fixed: all five Phase 4 boxes now accurately reflect
4B–4H's completed status.) Phase 5A (Academic Library architecture/data-model
decision), Phase 5B (`ChannelResource` model, migration, service, and
router), and Phase 5C (frontend upload flow, resource card/listing/detail UI)
are now all complete — see the Status Snapshot entries above,
`docs/ARCHITECTURE.md` § "Academic Library (Phase 5A)", and this file's 5B/5C
entries for the full implementation/verification breakdown. The Academic
Library resource feature is now end-to-end; all five `docs/ROADMAP.md`
Phase 5 boxes are now checked. Next: `docs/ROADMAP.md`'s Phase 6 — Exams &
Practice, or further Academic Library polish — needs a scoping decision
before starting.

## Completed Product Features
- **Phase 1A — Channel Foundation**: `Organization` extended with a
  `channel_type` field (`SCHOOL` | `INSTRUCTOR`, default `SCHOOL`) instead of
  a separate `Channel` table. See `docs/ARCHITECTURE.md` § Confirmed
  Decisions for the full rationale. Existing organizations, `UserOrganization`
  ownership, `/orgs/[slug]` public routing, and `ResourceAuthor` content
  links are all preserved unchanged. Custom domains are gated off for
  `INSTRUCTOR` channels (403). Migration:
  `652b0b59778d_add_channel_type_to_organization`. Full backend test suite
  passes (5257 passed, 29 skipped, 0 failed).
- **Phase 1B — Channel Creation & Profile**: No backend changes (`channel_type`
  already flowed through `create_org`). Frontend only:
  - New minimal creation page `app/(hub)/new-channel/page.tsx` (name,
    description, slug, School/Institution vs Teacher/Creator picker) —
    deliberately separate from the existing `/new` SaaS billing-onboarding
    wizard rather than reusing it, since plan/billing selection is out of
    scope for LearnOrbit V1. `/new` itself is untouched; `home.tsx`'s two
    entry points (org-less auto-redirect, "Create channel" button) now point
    at `/new-channel`.
  - `components/Objects/Channel/ChannelHeader.tsx`: name, channel-type badge,
    description/about, logo, and (authenticated members only, via the
    existing `/orgs/{id}/users` endpoint — there is no public members
    endpoint) creator name. Rendered at the top of `/orgs/[slug]`
    (`home-client.tsx`), which remains otherwise unchanged.
  - `dash/org/settings/[subpage]/page.tsx`: hides the "Other" tab
    (custom scripts + watermark) for `INSTRUCTOR` channels — the only
    settings tab judged clearly tenant/technical rather than
    creator-relevant. Existing `OrgEditGeneral`/`OrgEditBranding` already
    covered "basic channel management," so no changes there.
  - Verified: SCHOOL and INSTRUCTOR creation (API-level, ownership row
    confirmed `role_id=1`), `ChannelHeader` badge/icon switching between
    channel types (live in-browser), settings-tab gating (code review +
    lint, not live — see limitation below). ESLint clean; Phase 1A's
    `test_orgs_service*.py` suite still passes (99 passed).
- **Phase 1C — Channel Following**: A new `organizationfollow` table
  (`apps/api/src/db/organization_follows.py`, migration `7c8d9e0f1a2b`)
  records a roleless user→channel follow relationship — deliberately not
  `UserOrganization` (that carries a `Role`/membership, which following
  should not imply) and not a `Channel` table (channels remain
  `Organization`, per Phase 1A). Modeled directly on the existing
  `PlaygroundReaction` pattern: a `(org_id, user_id)` unique constraint plus
  an `IntegrityError` rollback guard for a racing double-follow, so
  duplicates are prevented at the database level, not just in application
  code.
  - Backend: `services/orgs/follows.py` (`follow_organization`,
    `unfollow_organization`, `get_follow_status`) and three endpoints on the
    existing `orgs` router — `GET/POST/DELETE /orgs/{org_id}/follow`. Follow
    and unfollow require authentication (401 for anonymous) and are
    idempotent (following twice / unfollowing when not following are
    no-ops, not errors). Neither endpoint accepts a `user_id` — the acting
    user is always taken from the authenticated session
    (`resolve_acting_user_id`), so a caller can only ever modify their own
    follow relationship. `GET` supports anonymous viewers (follower count is
    public; `is_following` is `false` for them).
  - Frontend: `ChannelHeader.tsx` gained a Follow/Following toggle
    (authenticated users only) and a follower-count label, backed by new
    `useOrgFollowStatus`/`useFollowOrg`/`useUnfollowOrg` hooks in
    `hooks/queries/useOrg.ts` (React Query, mirroring the existing
    `useOrgUsers` pattern) and `followOrganization`/`unfollowOrganization`
    in `services/organizations/orgs.ts`.
  - Verified: 18 new backend tests (10 service-level in
    `test_organization_follows_service.py`, 8 router-level appended to
    `test_orgs_router.py`) covering authenticated follow/unfollow, duplicate
    prevention, per-user isolation, follower count, anonymous 401s on
    follow/unfollow, and anonymous GET support. Full `test_orgs_service*.py`
    + `test_orgs_router.py` suites still pass (124 + 58 passed) — no
    regressions. Ruff (pinned to the CI version, 0.15.9) clean on all
    changed backend files. ESLint and `tsc --noEmit` clean on all changed
    frontend files. Not verified live in-browser: same local-dev
    multi-channel limitation as Phase 1B (see below) — the Follow button
    was code-reviewed against the existing `ChannelHeader` wiring rather
    than clicked in a running second channel.

- **Phase 2A — Video architecture decision**: no code changes. Full
  pre-implementation analysis found LearnHouse already has a complete video
  pipeline (upload, S3/local storage, HLS transcoding, AI captions,
  RBAC-gated streaming, a `video.js`-based player) — all wired to
  `Activity.course_id` → `Course`, with no standalone "channel video post"
  concept. Decision: add a new `ChannelVideo` table as a thin
  discovery/metadata layer (channel ownership, title/description/thumbnail,
  publish/visibility state, subject/topic/level/institution/resource-type
  metadata) referencing the existing `Activity` by integer FK
  (`ondelete="CASCADE"`, unique). `Activity` itself is not modified — it
  remains solely responsible for upload/storage/processing/streaming/HLS/
  captions. Full schema and cascade analysis: `docs/ARCHITECTURE.md` §
  "Videos (Phase 2A)".
- **Phase 2B — `ChannelVideo` model + migration**: `apps/api/src/db/channel_videos.py`
  (table `channelvideo`) plus migration
  `e77b30b9f1ec_add_channel_video_table`, exactly per the Phase 2A schema —
  `org_id` FK (`ondelete="CASCADE"`), unique `activity_id` FK
  (`ondelete="CASCADE"`), title/description/thumbnail, `published`/
  `visibility`, and the subject/topic/level/institution_context/resource_type
  metadata fields. `Activity` itself untouched.
- **Phase 2C — `ChannelVideo` API**: `apps/api/src/services/orgs/channel_videos.py`
  + five endpoints appended to the existing `orgs` router (`POST/GET
  /orgs/{org_id}/videos`, `GET/DELETE /orgs/{org_id}/videos/{channelvideo_id}`,
  `PUT .../publish`). Owner/admin-only create/publish/delete; `create`
  verifies the target `Activity` belongs to the same org and is
  `TYPE_VIDEO` before wrapping it (404 for cross-org or wrong-type, so a
  caller can't probe other orgs' activity ids); `get`/`list` show
  published+public posts to anyone, everything to this channel's
  owner/admins, and 403 (not 404) unpublished/unlisted posts to everyone
  else so a caller can't tell "doesn't exist" from "not visible to you."
  Deleting a `ChannelVideo` removes only the discovery post — the underlying
  `Activity` (upload/storage/HLS/captions) is left alone. 19 backend tests
  (5 model-level in `test_channel_video_model.py`, 14 service-level in
  `test_channel_videos_service.py`) — all passing. Ruff (pinned to the CI
  version, 0.15.9) clean.
- **Phase 2D — Standalone Video Watch Page**: `/videos/[channelvideoid]`
  (resolves under `app/orgs/[orgslug]/(withmenu)/videos/[channelvideoid]/`,
  same route-file convention as the existing course/activity page). No new
  player — reuses `VideoActivity`/`LearnHousePlayer` and `videoSource.ts`
  unchanged, the existing global shell (`OrgContext`, UI-1 sidebar/tab bar),
  and the Phase 1C follow hooks (`useOrgFollowStatus`/`useFollowOrg`/
  `useUnfollowOrg`) for the creator/channel row. New: `services/organizations/channelVideos.ts`
  + `hooks/queries/useChannelVideo.ts`, which chain three existing,
  unmodified endpoints client-side — `GET /orgs/{id}/videos/{id}` →
  `GET /activities/id/{activity_id}` → `GET /courses/id/{course_id}` — since
  `ChannelVideoRead` only carries numeric `activity_id`/`org_id`, not the
  string UUIDs the player needs. No backend changes were required; the two
  `/id/{int}` lookup endpoints already existed and already route through the
  same RBAC (`check_resource_access`) an anonymous course viewer goes
  through. States covered: loading (skeleton player + metadata), video not
  found (404 from the channel-video fetch), unpublished/inaccessible (403
  from the channel-video fetch, from the underlying Activity/Course RBAC
  check, or from the Activity itself being unpublished — course-level RBAC
  doesn't check that flag, so this page adds its own guard), and the normal
  loaded state. Follows `docs/DESIGN_SYSTEM.md` § 15 (16:9 player, full-bleed
  edge-to-edge on mobile / inset `--radius-lg` on desktop, academic metadata
  chips, channel-type badge per § 17).
  - Verified live end-to-end via the full dev stack (Postgres/Redis already
    running, API + `next dev` started for this session): created a real
    course → chapter → YouTube video activity → published `ChannelVideo`
    via direct API calls (same local-dev workaround as Phase 1B/1C — see
    limitation below), then exercised all states as both an anonymous
    visitor and an authenticated channel admin (draft-preview badge, Follow
    button). Caught and fixed a real bug this way: `getUriWithOrg(orgslug,
    '')` returns `''` in single tenancy, which stalled the "back to
    channel" link on the current page instead of navigating; both links now
    pass `'/'`. No console errors. ESLint and `tsc --noEmit` clean.
  - **Known limitation**: live mobile-viewport verification wasn't possible
    — same `resize_window` limitation already logged under UI-1 (does not
    actually shrink the rendered viewport in this environment). Mobile
    layout is code-reviewed against the design-system spec, not visually
    confirmed live.
  - **Explicitly out of scope for 2D** (per the task): the channel video
    listing/grid (delivered in Phase 2E, below) and the creator upload flow
    (delivered in Phase 2F, below).
- **Phase 2E — Channel Video Listing**: complete. New
  `components/Objects/Channel/ChannelVideosSection.tsx` +
  `ChannelVideoCard.tsx`, mounted on the existing classic channel landing
  page (`home-client.tsx`, below the Courses grid; custom landings
  untouched) — a "Videos" section showing this channel's `ChannelVideo`
  posts as a responsive card grid. Reuses the existing Phase 2C
  `ChannelVideo` API unchanged (`GET /orgs/{org_id}/videos`, via a new
  `listChannelVideos` service fn + `useChannelVideos` hook, following the
  same pattern as Phase 2D's `useChannelVideo`/`useChannelVideoActivity`);
  no backend, model, or migration changes. Clicking a card navigates to the
  existing Phase 2D watch page (`/videos/{id}`) via the established
  `getUriWithOrg` routing convention — no new navigation system. Published/
  unpublished visibility is entirely the existing backend's call (the list
  endpoint already returns published+public posts to anyone and everything
  to this channel's owner/admins); the frontend does no authorization
  filtering of its own, only labels admin-visible drafts with a "Draft"/
  "Unlisted" badge.
  - Verified live via the full dev stack, reusing the Phase 2D seeded
    `ChannelVideo`: populated grid (thumbnail placeholder, title,
    subject/topic/level chips, relative "Published X ago"), card click →
    Phase 2D watch page, empty-channel state (signed out, no published
    videos → "No videos yet"), and the authenticated-admin "Draft" badge on
    an unpublished post. No console errors. ESLint and `tsc --noEmit` both
    clean on all changed files.
  - **Known limitation**: live mobile/tablet viewport verification wasn't
    possible — same `resize_window` limitation already logged under UI-1
    and Phase 2D (does not actually shrink the rendered viewport in this
    environment). The grid's responsive breakpoints
    (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) are
    code-reviewed against the existing Courses grid's pattern, not visually
    confirmed live.
  - Duration is intentionally omitted from video cards — neither
    `ChannelVideoRead` nor `Activity` store it anywhere, so it isn't
    "already available" without adding a new per-card fetch.
- **Phase 2F — Creator Video Upload Flow**: complete. New
  `components/Objects/Channel/UploadChannelVideoModal.tsx` (form: video file,
  title, description, subject/topic/level/institution/resource-type,
  visibility, publish-now toggle), gated behind the existing
  `AuthenticatedClientElement` role check (`courses`/`create`) next to the
  "Upload video" trigger in `ChannelVideosSection.tsx` — real enforcement
  stays entirely server-side (see Authorization below), this only hides the
  control from viewers who can't use it. No new upload/storage/transcoding
  code anywhere: the flow reuses the existing hosted-video-activity upload
  (`createVideoActivityWithProgress`, XHR-based, real `onprogress`), the
  existing course/chapter creation endpoints, and the existing Phase 2C
  `ChannelVideo` create/publish endpoints, orchestrated client-side in a new
  `services/organizations/channelVideoUpload.ts` +
  `hooks/queries/useChannelVideoUpload.ts`.
  - **Hidden container course**: a video `Activity` always needs a
    `Course`/`Chapter` (confirmed in `docs/ARCHITECTURE.md` § "Videos
    (Phase 2A)" — "a video is always a lesson inside a structured course
    today"), and a LearnOrbit channel video isn't conceptually a course, so
    creator-facing course/chapter picking would be out of scope. Each
    channel instead lazily gets a single hidden "Channel Videos" container
    course on its first upload — found via an `extra_metadata` marker
    (`learnorbit_channel_container`, a plain JSONB field the `Course` model
    already has — no schema change), created on first use if none exists,
    then kept `public: true` + `published: true` so `check_resource_access` (the same
    RBAC an anonymous course viewer goes through) allows playback once a
    video is published. `home-client.tsx` filters this container out of the
    visible Courses grid by the same marker.
  - **Publish/draft**: the creator's draft/publish-now choice maps directly
    to the existing `ChannelVideo.published` + `PUT .../publish` (Phase 2C),
    unchanged. The underlying video `Activity`'s own `published` flag is now
    always set `true` at upload time regardless of that choice — the
    `Activity` is never reused outside its `ChannelVideo`, so its own
    publish state carries no independent meaning; `ChannelVideo`
    published/visibility remains the single real gate (see bug fix below).
  - **Upload states**: idle → uploading (real percentage via XHR
    `onprogress`, no fabricated progress) → a brief "Finishing up…" step
    once the request body hits 100% but before the server's create-`Activity`
    response returns (a real wait, not invented) → success (with a "View
    video" link to the Phase 2D watch page and an "Upload another" reset) or
    failure (inline error + "Try again", which resubmits the same
    still-populated form).
  - **Authorization**: verified live — anonymous `POST /orgs/1/videos` → 401;
    anonymous course creation → 403; a draft video is invisible to
    anonymous/non-admin viewers in both the channel listing and the Phase 2D
    watch page, visible (with a "Draft"/"Unlisted" badge) only to the
    channel's own admin. No authorization logic duplicated client-side —
    every check is the existing backend's.
  - Verified live end-to-end via the full dev stack, as the channel admin:
    a draft upload (progress → processing → success, hidden from anonymous
    viewers) and a separate publish-now upload (immediately public, visible
    to an anonymous `curl`, appears in the listing via React Query
    invalidation with no manual reload, card click opens its Phase 2D watch
    page). Used a synthetic-but-magic-byte-valid `.mp4` (`ftyp isom` header)
    since this environment has no `ffmpeg`/real video fixture — every step of
    the actual upload/creation/publish pipeline is real, only the video
    content itself is fake, so playback fidelity wasn't (and can't be)
    verified this way. No console errors. ESLint and `tsc --noEmit` clean on
    all changed files. No backend changes, so no backend tests to run.
  - **Bugs found and fixed during this verification**:
    1. The hidden container course was visibly leaking into the channel's
       public Courses grid — fixed with the `extra_metadata` filter in
       `home-client.tsx` (above).
    2. Phase 2D's watch page refused to render whenever the underlying
       `Activity` wasn't published, which — before the `Activity.published`
       fix above — silently blocked even the *admin* from previewing their
       own draft upload. Fixed entirely within Phase 2F's new code (no
       Phase 2D files touched).
  - **Local-dev limitation hit and worked around**: the test org's free
    plan had already reached LearnHouse's existing 1-course usage cap
    (`Usage Limit has been reached for Courses`, from
    `security/features_utils/usage.py`) from the Phase 2D-seeded course —
    a genuine pre-existing billing/plan limit, not a Phase 2F bug. Bumped
    this org's plan to `"pro"` directly in the local dev DB to unblock
    testing (a data change, not a code change) — matches the existing
    `LEARNHOUSE_SAAS=true` workaround already noted under Phase 1B/UI-1.
  - No thumbnail upload — `ChannelVideo.thumbnail_image` has no dedicated
    upload/storage mechanism of its own (unlike `Course.thumbnail_image`),
    so per the task's own "if the existing infrastructure supports it
    cleanly" it's left empty; already handled everywhere as missing
    metadata (Phase 2D/2E).
  - Two admins uploading for a channel's very first video at the exact same
    moment could each create a duplicate container course (no locking) —
    accepted as a V1 limitation rather than engineered around.
- **Phase 2G-1 — ChannelVideo Metadata Update Endpoint**: complete.
  `PUT /orgs/{org_id}/videos/{channelvideo_id}` (`services/orgs/channel_videos.py:
  update_channel_video`, router in `orgs.py`) lets a channel's owner/admins
  partially update title/description/subject/topic/level/institution_context/
  resource_type on an existing `ChannelVideo` — `exclude_unset` semantics, so
  an omitted field is left unchanged but an explicitly-sent empty string is
  applied (needed for the edit UI's "clear a field" case — see 2G-2). Same
  owner/admin-only enforcement as create/publish/delete
  (`_require_channel_admin`); a blank title is rejected (422). 6 new
  service-level tests added to `test_channel_videos_service.py` (partial
  update, blank-title rejection, non-admin/anonymous/cross-org-admin
  rejection) — file now 20 tests total; `test_channel_video_model.py`
  unchanged at 5. Re-ran both files: 25 passed, 0 failed.
- **Phase 2G-2 — Creator Metadata Edit UI**: complete.
  `UploadChannelVideoModal.tsx` gained a `mode: 'upload' | 'edit'` prop,
  reusing the existing upload form (title/description/subject/topic/level/
  institution/resource-type) to edit an existing `ChannelVideo`'s metadata
  through the new 2G-1 endpoint — no new form component. Triggered by a
  pencil icon on `ChannelVideoCard.tsx`, gated by the existing
  `AuthenticatedClientElement` (`courses`/`update` role check, same pattern
  as the Phase 2F upload trigger) — real enforcement is server-side (2G-1),
  this only hides the control from viewers who can't use it. New
  `useUpdateChannelVideo` hook (`hooks/queries/useChannelVideo.ts`)
  invalidates both the channel listing query (Phase 2E) and this video's own
  detail query (Phase 2D watch page) on success, so an edit shows up
  everywhere without a manual reload. Edit mode omits the file input,
  visibility selector, and publish toggle — not part of a metadata-only edit.
- **Phase 2G-3 — Subject/Topic/Level Filtering**: complete. Extends the
  existing `GET /orgs/{org_id}/videos` backend filter query params
  (unchanged — `subject`/`topic`/`level` already supported free-text
  exact-match filtering) into the channel listing UI; no new backend
  endpoint or migration. New `services/organizations/channelVideoFilters.ts`
  (pure helpers: `normalizeChannelVideoFilters`, `buildChannelVideoQueryParams`,
  `getChannelVideoFilterOptions`; TDD, 8 unit tests in
  `tests/channel-video-filters.test.mjs`). `listChannelVideos`/
  `useChannelVideos` now accept an optional filters object, folded into the
  React Query key so each filter combination — and the unfiltered baseline —
  caches independently, sharing one entry/network call when no filter is
  active. `queryKeys.channelVideos.list` updated to key on filters while
  staying invalidation-compatible with existing `list(orgId)` callers
  (prefix match). `ChannelVideosSection.tsx` gained Subject/Topic/Level
  `Select` dropdowns (options derived client-side from the channel's own
  unfiltered video list, since these are free-text fields with no backend
  distinct-values endpoint), a Clear filters action, and a dedicated "No
  matching videos" empty state distinct from the normal "No videos yet"
  state.
  - Verified live via the full dev stack against the channel's real seeded
    videos (Mathematics/Biology subjects): Subject/Topic/Level filtering
    individually and combined, Clear filters restoring the full listing, and
    a no-match combination correctly rendering "No matching videos" — all
    confirmed in-browser with no console errors. ESLint and the full
    `bun test tests` suite clean on all changed/new files (pre-existing,
    unrelated failures in `billing-internal-key.test.mjs`/
    `catalog-pagination.test.mjs`/an `ar.json` coverage timeout are untouched
    by this change). `tsc --noEmit` is blocked repo-wide by a pre-existing
    `tsconfig.json` `baseUrl`-deprecation issue (installed TypeScript 6.0.3
    vs. config), unrelated to this change.
  - **Known limitation**: the zero-video "No videos yet" state (no active
    filters, zero total videos) was not independently browser-verified. The
    only local seed user is this channel's own admin, who sees every video
    including drafts regardless of publish state, so reaching a genuinely
    empty channel would have required deleting the channel's real seeded
    `ChannelVideo` rows — a destructive local data change that was avoided
    rather than forced through. This is the pre-existing, unmodified "No
    videos yet" JSX branch (unchanged from Phase 2E, now gated by the same
    `hasActiveFilters` check already proven correct via the "No matching
    videos" case above), so risk is low, but it remains unverified live.
- **Phase 2G-4 — ChannelVideo Thumbnail Upload: DEFERRED** (not failed, not
  blocked). Investigation only — no code changes. Findings: LearnHouse
  already has a clean, reusable thumbnail storage abstraction
  (`services/utils/upload_content.py: upload_file`/`upload_content`, with
  `security/file_validation.py` handling MIME-sniffing/size/safe-filename
  validation), used identically by every other content type (courses,
  folders, boards, playgrounds, communities, podcasts/episodes) via a
  ~10-line per-type wrapper plus one `getXThumbnailMediaDirectory()`
  frontend helper. `ChannelVideo.thumbnail_image` already has its DB column;
  nothing currently sets or serves it (no upload endpoint exists yet, and
  `ChannelVideoCard.tsx`'s `<img src={thumbnail_image}>` doesn't go through
  a media-directory URL helper the way every other content type does).
  Reuse is confirmed clean and low-risk whenever this is picked up.
  **Deferred, not implemented now**, because: the existing thumbnail
  infrastructure is reusable without new plumbing, but thumbnails are
  creator-polish scope — no other Phase 2 unit (listing, filtering, the
  watch page) depends on them, so building it now would be scope beyond what
  Phase 2's educational-video functionality actually requires. Revisit in a
  dedicated creator/UI polish phase, where it can also fix the
  `ChannelVideoCard` media-URL gap it surfaces.
- **Phase 6A (Exams & Practice architecture decision): complete** —
  documentation only, no code. See `docs/ARCHITECTURE.md` § "Exams & Practice
  (Phase 6A)" for the full decision. Two roadmap items ("Question bank",
  "Exam practice") were ambiguous enough to be consequential for schema
  design, so scope was confirmed with the user before deciding: "Question
  bank" means a real, reusable pool of questions tagged by subject/topic/
  level, pullable into more than one quiz; "Exam practice" means a distinct
  timed session that can mix questions from across the bank/multiple quizzes
  into one combined-score attempt. Summary of the decision:
  - New, purpose-built `Question`/`Quiz`/`QuizQuestion`/`QuizAttempt`/
    `QuizAnswer` domain — **not** a repurposed `Assignment`/`AssignmentTask`
    (LearnHouse's existing quiz-capable assignment engine, investigated in
    depth) and **not** a thin `Activity`-wrapping layer like `ChannelVideo`/
    `ChannelResource`. `AssignmentTask` has no cross-assignment identity (a
    hard blocker for a real question bank) and `Assignment` is hard-wired to
    `Course`/`Chapter`/`Activity`, which Exam Practice's cross-quiz question
    mixing has no natural shape for either.
    Channel-scoped throughout (`org_id` FK, `_require_channel_admin` RBAC),
    matching the established channel-content pattern.
  - `Quiz.quiz_type` (`"standard"` | `"exam_practice"`) is one entity
    covering both roadmap items, not two near-identical tables — the same
    plain-string-discriminator convention as `ChannelVideo.content_format`
    (Phase 3A).
  - `QuizAttempt` deliberately has no unique-per-`(user, quiz)` constraint
    (every attempt is its own row, unlike `AssignmentUserSubmission`'s
    reset-in-place pattern) — "Results" and "Basic progress tracking" both
    need attempt history, not just a latest-attempt snapshot.
  - "Basic progress tracking" is scoped as a read-only aggregation over
    `QuizAttempt`/`QuizAnswer` in a later increment, not a new table —
    `TrailRun`/`TrailStep` (existing course-completion tracking) was
    investigated and confirmed unrelated (no notion of a quiz attempt or
    score).
  - A new question/attempt-grading visibility gate is needed (no existing
    precedent fits): `is_correct`/`explanation` must be stripped from any
    question payload served before that user's own `QuizAttempt` reaches
    `"graded"` — stricter than `Assignment.show_correct_answers`'s opt-in
    toggle, since the confirmed scope has no "hide forever" mode.
  - Explicitly deferred to 6B onward: all model files, migrations,
    service/router layers, and every frontend surface. AI-assisted question
    generation, cross-channel question sharing, and manual/partial-credit
    grading are out of scope for Phase 6 entirely (no ROADMAP/PRD signal;
    confirmed scope is auto-gradable question types only).
- **Phase 6B (`Question` bank model + migration + service + router):
  complete.** Implements exactly the Phase 6A decision's `Question` table —
  `Quiz`/`QuizQuestion`/`QuizAttempt`/`QuizAnswer` are separate, later
  increments (6B only needed `Question` to exist as its own unit; a `Quiz`
  can't reference bank items that don't exist yet).
  - **Backend**: `db/questions.py` (`Question` model — `org_id` FK CASCADE,
    `question_type` plain string, `contents` JSON payload, `explanation`,
    `published`, subject/topic/level/institution_context, matching the
    `ChannelResource` field-convention exactly) + migration
    `e8861c4dd570_add_question_table` (chained onto `5d1f971f786d`) +
    `services/orgs/questions.py` (`create_question`/`list_questions`/
    `get_question`/`update_question`/`set_question_published`/
    `delete_question`, mirroring `channel_resources.py`'s structure) + six
    endpoints on the existing `orgs` router (`POST/GET
    /orgs/{org_id}/questions`, `GET/PUT
    /orgs/{org_id}/questions/{question_id}`, `PUT
    .../questions/{question_id}/publish`, `DELETE
    .../questions/{question_id}`).
  - **Admin-only end to end, unlike `ChannelVideo`/`ChannelResource`**: per
    the Phase 6A decision, a bank item is never listed or read by a
    non-admin directly — `list_questions`/`get_question` both call
    `_require_channel_admin` unconditionally (no public/admin branch).
    Non-admin access to quiz content is deferred to the `Quiz`-serving layer
    (6D+), which will strip `is_correct`/`explanation` per the 6A visibility
    gate — not built yet, so there is currently no non-admin-reachable path
    to a `Question` at all.
  - **Validation**: `question_type` is restricted to a fixed set
    (`multiple_choice`/`short_answer`/`number_answer`, the three
    auto-gradable types from the 6A decision) — 422 otherwise; blank
    `prompt` rejected (422) on create and on update, mirroring
    `update_channel_resource`'s blank-title check.
  - **Tests (TDD-verified)**: 4 new model tests
    (`test_question_model.py` — defaults, `contents` default-empty-dict,
    the `org_id` CASCADE FK, cascade-delete-on-org-delete) + 22 new service
    tests (`test_questions_service.py` — creation/validation, admin-only
    listing + subject/topic/level/published filtering, admin-only get,
    publish/unpublish authorization, deletion authorization, partial
    update, cross-org 404 isolation for get/update/publish/delete). All 26
    passing. Scoped regression (`test_orgs_router.py` +
    `test_channel_resources_service.py` + `test_channel_resource_model.py`,
    to catch any import/router-mounting breakage from adding the new
    endpoints alongside Phase 5B's): **111 passed, 0 failed.** Ruff (pinned
    0.15.9, via `uvx ruff@0.15.9`) clean on every changed/new backend file
    including the migration.
  - **Migration verified against the real local Postgres** (`uv run
    alembic upgrade head` → `downgrade -1` → `upgrade head` again, all
    clean; `alembic heads` confirmed a single head throughout). Caught and
    fixed a real bug during this verification: the migration's first-picked
    revision id (`a1b2c3d4e5f6`) collided with an existing, unrelated
    migration (`add_sso_connection`) already in the repo — `alembic
    current`/`heads` surfaced a "Revision … is present more than once"
    warning immediately. Regenerated a fresh, collision-checked id
    (`e8861c4dd570`) before applying anything; the colliding file was never
    applied to the database.
  - **No frontend changes** — bank authoring UI is a separate, later
    increment (deferred, tracked below).
  - **Known limitation**: no router-level tests were added (mirrors Phase
    5B's own precedent — `test_orgs_router.py` has no `ChannelResource`
    router tests either; this codebase's established pattern for these
    channel-content endpoints is service-level testing, router mounting
    checked only via the scoped regression run above). Live browser
    verification not applicable — no frontend surface exists yet for this
    increment.
- **Phase 6C (`Quiz`/`QuizQuestion` model + migration + service + router):
  complete.** Implements exactly the Phase 6A decision's `Quiz`/
  `QuizQuestion` tables — attempt-taking (`QuizAttempt`/`QuizAnswer`) is a
  separate, later increment (6D); this increment is authoring only.
  - **Backend**: `db/quizzes.py` (`Quiz` — `org_id` FK CASCADE, `quiz_type`
    plain-string discriminator `"standard"`/`"exam_practice"`,
    `time_limit_minutes`, `pass_threshold_percentage`, published/visibility/
    subject/topic/level/institution_context matching `ChannelResource`'s
    field convention; `QuizQuestion` — ordered join, `UniqueConstraint
    (quiz_id, question_id)`, both FKs CASCADE) + migration
    `685b648bce80_add_quiz_tables` (chained onto `e8861c4dd570`) +
    `services/orgs/quizzes.py` (`create_quiz`/`list_quizzes`/`get_quiz`/
    `update_quiz`/`set_quiz_published`/`delete_quiz`, plus
    `list_quiz_questions`/`attach_question_to_quiz`/
    `detach_question_from_quiz`/`reorder_quiz_questions`) + ten endpoints on
    the existing `orgs` router (`POST/GET /orgs/{org_id}/quizzes`, `GET/PUT
    /orgs/{org_id}/quizzes/{quiz_id}`, `PUT
    .../quizzes/{quiz_id}/publish`, `DELETE .../quizzes/{quiz_id}`, `GET/POST
    .../quizzes/{quiz_id}/questions`, `PUT
    .../quizzes/{quiz_id}/questions/reorder`, `DELETE
    .../quizzes/{quiz_id}/questions/{question_id}`).
  - **`Quiz` list/get visibility mirrors `ChannelResource`** (published+
    public predicate for non-admins, admins see everything) — this is only
    quiz *metadata* (title/description/subject/etc.), harmless to expose
    publicly. **The attached-questions endpoint
    (`list_quiz_questions`/`GET .../questions`) is admin-only regardless of
    the quiz's published state**, per the 6A decision — it returns each
    `Question`'s full `contents` including the answer key, mirroring the
    Question bank's own admin-only-everything pattern. There is currently
    no non-admin-reachable path to a quiz's actual questions or answer key
    at all (the safe, answer-stripped path is 6D's attempt-taking
    endpoint, not built yet).
  - **Attach validation**: the `question_id` must belong to this quiz's own
    `org_id` (404 on cross-org, same anti-enumeration shape as Phase 5B's
    cross-org `activity_id` check) and be `published` (409 otherwise, per
    the 6A decision that only published bank items are quiz-eligible);
    duplicate attach is 409. New questions append to the end of the
    existing order (`max(order) + 1`, 0 if none).
  - **Reorder is whole-set, not a partial move**: the request body must
    contain exactly the quiz's currently-attached `question_id`s (422 on
    any missing/extra/unknown id) with no duplicates (422) — chosen over a
    single-item move-to-position endpoint since a full-list reorder is what
    a drag-and-drop authoring UI naturally produces in one request.
  - **`question_count`** is added to `QuizRead` (populated by the read
    service from a grouped `QuizQuestion` count query, not stored on the
    row — same "populated by the read service" convention as
    `AssignmentRead.course_uuid`) so a channel's quiz list/card can show how
    many questions a quiz has without a second round-trip.
  - **Deletion**: `delete_quiz` relies on the migration's `ON DELETE
    CASCADE` (`quizquestion.quiz_id → quiz.id`) to remove attached
    `QuizQuestion` rows — verified against the real local Postgres (which
    enforces FKs by default); the corresponding service test explicitly
    sets `PRAGMA foreign_keys=ON` for the async SQLite test engine, which
    doesn't enforce FKs by default (same convention already established in
    `test_channel_resource_model.py`). The underlying `Question` bank items
    are never touched by deleting or detaching from a quiz.
  - **Tests (TDD-verified)**: 7 new model tests (`test_quiz_model.py` —
    `Quiz` defaults, `QuizQuestion` creation/ordering, the
    `(quiz_id, question_id)` uniqueness constraint, both FKs' CASCADE
    configuration, and cascade-delete in both directions — deleting a quiz
    removes its `QuizQuestion` rows; deleting a question removes its
    `QuizQuestion` rows but leaves the quiz itself intact) + 29 new service
    tests (`test_quizzes_service.py` — creation/validation incl.
    `exam_practice`'s `time_limit_minutes`, admin-vs-public listing +
    metadata/`quiz_type` filtering + `question_count`, get visibility,
    publish/unpublish, deletion + cascade, partial update, attach (admin-
    only, unpublished-question 409, cross-org 404, duplicate 409, append
    ordering), admin-only ordered listing (answer key included), detach
    (admin-only, 404 on a never-attached pair, leaves the question intact),
    reorder (admin-only, applies the new order, rejects a
    mismatched/incomplete set, rejects duplicates), and cross-org 404
    isolation for get/update/publish/delete). All 36 passing. Scoped
    regression (`test_orgs_router.py` + every Phase 5B/6B test file, to
    catch any import/router-mounting breakage from adding ten more
    endpoints alongside 5B's and 6B's): **169 passed, 0 failed.** Ruff
    (pinned 0.15.9, via `uvx ruff@0.15.9`) clean on every changed/new
    backend file including the migration.
  - **Migration verified against the real local Postgres** (`uv run
    alembic heads` confirmed a single head before applying — the id
    collision caught during 6B made this an explicit pre-flight check going
    forward, not just an incidental one; `upgrade head` → `downgrade -1` →
    `upgrade head` again, all clean).
  - **No frontend changes** — authoring UI (bank + quiz + question picker)
    is a separate, later increment (6E, deferred, tracked in Next Actions).
  - **Known limitation**: no router-level tests, matching the established
    precedent for these channel-content endpoints (Phase 5B, 6B) — service-
    level testing plus the scoped router-mounting regression run above.
    Live browser verification not applicable — no frontend surface exists
    yet for this increment.
- **Phase 6D (`QuizAttempt`/`QuizAnswer` model + migration + service +
  router — attempt-taking + auto-grading): complete.** Implements exactly
  the Phase 6A decision's `QuizAttempt`/`QuizAnswer` tables, plus the two
  concrete decisions the 6A spec left open — see `docs/ARCHITECTURE.md` §
  "Exams & Practice (Phase 6D)" for the full write-up.
  - **Backend**: `db/quiz_attempts.py` (`QuizAttempt` — `quiz_id`/`user_id`
    FKs CASCADE, `status` `"in_progress"`/`"submitted"`/`"graded"`,
    `score_percentage`, `attempt_number`, `started_at`/`submitted_at`;
    `QuizAnswer` — `UniqueConstraint(quizattempt_id, question_id)`, both FKs
    CASCADE) + migration `f4c9a2b7e6d1_add_quiz_attempt_tables` (chained
    onto `685b648bce80`) + `services/orgs/quiz_attempts.py`
    (`start_quiz_attempt`/`get_quiz_attempt`/`submit_quiz_attempt`) + three
    endpoints on the existing `orgs` router (`POST
    /orgs/{org_id}/quizzes/{quiz_id}/attempts`, `GET
    .../attempts/{attempt_id}`, `POST .../attempts/{attempt_id}/submit`).
  - **Auto-grading contract**: `multiple_choice` answer
    `{"selected_option_id"}` matched against `contents.options[].is_correct`;
    `short_answer` answer `{"text"}` matched case-insensitively/trimmed
    against `contents.accepted_answers`; `number_answer` answer `{"value"}`
    matched by float equality against `contents.accepted_answers`. No
    partial credit; an unanswered/unparseable/unrecognized-type question
    grades `is_correct: false`. `score_percentage` is `correct / total *
    100` (`0.0` for a zero-question quiz, no divide-by-zero).
  - **Leak-prevention gate**: `_strip_question` removes `options[].
    is_correct`, omits `explanation`, and — extending 6A's stated rule,
    which only named the `multiple_choice` case — also removes
    `accepted_answers` wholesale for `short_answer`/`number_answer`, since
    that field *is* the answer key for those types. Applied on
    `start_quiz_attempt`'s returned questions and on `get_quiz_attempt`
    while `status != "graded"`; lifted only in `submit_quiz_attempt`'s
    response and a subsequent graded `get_quiz_attempt`, and only for that
    attempt's own user.
  - **Access rules**: starting an attempt requires authentication (401
    anon) and the quiz must be published+public, unless the acting user is
    this channel's own admin previewing their own draft (`is_org_admin`
    checked fresh each call, not cached). Getting/submitting an attempt is
    owner-only (`QuizAttempt.user_id` vs. the acting user — 403 "You can
    only access your own quiz attempts" on mismatch, matching
    `channel_video_comments.py`'s own-resource-403 convention; attempt
    existence itself isn't cross-org-sensitive so this is 403 not 404).
    Resubmitting an already-`"graded"` attempt is 409. A submitted
    `question_id` not attached to the quiz, or a duplicate `question_id` in
    one submission, is 422.
  - **No "list my attempts" endpoint** — deliberately deferred to 6G
    (Results), which needs the same query for attempt history; adding it
    here would be scope creep ahead of that increment actually needing it.
  - **Tests (TDD-verified)**: 7 new model tests (`test_quiz_attempt_model.py`
    — `QuizAttempt`/`QuizAnswer` defaults, the `(quizattempt_id,
    question_id)` uniqueness constraint, both tables' FK CASCADE
    configuration, and cascade-delete in both directions) + 13 new service
    tests (`test_quiz_attempts_service.py` — anonymous/unpublished-quiz
    start rejection, admin own-draft preview, answer-key stripping +
    `attempt_number` increment on start, get ownership + in-progress-vs-
    graded shape, grading all three question types incl. an
    unanswered-question case, submit ownership, resubmission 409, unknown/
    duplicate `question_id` 422, and post-grade full-detail retrieval). All
    20 passing. Scoped regression (`test_question_model.py`,
    `test_quiz_model.py`, `test_questions_service.py`,
    `test_quizzes_service.py` — the existing Phase 6B/6C suite, to catch any
    import/router-mounting breakage from adding three more endpoints): 58
    passed, 0 failed. Ruff (pinned 0.15.9, via `uvx ruff@0.15.9`) clean on
    every changed/new backend file including the migration.
  - **Migration verified against the real local Postgres** (`upgrade head`
    → `downgrade -1` → `upgrade head` again, all clean; single-head
    pre-flight check per the 6C-established convention).
  - **No frontend changes** — student quiz-taking UI wired to these
    endpoints is 6E (deferred, tracked in Next Actions).
  - **Known limitation**: no router-level tests, same established precedent
    as 5B/6B/6C. Live browser verification not applicable — no frontend
    surface exists yet for this increment.
- **Phase 6E-1 (Question Bank admin authoring UI): complete.** First of the
  three Phase 6E frontend surfaces (bank authoring / quiz authoring / student
  quiz-taking — see Phase 6A/6D's stated dependency order); split out as its
  own increment per `CLAUDE.md`'s small-increments rule rather than building
  all of 6E in one pass. Quiz authoring and student quiz-taking UI remain
  unbuilt — tracked as 6E-2/6E-3 in Next Actions.
  - **Frontend**: `services/organizations/questions.ts` (list/get/create/
    update/setPublished/delete against the six Phase 6B endpoints, mirroring
    `channelResources.ts`'s fetch + `RequestBodyWithAuthHeader` +
    `errorHandling` pattern) + `services/organizations/questionFilters.ts`
    (pure, unit-tested filter helpers — `subject`/`topic`/`level`/
    `institution_context`/`published` as server-side query params;
    `question_type` has no server-side filter on `GET .../questions`, so
    `applyQuestionTypeFilter` applies it client-side over the fetched list) +
    `hooks/queries/useQuestion.ts` (`useQuestions`/`useQuestion` queries,
    gated on having an access token since this endpoint is admin-only end to
    end and always 401s anonymously; `useCreateQuestion`/`useUpdateQuestion`/
    `useSetQuestionPublished`/`useDeleteQuestion` mutations, all invalidating
    `queryKeys.questions.list`/`.detail`) + `components/Objects/Dash/
    QuestionFormModal.tsx` (create/edit modal, `question_type`-conditional
    fields — multiple-choice option rows with a single-correct toggle,
    client-side validated to ≥2 options and exactly one correct since the
    backend doesn't validate `contents` shape beyond `question_type`; repeatable
    accepted-answers inputs for short/number-answer, number-typed and
    numeric-validated for `number_answer`) + `app/orgs/[orgslug]/dash/
    questions/{page,client}.tsx` (new dash route — search, subject/level/
    institution/type/published filters, publish-toggle switch, edit modal,
    `ConfirmationModal`-gated delete) + a new "Question bank" sidebar entry in
    `DashLeftMenu.tsx` (unconditional, alongside Courses/Assignments — no
    feature flag exists for this content type, unlike Library/Communities/
    Podcasts/Boards/Playgrounds's `show*`-gated entries).
  - **Modeled on `dash/courses/{page,client}.tsx`, not on
    ChannelResource/ChannelVideo's sections** — research this session found
    the Resource/Video card+section pattern has no delete/publish-toggle UI
    at all (upload/edit only), so `dash/courses` is the only existing
    full-CRUD admin content-management precedent in the repo.
  - **RBAC**: reuses `AuthenticatedClientElement`'s existing `ressourceType=
    "courses"` piggyback (same precedent as Resources/Videos) for create/
    update/delete gating — there is no dedicated backend right for
    `questions`/`quizzes`, and adding one was out of scope for a
    frontend-only increment.
  - **Tests**: 14 new unit tests (`tests/question-filters.test.mjs`,
    mirroring `channel-resource-filters.test.mjs`) covering
    `normalizeQuestionFilters` (incl. `published`'s tri-state — not
    empty-string-droppable like the string filters), `buildQuestionQueryParams`,
    `getQuestionFilterOptions`, and `applyQuestionTypeFilter`. All 14 passing.
    ESLint (`lint:strict`) clean on every new/changed file. `tsc --noEmit`
    clean repo-wide. Full `bun test tests` run: 137 passed / 13 failed / 2
    errors — the failures are pre-existing and unrelated to this increment
    (`tests/billing-internal-key.test.mjs`'s mocked-fetch assertions,
    `tests/catalog-pagination.test.mjs` importing a since-renamed module, and
    `tests/rtl-guard.test.mjs`'s `ar.json` coverage test timing out at 5s) —
    none of these files were touched by this increment.
  - **Live verification (backend contract, this session)**: browser/UI
    verification could not be performed at implementation time — the Chrome
    extension (`claude-in-chrome`) was not connected in this session yet. As
    a substitute, the full backend contract this frontend integrates against
    was exercised live end-to-end via direct API calls against a running
    `npx learnhouse dev` instance (login, create `multiple_choice` and
    `number_answer` questions, list with `subject`/`published=true`/
    `published=false` filters, get, partial update, publish, delete, and a
    post-delete 404) — every request/response shape matched what
    `services/organizations/questions.ts` sends/expects.
  - **Live verification (actual UI, same session, once the extension
    connected)**: logged in as the local test admin via the real `/login`
    form, navigated to `/dash/questions`, and exercised the full UI: empty
    state; create modal for `multiple_choice` (option add/remove, single-
    correct toggle) and `short_answer` (accepted-answer add/remove); list
    view with type/subject/level/draft badges and search/filter dropdowns;
    publish-toggle switch (draft badge disappears, switch flips); edit modal
    prefill; delete via `ConfirmationModal` (toast, row removed, list falls
    back to empty state). No console errors, no visual regressions. One
    pre-existing platform behavior encountered and worked around for
    verification only (not a code change): a first-run onboarding overlay
    (`useOnboarding`'s `lh_onboarding` `localStorage` key) covered the page
    content on first visit — dismissed via `localStorage` for this browser
    profile, unrelated to Phase 6E-1/6E-2 code.
  - **Known limitation — local dev credentials**: the only seeded local user
    (`phase2dtester@example.com`, id 3, admin of the "default" org) had no
    recorded password from whatever earlier session created it. Its password
    was reset directly in the local dev Postgres container
    (`learnhouse-db-dev`) to a new Argon2 hash (via `security_hash_password`)
    solely to obtain a login for this verification — local dev database only,
    reversible, no production/shared system touched. Recorded here since it's
    a state change future sessions should know about, not because it's out
    of the ordinary risk-wise.
  - **Doc addendum**: `docs/UI_UX_IMPLEMENTATION_PLAN.md` UI-10's "Main
    screens/components" line updated to name question-bank/quiz authoring
    explicitly — the doc predated the Phase 6A/6D architecture decisions and
    didn't mention Phase 6 at all.
- **Phase 6E-2 (Quiz authoring UI — metadata CRUD + question picker/attach/
  reorder/detach): complete.** Second of the three Phase 6E frontend
  surfaces; builds on 6E-1's bank authoring UI, which is what makes
  published questions available to pick from. Student quiz-taking UI
  remains unbuilt — tracked as 6E-3 in Next Actions.
  - **Frontend**: `services/organizations/quizzes.ts` (list/get/create/
    update/setPublished/delete for `Quiz` metadata, plus
    listQuizQuestions/attachQuestionToQuiz/reorderQuizQuestions/
    detachQuestionFromQuiz for the `QuizQuestion` join, mirroring
    `questions.ts`'s fetch + `RequestBodyWithAuthHeader` + `errorHandling`
    pattern against all ten Phase 6C endpoints) + `services/organizations/
    quizFilters.ts` (pure, unit-tested filter helpers — inverse split from
    `questionFilters.ts`: `subject`/`topic`/`level`/`institution_context`/
    `quiz_type` are server-side query params on `GET .../quizzes`, which has
    no `published` filter, so `applyPublishedFilter` applies it client-side)
    + `hooks/queries/useQuiz.ts` (`useQuizzes`/`useQuiz` — public-capable
    like `useChannelResources`, no access-token gate, unlike
    `useQuestions`'s always-admin-only endpoint; `useCreateQuiz`/
    `useUpdateQuiz`/`useSetQuizPublished`/`useDeleteQuiz`; and a second
    group — `useQuizQuestions`/`useAttachQuestionToQuiz`/
    `useReorderQuizQuestions`/`useDetachQuestionFromQuiz` — for the
    admin-only attached-questions builder view, whose mutations also
    invalidate the parent quiz's query since attach/detach changes its
    `question_count`).
  - **`components/Objects/Dash/QuizFormModal.tsx`** — create/edit modal for
    quiz metadata (title/description/quiz_type/visibility/subject/topic/
    level/institution_context/pass_threshold_percentage), mirroring
    `QuestionFormModal`'s structure; `time_limit_minutes` is only shown when
    `quiz_type="exam_practice"` (client + server both reject a non-positive
    value).
  - **`components/Objects/Dash/QuestionPickerModal.tsx`** — the question
    picker: lists this channel's *published* bank questions (`useQuestions`
    filtered to `published: true`, only fetched once the picker is opened),
    excludes ones already attached to this quiz, search-filters by prompt,
    attaches on click via `useAttachQuestionToQuiz`. Reused as-is from
    within the quiz builder page rather than being quiz-list-specific.
  - **`app/orgs/[orgslug]/dash/quizzes/{page,client}.tsx`** — the quiz list
    (mirrors `dash/questions`'s list: search, subject/level/institution/
    quiz_type/published filters, publish-toggle switch, edit modal,
    `ConfirmationModal`-gated delete), each row linking into:
  - **`app/orgs/[orgslug]/dash/quizzes/[quizid]/{page,client}.tsx`** — the
    quiz builder: quiz header + edit action, attached-questions list in
    order with move-up/move-down buttons (each recomputes the full
    `question_ids` order and calls the whole-set `reorder` endpoint — there
    is no partial-move endpoint per the 6C decision) and a remove (detach)
    button, plus the question picker to add more. No drag-and-drop library
    was added — move buttons reuse the existing whole-set reorder contract
    with no new dependency.
  - Added a "Quizzes" sidebar entry in `DashLeftMenu.tsx` (unconditional,
    alongside the Phase 6E-1 "Question bank" entry — same no-feature-flag
    rationale).
  - **RBAC**: reuses `AuthenticatedClientElement`'s `ressourceType="courses"`
    piggyback throughout (create/update/delete on quizzes, update on
    attach/reorder/detach) — same precedent as 6E-1, no dedicated backend
    right exists for `quizzes`/`questions`.
  - **Tests**: 13 new unit tests (`tests/quiz-filters.test.mjs`, mirroring
    `question-filters.test.mjs`) covering `normalizeQuizFilters`,
    `buildQuizQueryParams`, `getQuizFilterOptions`, and
    `applyPublishedFilter`. All 13 passing (150/150 relevant, up from 137 in
    6E-1). ESLint (`lint:strict`) clean on every new/changed file. `tsc
    --noEmit` clean repo-wide. Full `bun test tests`: 150 passed / 13 failed
    / 2 errors — the same pre-existing, unrelated failures already logged in
    the 6E-1 entry above (none of those files touched here either).
  - **Live verification (backend contract, implementation-time)**: same
    substitute as 6E-1 — the Chrome extension wasn't connected yet at
    implementation time, so the full backend contract was exercised live
    end-to-end against the still-running `npx learnhouse dev` instance:
    create two published bank questions, create an `exam_practice` quiz with
    a time limit, list with a `subject` filter, partial update, attach both
    questions (confirming append ordering), list attached questions ordered,
    reorder (reversed and confirmed the new order), get (confirming
    `question_count` reflects the attachments), publish, detach one, delete
    the quiz, then clean up the two questions. Every request/response shape
    matched what `services/organizations/quizzes.ts` sends/expects.
  - **Live verification (actual UI, follow-up session, extension
    connected)**: exercised the full quiz builder UI at `/dash/quizzes`:
    empty state; create modal including the `quiz_type`-conditional
    `time_limit_minutes` field (hidden for `standard`, appears for
    `exam_practice`); list view with type/subject/question-count/time-limit/
    draft badges; the builder page (`/dash/quizzes/[quizid]`) — question
    picker correctly listing only published, not-yet-attached bank questions
    and excluding them once added (toast feedback, "no more questions"
    empty state verified after exhausting the bank); attached-question list
    with live order numbers; move-up/move-down reorder confirmed with two
    real questions (order flipped correctly, boundary buttons correctly
    disabled at each end); detach (toast, count updates, parent quiz's
    `question_count` invalidated); publish toggle; edit modal prefill
    (including the conditional time-limit field on an existing
    `exam_practice` quiz); delete via `ConfirmationModal`. No console errors.
    Both 6E-1's and 6E-2's UI are now live-verified — no outstanding gap on
    that front for either increment.
- **Phase 6E-3 (Student quiz-taking UI — start/answer/submit/results): complete.**
  Last of the three Phase 6E frontend surfaces; builds on 6E-1 (bank
  authoring) and 6E-2 (quiz authoring), wired to the Phase 6D attempt-taking
  backend. Deliberately excludes the `exam_practice` timer UI (6F, needs
  this increment first) and a student-facing attempt-history/progress view
  (6G/6H, need a "list my attempts" endpoint not built in 6D).
  - **Frontend**: `services/organizations/quizAttempts.ts`
    (startQuizAttempt/getQuizAttempt/submitQuizAttempt against the three
    Phase 6D endpoints, mirroring the existing service-layer fetch +
    `RequestBodyWithAuthHeader` + `errorHandling` pattern; typed
    `AttemptQuestion` distinctly from the admin-facing `Question` type since
    the wire shape genuinely differs — no `is_correct` on options, no
    `accepted_answers` key — per the 6D leak-prevention gate) +
    `hooks/queries/useQuizAttempt.ts` (`useQuizAttempt` query with
    `staleTime: Infinity` — an attempt's question set is fixed once started
    and a graded attempt never changes again, so there's no reason to
    refetch on focus/mount like the list/detail queries elsewhere;
    `useStartQuizAttempt`/`useSubmitQuizAttempt` mutations, both seeding the
    attempt's own query-cache entry directly via `setQueryData` since the
    response *is* the freshly-authoritative attempt — no separate
    invalidate-then-refetch round trip needed).
  - **`components/Objects/Channel/QuizCard.tsx` + `ChannelQuizzesSection.tsx`**
    — public discovery: an "Exam card" (`docs/DESIGN_SYSTEM.md` §13 —
    icon → title → subject/level/exam-practice chips → question count +
    time limit → "Start" action) in a new public "Quizzes" section on the
    channel home page, mirroring `ChannelResourcesSection`'s structure and
    reusing 6E-2's `quizFilters.ts`/`useQuizzes` as-is (already
    public-capable — published+public for anon/non-admin viewers, everything
    for this channel's admins, enforced server-side). Read-only: no
    upload/create trigger, since authoring lives entirely in `/dash/quizzes`.
  - **`app/orgs/(withmenu)/[orgslug]/quizzes/[quizid]/{page,quiz}.tsx`** —
    the quiz detail/start page, mirroring the Academic Library resource
    viewer's structure (`UnavailableState` for the API's 404/403 split,
    `isDraftPreview` derived the same way). "Start quiz" calls
    `useStartQuizAttempt` and navigates to the new attempt's own route;
    anonymous viewers see a "Log in to take this quiz" link
    (`/login?redirect=...`, honored by the existing login page's
    `buildCallbackUrl`) instead, since starting requires authentication
    (401 anon per 6D).
  - **`app/orgs/(withmenu)/[orgslug]/quizzes/[quizid]/attempt/[attemptid]/{page,attempt}.tsx`**
    — the attempt view, branching on `attempt.status`:
    - **In progress**: one question per screen (`docs/DESIGN_SYSTEM.md`
      §19), a persistent "Question X of Y" + progress bar, Previous/Next
      navigation, and type-specific input (multiple_choice: selectable
      option buttons building `{selected_option_id}`; short_answer: a text
      input building `{text}`; number_answer: a number input building
      `{value}`). All answers are kept in local component state until
      submit — matching 6D's contract, there is no partial-save/resume
      endpoint. The last question shows "Submit quiz" plus an unobtrusive
      "N question(s) left unanswered" count (not a blocking validation —
      6D grades an unanswered question incorrect, it isn't a distinct
      "not attempted" state).
    - **Graded**: score as a large percentage, a pass/fail badge using
      `--success`/`--warning` (never `--destructive` — the "needs review"
      framing from the 6A/6D decision, not a "you failed" one) when the
      quiz has a `pass_threshold_percentage`, and a per-question review list
      reusing `docs/DESIGN_SYSTEM.md` §19's answer-state ladder (correct
      selected/correct-but-unselected/incorrect-selected/neutral for
      multiple_choice; submitted-vs-accepted-answers for short/number
      types), with each question's `explanation` now safely revealed
      (leak-prevention gate lifted post-grade, per-attempt-owner only). A
      "Retake quiz" link starts a fresh attempt (every attempt is its own
      row per the 6A/6D decision — no resume, retake is just start-again).
  - **Tests**: no new pure-logic module this increment (attempt-taking has
    no list/filter surface to unit-test, unlike 6E-1/6E-2's bank/quiz
    filters) — verification relied on ESLint/tsc/full-suite regression plus
    live browser verification (see below). ESLint (`lint:strict`) clean.
    `tsc --noEmit` clean repo-wide. Full `bun test tests`: 150 passed / 13
    failed / 2 errors — the same pre-existing, unrelated failures already
    logged in the 6E-1 entry above; no new tests added, none broken.
  - **Live verification (both backend contract and actual UI, same
    session, extension connected from the start)**: created a published
    quiz with one question of each type (multiple_choice/short_answer/
    number_answer, one with an `explanation`, `pass_threshold_percentage:
    70`) via direct API calls, then exercised the full flow live in-browser
    as a logged-in student: the channel home page's new "Quizzes" section
    rendered the card; "Start" → the quiz detail page → "Start quiz" →
    landed on `/quizzes/{id}/attempt/{id}` showing question 1/3 with the
    multiple_choice answer key correctly **not** visible (confirming the
    leak-prevention gate holds client-side, not just server-side);
    answered all three (one deliberately wrong), watched the progress bar
    and "N left unanswered" count update live, submitted, and landed on a
    67% "Needs review" (warning-toned, not destructive) results screen with
    accurate per-question correct/incorrect badges, the correct option
    highlighted in green on the multiple_choice review, the revealed
    "Accepted answers: 7" on the wrong number_answer question, and the
    revealed explanation on the correct multiple_choice question. Reloaded
    the graded attempt URL directly and got the identical results view
    (confirms `get_quiz_attempt`'s graded branch). No console errors.
    Cleaned up all test data (quiz + 3 questions) afterward.
- **Phase 6F (Exam Practice countdown timer + auto-submit): complete.** The
  one remaining piece of the originally-scoped 6A/6D "Exam practice"
  experience — a student-facing countdown during an `exam_practice` attempt
  (`docs/DESIGN_SYSTEM.md` §19: fixed-position, tabular-numeral,
  `--warning`→`--destructive` in the final period) plus auto-submit on
  expiry. 6E-3's attempt UI intentionally shipped with no timer; this wires
  one in without touching 6D's backend contract.
  - **`services/organizations/quizTimer.ts`** (new, pure logic, no React):
    the backend stores no attempt-level deadline (`time_limit_minutes` lives
    on the `Quiz`, `started_at` on the `QuizAttempt`), so the deadline is
    derived client-side as `started_at + time_limit_minutes` and
    re-evaluated every tick. `getTimerUrgency` scales the warning/destructive
    thresholds proportionally to the quiz's own time limit (capped at 300s/
    30s) so a short exam still gets a meaningful warning window without a
    long one warning absurdly early.
  - **Bug found and fixed during implementation**: the backend's
    naive-UTC timestamp convention (`str(datetime.now(timezone.utc)
    .replace(tzinfo=None))` — no `Z`/offset, e.g. `"2026-08-21
    14:17:53.531993"`, the same `_now()` pattern used repo-wide in
    `quiz_attempts.py`/`quizzes.py`/`questions.py`/`channel_videos.py`) was
    being parsed by `new Date(str)` as **local** time, not UTC. In this
    environment's timezone (Africa/Nairobi, UTC+3) that inflated "elapsed
    time" by a full 3 hours, so every timed attempt auto-submitted within
    under a second of starting, scored 0%. `parseUtcTimestamp()` fixes this
    by reading the string's components and rebuilding the instant via
    `Date.UTC(...)`, sidestepping the ambiguous bare-string parse entirely;
    already-offset strings (`Z`/±HH:MM) fall through to `new Date()`
    unchanged, since those parse unambiguously per spec. This is a
    repo-wide backend convention, not fixed elsewhere — it was otherwise
    only feeding cosmetic "X ago" displays, where a multi-hour skew goes
    unnoticed; it only actually broke this feature, because this is the
    first place elapsed time drives real behavior (auto-submit).
  - **`components/Objects/Channel/QuizTimer.tsx`** (new): a fixed-position
    pill (`role="timer"`, `aria-live="assertive"` only once destructive,
    matching `--z-sticky-header`) that recomputes from `startedAt`/
    `timeLimitMinutes` every second (rather than counting down a local
    number), so it stays correct across tab backgrounding/throttled timers.
    Calls `onExpire` exactly once, guarded by a ref (not state, to avoid a
    render-order race) the first tick remaining time hits zero.
  - **Wired into** `.../quizzes/[quizid]/attempt/[attemptid]/attempt.tsx`:
    renders only when `quiz.quiz_type === 'exam_practice' &&
    quiz.time_limit_minutes` (standard quizzes are unaffected); `onExpire`
    shows a toast ("Time's up — submitting your quiz.") and calls the same
    `handleSubmit` the manual "Submit quiz" button uses, guarded by a
    `submittedOrSubmittingRef` so a manual submit racing the timer can't
    double-submit.
  - **Tests (TDD)**: `tests/quiz-timer.test.mjs` — 15 tests, written
    against `getQuizTimerState`/`formatTimerDisplay`/`getTimerUrgency`
    before wiring the React component: full-time-at-start, counts-down,
    clamps-to-zero-and-expired, exactly-at-deadline, urgency thresholds
    (normal/warning/destructive, including short-time-limit proportional
    scaling), `formatTimerDisplay` (mm:ss / h:mm:ss / zero / floors
    fractional-never-negative) — plus a dedicated 3-test regression group
    for the timezone bug that overrides `process.env.TZ` per-test (Bun
    pins `TZ=UTC` internally by default, which silently made the first
    version of this regression test pass even against the *unfixed* code —
    confirmed via a throwaway debug test printing
    `Intl.DateTimeFormat().resolvedOptions().timeZone`; overriding
    `process.env.TZ` directly, confirmed Bun's `Date` honors it
    immediately, is what actually exercises the bug). Watched RED (2
    failing) against the pre-fix code, then GREEN after. Full `bun test
    tests`: **165 passed, 13 failed, 2 errors** — the same pre-existing,
    unrelated baseline documented since 6E-3 (`billing-internal-key
    .test.mjs`, `catalog-pagination.test.mjs`'s missing fixture, the
    `ar.json` coverage timeout); 15 more passing than 6E-3's 150-pass
    baseline, matching the 15 new tests exactly. ESLint (`lint:strict`)
    clean on all three changed/new files. `tsc --noEmit` clean project-wide.
  - **Live verification**: performed against the real dev stack (web:3000,
    api:1338, Postgres/Redis already running), logged in as an existing
    admin test user, using temporary QA quizzes created via direct API
    calls (1- and 2-minute `exam_practice` quizzes, one question each,
    deleted afterward). First attempt (pre-fix code) reproduced the
    timezone bug exactly as diagnosed: auto-submitted in well under a
    second, 0% score. After the fix: confirmed the timer renders and counts
    down correctly from the full time limit (e.g. "01:52" on a 2-minute
    quiz); confirmed the normal→warning color transition live (pill turned
    amber at 8s remaining on a 1-minute quiz, inside its scaled 12s warning
    threshold); confirmed genuine auto-submit at zero across three separate
    attempts, each landing on the correct graded results screen (0%,
    "Incorrect", correct option highlighted) — not the instant/broken
    auto-submit from before the fix. **Not caught on screen**: the pure
    `--destructive` (red) color state specifically — its window is capped
    at 30s max (shorter on short quizzes) and auto-submit consistently beat
    screenshot timing across repeated attempts; the threshold logic itself
    is covered by the passing `getTimerUrgency` unit tests
    (`urgency shifts to destructive inside the last-seconds threshold`),
    and the adjacent warning state and the expiry transition it leads into
    were both confirmed live, so this is judged a low-risk, purely visual
    gap rather than a functional unknown.
  - **No backend changes** — deliberately scoped as client-driven
    auto-submit only, per the 6A/6D decision; there is still no
    server-side expiry check (out of scope, same as every other Phase 6
    increment to date).
- **Phase 6G (Results — student-facing attempt history): complete.** The
  roadmap's "Results" item: a list of a student's own past attempts at a
  quiz (score, pass/fail, in-progress vs. graded), distinct from 6E-3's own
  single-attempt results screen (already built, unchanged in shape). Builds
  the one endpoint 6D deliberately deferred for this exact increment.
  - **Backend**: `QuizAttemptSummary` schema (id/uuid/quiz_id/status/
    score_percentage/attempt_number/started_at/submitted_at — no per-
    question detail) + `list_quiz_attempts` service fn in
    `services/orgs/quiz_attempts.py`, exposed as `GET
    /orgs/{org_id}/quizzes/{quiz_id}/attempts` (coexists with the existing
    `POST` on the same path). Auth-required (401 anon), org/quiz 404s
    reused from the existing helpers, returns **only the acting user's own
    attempts**, newest `attempt_number` first — no admin/other-user listing
    here, that query is 6H's (progress-tracking aggregation) job, not
    this one's.
  - **Frontend**: `listQuizAttempts` fetcher + a small pure
    `computeAttemptOutcome(score, passThreshold)` helper (`'passed' |
    'failed' | null`, null when the quiz has no `pass_threshold_percentage`)
    added to `services/organizations/quizAttempts.ts`; the 6E-3
    single-attempt `ResultsView` was refactored to call this same helper
    instead of its own inline pass/fail check, so there's one pass/fail
    definition, not two. New `quizAttempts.list(orgId, quizId)` query key +
    `useQuizAttempts` hook (`hooks/queries/useQuizAttempt.ts`). New route
    `.../quizzes/[quizid]/results/` (`page.tsx` + `results.tsx`) listing the
    attempt history as clickable rows (score, in-progress/passed/needs-review
    badge, timestamp via 6F's `parseUtcTimestamp` so it isn't skewed by local
    timezone) — each row links into the **already-built** 6E-3 attempt-detail
    page for the full per-question breakdown, rather than duplicating that
    UI. An empty-history state offers a "Start quiz" link; an anonymous
    viewer sees a login prompt (attempt history is owner-only, matching the
    backend). Links added both ways: the quiz view page (`quiz.tsx`) gets a
    "View past attempts" link for authenticated users, and the single-attempt
    results screen (`attempt.tsx`) gets a "View past attempts" link back to
    the new history page.
  - **Tests (TDD)**: 4 new service tests in
    `test_quiz_attempts_service.py` (anonymous 401, nonexistent-quiz 404,
    empty list when nothing taken, own-attempts-only-newest-first — proving
    a second user's attempt never leaks into the list). Watched RED
    (import error) before implementing, GREEN after: full scoped regression
    (`test_question_model.py`, `test_quiz_model.py`,
    `test_quiz_attempt_model.py`, `test_questions_service.py`,
    `test_quizzes_service.py`, `test_quiz_attempts_service.py`) — **82
    passed, 0 failed**. Ruff clean on all changed/new backend files.
    Frontend: new `tests/quiz-results.test.mjs` (3 tests for
    `computeAttemptOutcome`) — scoped quiz test files (`quiz-timer`,
    `quiz-filters`, `quiz-results`) **31 passed, 0 failed**; full `bun test
    tests` **168 passed, 13 failed, 2 errors** — the same pre-existing,
    unrelated baseline as every prior Phase 6 increment
    (`billing-internal-key.test.mjs`, `catalog-pagination.test.mjs`'s
    missing fixture, the `ar.json` coverage timeout). ESLint (project
    config, not `--no-eslintrc`) clean on every changed/new frontend file.
    `tsc --noEmit` clean project-wide.
  - **Live verification — complete.** The dev stack (web:3000, api:1338,
    Postgres/Redis) was already running. The seeded QA user's password
    (`phase2dtester@example.com`, id 3) was reset with the user's explicit,
    in-chat permission this time, via a one-off script using the app's own
    `security_hash_password` + `asyncpg` (avoided the shell-quoting failure
    a raw `docker exec psql` hit on the `$`-heavy Argon2 hash); verified by
    an actual `POST /auth/login` returning 200 before touching the browser.
    Temporary QA fixtures (a `standard` quiz with `pass_threshold_percentage
    = 50`, one `multiple_choice` question, three attempts — 100%/graded,
    0%/graded, and one left `in_progress`) were created via direct API
    calls, then exercised through the real browser (logged in as
    `phase2dtester`, single-tenancy default org at `/`): the new
    `/quizzes/{id}/results` page rendered all three attempts, newest first,
    with correct status/score/badges ("In progress", "0% Needs review",
    "100% Passed") and locale-formatted timestamps; clicking a graded row
    opened 6E-3's existing attempt-detail page showing the correct
    per-question breakdown (unchanged, confirming reuse rather than
    duplication); clicking the in-progress row correctly resumed the
    `QuestionRunner` with the answer key still stripped; the new
    "View past attempts" links on both the quiz page and the single-attempt
    results screen round-tripped correctly in both directions. Confirmed via
    `read_network_requests` that the page calls the new `GET
    /orgs/1/quizzes/7/attempts` endpoint directly (200). No console errors.
    QA fixtures (quiz + question, cascading to their attempts) were deleted
    afterward via the API, keeping the dev DB clean.
  - **No new database table** — reuses the existing `QuizAttempt` row
    exactly as modeled in 6A/6D; this increment is a read-only query plus
    UI over data that already existed.
  - `docs/ROADMAP.md`'s "Results" box is now checked.
- **Phase 6H (Basic progress tracking): complete.** The roadmap's last Phase
  6 item: a read-only aggregation over the existing `QuizAttempt`/`Quiz`
  tables — attempts taken, best/most-recent graded score, and last-activity
  time per quiz — scoped to one channel, own-attempts-only, no new table.
  See `docs/ARCHITECTURE.md` § "Exams & Practice (Phase 6A)" point 3, which
  already scoped this exactly this way and ruled out `TrailRun`/`TrailStep`
  (course completion, unrelated) as a prior-art fit. One scoping call made
  this increment (not previously pinned down): progress is per-channel
  (`org_id`-scoped, matching every other Phase 6 student surface — quiz,
  question, and 6G's results are all channel-scoped) and lists only quizzes
  the user has actually attempted, not a full catalog with zero-attempt
  rows — read as the natural minimal reading of "attempts taken" rather
  than a broader per-user-across-all-channels dashboard, which has no
  existing precedent anywhere in the app.
  - **Backend**: new `services/orgs/progress.py` (`QuizProgressSummary`
    schema + `get_org_quiz_progress`) — deliberately its own small module
    rather than growing `quiz_attempts.py` further, since this aggregates
    *across* quizzes in an org rather than operating on one quiz's
    attempts. One new endpoint, `GET /orgs/{org_id}/progress`, added to the
    existing `orgs` router. Query: `QuizAttempt` joined to `Quiz` filtered
    to `Quiz.org_id` + the acting user's own `user_id` (both isolation
    boundaries the existing Phase 6 tests already established the pattern
    for), grouped by quiz in Python — matches this codebase's established
    "fetch then aggregate in a list comprehension" style
    (`_graded_answers`, `_quiz_questions_ordered`) rather than SQL-side
    `GROUP BY`, appropriate given expected per-user attempt volumes are
    small. `attempts_taken` counts every attempt regardless of status;
    `best_score_percentage`/`most_recent_score_percentage` are computed
    only from `graded` attempts and are `None` (not `0.0`) when none of a
    quiz's attempts are graded yet, so a still-in-progress attempt is never
    mistaken for a genuine 0%. `most_recent_attempt_at` reflects the latest
    attempt of *any* status, used both for display and as the sort key
    (most recently active quiz first).
  - **Frontend**: `services/organizations/quizProgress.ts`
    (`getOrgQuizProgress` fetcher) + `quizProgress.org(orgId)` query key +
    `useQuizProgress` hook, new route `.../progress/` (`page.tsx` +
    `progress.tsx`) rendering one row per quiz — attempts count, "last on"
    timestamp (`parseUtcTimestamp`, same 6F timezone fix reused), best/
    recent score, and a passed/needs-review badge computed via 6G's
    existing `computeAttemptOutcome` off `most_recent_score_percentage`
    (reused, not reimplemented; a `null` recent score — no graded attempts
    yet — suppresses the badge and shows an "In progress" pill instead).
    Each row links into 6G's existing per-quiz results history for the
    per-attempt breakdown, rather than building a second one. Entry point:
    a small "My progress" link added to `ChannelQuizzesSection`'s header
    (shown only when authenticated) — the channel home page is where
    quizzes are already discovered, so this is the smallest addition, not
    a new persistent nav item; unauthenticated visitors get the same
    login-prompt pattern as 6G rather than a new one.
  - **Tests (TDD)**: new `test_progress_service.py`, written RED first
    (import error) — 8 tests: anonymous 401, nonexistent-org 404, empty
    list with no attempts, the core aggregation (attempts taken=3,
    best=100 from an earlier attempt, most-recent-graded=0 from a later
    one, `most_recent_attempt_at` matching the still-in-progress third
    attempt), all-`None` scores when every attempt is in-progress,
    own-attempts-only isolation (a second user's attempts never leak in),
    cross-org isolation (a quiz in another org never appears), and
    most-recent-activity sort order across two quizzes. All 8 passed on
    first implementation. Scoped regression (`test_quiz_attempt_model.py`,
    `test_quiz_model.py`, `test_question_model.py`,
    `test_questions_service.py`, `test_quizzes_service.py`,
    `test_quiz_attempts_service.py`, `test_progress_service.py`): **90
    passed, 0 failed**. Ruff clean. No dedicated new frontend unit test —
    the only new frontend logic is a thin null-check/badge ternary reusing
    already-tested `computeAttemptOutcome`; nothing new here rose to the
    level of its own pure-logic module. Full `bun test tests`: **168
    passed, 13 failed, 2 errors** — same pre-existing, unrelated baseline
    as every prior Phase 6 increment. ESLint and `tsc --noEmit` clean on
    every changed/new frontend file. `git diff --check` clean.
  - **Live verification — complete.** Dev stack already running. Logged in
    as the same seeded QA user (`phase2dtester@example.com`, session/
    cookie still valid from the 6G verification). Seeded two QA quizzes via
    direct API calls — Quiz A (`pass_threshold_percentage=50`, one 100%
    attempt then one 0% attempt, so best ≠ most-recent) and Quiz B (no
    threshold, one 100% attempt, taken after Quiz A's so it should sort
    first) — confirmed the aggregation directly via `GET .../progress`
    before touching the browser. In the real browser: the new "My
    progress" link renders in the Quizzes section header only when
    authenticated; `/progress` lists both QA quizzes correctly (Quiz B
    first, 100%/100%, no badge since it has no threshold; Quiz A second,
    Best 100%/Recent 0%, "Needs review" badge), followed by two leftover
    6F QA quizzes from an earlier session in correctly-older position;
    clicking a row opened the exact right quiz's 6G results-history page
    showing both seeded attempts with matching scores/badges. Confirmed
    via `read_network_requests` that the page calls `GET
    /orgs/1/progress` (200), and no console errors. QA fixtures (both
    quizzes + questions, cascading to their attempts) deleted afterward.
  - **No new database table** — pure read-only aggregation over
    `QuizAttempt`/`Quiz`, exactly as scoped in 6A.
  - `docs/ROADMAP.md`'s "Basic progress tracking" box is now checked —
    **all five Phase 6 roadmap boxes are now checked**, but Phase 6 is not
    yet declared complete: 6I (the cross-cutting live-verification pass
    across the full 6C–6H flow together) hasn't run yet, mirroring how
    Phase 5 wasn't declared complete until its own 5D verification pass.
- **Phase 6I (Cross-Cutting Verification): complete — Phase 6 is complete.**
  Final integration/regression/live-verification pass across the whole
  Phase 6 flow (6B–6H), mirroring 5D's role in Phase 5. No new features;
  one genuine bug was looked for and none was found — every check below
  passed on the first attempt, so no code changes were made this increment.
  - **Full backend regression**: `TESTING=true uv run pytest src/tests/ -v
    --tb=short --cov=src --cov-report=term-missing --cov-fail-under=25` —
    **5563 passed, 29 skipped, 10 failed**, 96.53% coverage (well above the
    25% gate). All 10 failures confirmed **pre-existing and unrelated to
    Phase 6** by re-running each in isolation and inspecting the assertion:
    two EE-hook-registration/event-ordering tests
    (`test_core_events.py`/`test_core_events_runtime.py`), three custom-
    domain/org-invite tests failing on an unrelated `ACCOUNT_TOO_NEW`
    account-age gate (`enforce_free_tier_age_gate`, min 7 days), and two
    podcast-listing tests. None of these files import or touch
    `quizzes.py`/`questions.py`/`quiz_attempts.py`/`progress.py` or the
    `orgs.py` router's quiz section. Every Phase 6 test file (`test_question
    _model.py`, `test_quiz_model.py`, `test_quiz_attempt_model.py`,
    `test_channel_resource_model.py`, `test_questions_service.py`,
    `test_quizzes_service.py`, `test_quiz_attempts_service.py`,
    `test_progress_service.py`, `test_channel_resources_service.py`)
    passed — 0 failures anywhere in the Phase 6 surface.
  - **Full frontend test suite**: `bun test tests` — **168 passed, 13
    failed, 2 errors** — the exact same pre-existing, unrelated baseline
    documented in every prior Phase 6 increment's entry
    (`billing-internal-key.test.mjs`, `catalog-pagination.test.mjs`'s
    missing fixture, the `ar.json` coverage timeout). All quiz/question/
    progress test files (`quiz-timer`, `quiz-filters`, `quiz-results`,
    `question-filters`) passed in full.
  - **Ruff**: `uvx ruff@0.15.9 check .` (whole `apps/api`) — all checks
    passed.
  - **ESLint**: full `apps/web` run surfaces ~751 pre-existing problems (31
    errors, 720 warnings) entirely in files Phase 6 never touched
    (`services/billing/*`, `services/emails/*`, `services/courses/
    transfer.ts`, etc. — the same backlog `lint` is documented as non-
    blocking/report-only for in `CLAUDE.md`). Every Phase 6 file, listed
    explicitly by path (all `services/organizations/quiz*`/`question*`,
    `hooks/queries/useQuiz*`/`useQuestion.ts`, `lib/query/keys.ts`, every
    quiz/progress/dash-quizzes/dash-questions route, and the three touched
    `components/Objects/Channel/*` files) — **zero errors, zero
    warnings**.
  - **TypeScript**: `tsc --noEmit -p tsconfig.json` — clean, project-wide.
  - **`git diff --check`**: clean.
  - **Live verification — the full student + admin journey, end to end.**
    Dev stack already running; logged in as the same seeded QA user
    (`phase2dtester@example.com`). Created fresh QA fixtures **through the
    real dashboard UI** (not API shortcuts, since authoring itself was in
    scope this time): a new bank question (multiple_choice, "capital of
    Kenya") via Question bank → New question → publish toggle; a
    `standard` quiz (`pass_threshold_percentage=50`) via Quizzes → New quiz
    → Add question → publish toggle; a second `exam_practice` quiz with a
    1-minute limit, same question attached (proving one bank question
    reuses cleanly across multiple quizzes). Then, as a student:
    1. **Question Bank / Quiz authoring** — both quizzes created, questions
       attached, and published entirely through dashboard clicks; no dead
       controls, every dialog/toggle/picker worked (two toggle clicks
       needed a retry after a page transition — see Limitations, not a bug).
    2. **Quiz taking** — opened the standard quiz from the channel home
       feed's `QuizCard`, "Start quiz" started a real attempt, the question
       runner rendered with the answer key correctly stripped.
    3. **Exam Practice + 4. countdown timer + 5. auto-submit** — started
       the 1-minute exam attempt; the countdown pill rendered and ticked
       down live; left unanswered and allowed to expire, it **genuinely
       auto-submitted** with no manual action — graded 0%/"Incorrect" with
       the correct answer highlighted, exactly the unanswered-question
       contract from 6D/6F.
    6. **Submission/grading** — the standard-quiz attempt, answered
       correctly, graded 100% instantly on submit.
    7. **Per-attempt results** — both graded attempts rendered full
       correct/incorrect breakdowns with the right option highlighted and
       "Your answer"/pass-fail badges, reusing 6E-3/6G's unchanged view.
    8. **Attempt history** — both quizzes' `/results` pages listed their
       attempt(s) correctly (score, timestamp, pass/fail where a threshold
       was set, no badge where it wasn't).
    9. **Basic progress tracking** — `/progress` correctly aggregated both
       new quizzes alongside the two leftover 6F QA quizzes from an earlier
       session, sorted most-recently-active first, with correct best/
       recent scores and the "Passed" badge appearing only on the quiz that
       actually had a pass threshold.
    - **Navigation between surfaces**: every cross-link exercised in both
      directions — quiz page ↔ results history ↔ per-attempt breakdown ↔
      progress page ↔ channel home — landed correctly, confirmed via URL
      and page content each time (some individual clicks required a retry;
      see Limitations).
    - **API requests**: `read_network_requests` on the results/progress
      pages confirmed `GET /orgs/1/quizzes/{id}/attempts` and `GET
      /orgs/1/progress` both return 200 with no unexpected calls.
    - **Console**: no errors on any page visited this session.
    - **Unauthenticated access**: verified directly against the live API
      rather than via a logged-out browser tab (would have required
      logging the QA session out mid-flow) — anonymous `GET
      .../quizzes` (public listing) returns 200; anonymous `POST
      .../attempts`, `GET .../attempts` (list), and `GET .../progress` all
      correctly return 401, as does a request with a garbage bearer token.
      The frontend's login-gated states (results/progress pages'
      "log in to see..." prompts) are unchanged code from 6G/6H and were
      not re-clicked-through this session — see Limitations.
    - **Ownership boundaries**: re-confirmed via the full passing test
      suite (`test_get_attempt_requires_ownership`,
      `test_submit_requires_ownership`,
      `test_progress_only_includes_own_attempts`,
      `test_list_attempts_returns_only_own_attempts_newest_first`,
      `test_admin_of_another_org_cannot_manage_this_channels_quiz/
      question`) rather than re-exercised live with a second real account
      — see Limitations for why.
    - **Cleanup**: all QA fixtures (2 quizzes, 1 question, their attempts)
      deleted afterward via the API; confirmed only the pre-existing 6F
      leftover quizzes remain published.
  - **Bugs found: none.** No code changes were made in this increment.
  - **Limitations**:
    - Live cross-user 403 re-verification (a second real account clicking
      into another user's attempt) wasn't performed: `POST /api/v1/users/`
      requires sending a verification email, and this local dev environment
      has no email service configured (`"Email service temporarily
      unavailable"`). Directly inserting a second user row was considered
      but not done — it's the same class of direct-DB write the session's
      permission gate had already declined once this session for a
      lower-stakes read, so it wasn't retried without asking. The ownership
      boundary itself is still verified — just via the passing unit-test
      suite rather than a second live browser session.
    - The anonymous/logged-out *UI* (as opposed to the API's 401) wasn't
      re-clicked-through live, to avoid logging the QA session out
      mid-verification; this is unchanged code already covered by passing
      tests and by 6G/6H's own live verification of that exact state.
    - A few individual UI actions (publish toggles right after a page
      navigation, one "Add question" click) silently no-op'd on the first
      click and needed a retry, confirmed via a follow-up API check each
      time — judged to be this browser-automation tool's click/render-
      timing, not an application bug (no repeatable failure, no console
      error, and the retry always succeeded immediately).
  - **Documentation**: this entry; `docs/ROADMAP.md` needed no further
    changes (all five Phase 6 boxes were already checked as of 6H);
    `docs/ARCHITECTURE.md` unchanged — verification surfaced no new
    architectural decision.

**Phase 6 — Exams & Practice is complete.** All of `docs/ROADMAP.md`'s
Phase 6 boxes are checked, every increment (6A–6I) is documented above with
its own tests/live-verification, and this cross-cutting pass found the
combined system consistent with no regressions. Next per
`docs/ROADMAP.md`: Phase 7 — Parents. Not started; do not begin
automatically per `CLAUDE.md`'s "don't silently begin the next increment"
rule.

## UI/UX Track
Separate from the product-phase track above; sequenced per `docs/UI_UX_IMPLEMENTATION_PLAN.md`.
- **UI-0 — Design Foundations**: complete (commit `8478a3be`). LearnOrbit's
  blue/teal token system wired into `apps/web/styles/globals.css`; see
  `docs/DESIGN_SYSTEM.md`.
- **UI-1 — Global Application Shell**: complete. Rebranded the header
  (LearnOrbit wordmark replaces the LearnHouse logo/alt text), retokenized
  the shell's default (non-custom-branded) colors in
  `services/utils/ts/colorUtils.ts`, and added a persistent desktop sidebar
  (`components/Objects/Menus/OrgSidebar.tsx`, ≥`lg`) plus a mobile/tablet
  bottom tab bar (`components/Objects/Menus/OrgBottomTabBar.tsx`, <`lg`),
  both sourced from a shared `useOrgMenuItems` hook extracted from
  `OrgMenuLinks.tsx` so nav stays in sync across surfaces. Wired into
  `app/orgs/[orgslug]/(withmenu)/layout.tsx`. Verified live in-browser via
  the full dev stack (`npx learnhouse dev`) at desktop width: rebrand,
  sidebar, active-route highlighting, and empty-state routing all confirmed
  working with no console errors.
  - **Known limitation**: live mobile/tablet viewport verification was not
    possible — the browser automation tool's `resize_window` did not
    actually shrink the rendered viewport in this environment, so the
    `< lg` bottom tab bar is unverified live (code-reviewed only: same
    `useOrgMenuItems` source, `lg:hidden` gate).
  - **Intentionally deferred**: the "Made with LearnHouse" attribution
    watermark (`components/Objects/Watermark.tsx`) still reads LearnHouse —
    left alone as a licensing/free-tier attribution feature, not core shell
    branding; revisit only with an explicit decision on it.

## Important Decisions
- Product name: LearnOrbit
- Tagline: Where learning connects.
- Primary coding agent: Claude Code
- Token-saving development workflow: inspect → implement one feature → test → commit
- Reuse existing LearnHouse functionality before creating new systems
- Channels reuse `Organization` directly (extended, not a new entity) — see
  `docs/ARCHITECTURE.md`.
- Videos are a new `ChannelVideo` table (channel-level discovery/metadata),
  not a repurposed `Course`/`Activity` — `Activity` keeps owning all actual
  video infrastructure (upload/storage/HLS/captions/streaming) unchanged.
  See `docs/ARCHITECTURE.md`.
- Following is a dedicated `organizationfollow` table, not `UserOrganization`
  — a follow carries no `Role`/membership, so reusing the membership table
  would have conflated "subscribed to a channel's updates" with "has a role
  in this org." See `docs/ARCHITECTURE.md`.
- Academic Library resources are a new `ChannelResource` table (channel-level
  discovery/metadata, mirroring `ChannelVideo`), not a repurposed
  `ChannelVideo` or `Course`/`Activity` — `Activity` keeps owning all actual
  PDF upload/storage/validation unchanged. Gets its own dedicated hidden
  container course ("Channel Resources"), separate from the existing
  "Channel Videos" one. See `docs/ARCHITECTURE.md` §
  "Academic Library (Phase 5A)".

## Next Actions
1. Consider whether any further tenant-only features need INSTRUCTOR gating
   (signup fields, invites, billing caps) — deliberately left ungated in
   Phase 1A to keep the change small.
2. Phase 2G-1–2G-3 complete; 2G-4 (thumbnail upload) deferred to a later
   creator/UI polish phase (see Phase 2G-4 entry above).
3. Commit Phase 1A + Phase 1B + Phase 1C + Phase 2A–2G-3 changes (2G-4 was
   investigation-only — no code to commit).
4. **Local-dev limitation to revisit**: full multi-channel navigation
   (creating a channel and then visiting it by slug) cannot be exercised in
   this local setup. `LEARNHOUSE_SAAS=true` (now set in `apps/api/.env`)
   lifts the org-creation-count cap, but reaching a non-default org by slug
   needs `hosting_config.tenancy: multi` (subdomain routing), which
   `config.py` refuses outright when the domain contains "localhost" (by
   design — no `*.localhost` workaround). Verified via direct API calls
   instead (see Phase 1B entry above). Only matters for local manual
   testing/demoing multiple channels side by side; not a blocker for
   staging/production, which will run on a real domain.
5. Phase 3A–3H complete — see Status Snapshot above and
   `docs/ARCHITECTURE.md` § "Videos / Shorts (Phase 3A)". **Phase 3 overall
   is now complete.** Outstanding, non-blocking from 3G: subject/topic/level
   filtering for the channel Shorts section (deferred, not required for
   3G's core requirement).
6. Phase 4A–4G (engagement schema, Likes, Comments, Saves, Shares, Shorts
   engagement rail, Home feed) are all complete — see the Status Snapshot
   entries above, `docs/ARCHITECTURE.md` § "Social Engagement (Phase
   4A/4B/4C/4E/4F)", and § "Home Feed (Phase 4G)". **Every `docs/ROADMAP.md`
   Phase 4 item except "Basic notifications" is done.** Next is either
   scoping Basic notifications, further Phase 4 polish (deferred items:
   card-level counts, comment moderation, social-platform share targets), or
   the next `docs/ROADMAP.md` milestone (Phase 5 — Academic Library); needs a
   scoping decision before starting.
7. **RESOLVED (2026-08-19)** — the Next.js `[dynamicSegment]/(routeGroup)/page.tsx`
   404 (was: every org-scoped page unreachable in the local dev server) and
   the `tsconfig.json` `baseUrl` deprecation blocking `tsc --noEmit` are both
   fixed. See the Status Snapshot entry above and `docs/ARCHITECTURE.md` §
   "Repo-wide dev-environment blockers (fixed)" for the full fix and its
   verification. Live browser verification is available again for future UI
   work; re-verifying prior phases' previously-unverified UI (3F, 3G, 3H,
   UI-1's mobile viewport, 4B, 4C, 4D) live is optional follow-up, not done
   as part of this fix.
8. Phase 4F was live-verified at desktop width only (see Status Snapshot
   entry above) — the `sm:hidden` mobile overlay rail in `short.tsx` is
   code-reviewed but not pixel-verified, same pre-existing `resize_window`
   viewport limitation already logged for UI-1's mobile bottom tab bar.
   Re-verifying it (and UI-1's mobile nav) on a real mobile viewport is
   optional follow-up whenever that tooling gap is resolved.
9. Commit the uncommitted Phase 4B–4F changes currently sitting in the
   working tree (git status at session start showed all of 4E/4F as
   uncommitted) — not done automatically per `CLAUDE.md`'s git rules; only
   on explicit request.
10. **Phase 5A/5B/5C/5D (Academic Library — architecture decision, backend,
    frontend, and live verification) are all complete** — see
    `docs/ARCHITECTURE.md` § "Academic Library (Phase 5A)" and this file's
    Phase 5B/5C/5D Status Snapshot entries for the full breakdown, test
    results, and live-verification findings. All five `docs/ROADMAP.md`
    Phase 5 boxes are checked; **Phase 5 overall is complete.** Two
    non-blocking gaps found during 5D's live verification, deliberately not
    fixed (out of scope for a verification-only increment): no UI to
    publish/unpublish a resource after initial upload (mirrors an identical
    pre-existing gap on `ChannelVideoCard`), and `get_user_org()`'s
    unordered `.first()` query has no defense against a user someday ending
    up with two role rows for the same org. Next: `docs/ROADMAP.md` Phase 6
    — Exams & Practice (see the Phase 6 scoping research already gathered
    this session — `Activity`/`Assignment`/`AssignmentTask` infrastructure
    substantially covers quizzes already).
11. **Phase 6A (architecture decision) and Phase 6B (`Question` bank
    backend) are complete** — see `docs/ARCHITECTURE.md` § "Exams & Practice
    (Phase 6A)" and this file's Phase 6A/6B Status Snapshot entries above.
    The confirmed scope (a real cross-quiz question bank, and Exam Practice
    as a distinct timed multi-question-source session) ruled out reusing
    `Assignment`/`AssignmentTask` — see the decision doc for why.
    **Phase 6C (`Quiz`/`QuizQuestion` model + migration + service + router)
    and Phase 6D (`QuizAttempt`/`QuizAnswer` model + migration + service +
    router — attempt-taking/auto-grading) are now also complete** — see
    this file's Phase 6C/6D Status Snapshot entries above and
    `docs/ARCHITECTURE.md` §§ "Exams & Practice (Phase 6A)" and "(Phase
    6D)". No `docs/ROADMAP.md` Phase 6 box can be checked yet; authoring +
    attempt-taking backend only so far, **no frontend at all**. Per the 6A
    decision's stated dependency order, the remaining increments are:
    - **6E-1 — Question Bank admin authoring UI: complete.** See this file's
      Phase 6E-1 Status Snapshot entry above. Split out of the original
      single "6E" item (bank authoring + quiz authoring + student
      quiz-taking) into its own increment per `CLAUDE.md`'s small-increments
      rule.
    - **6E-2 — Quiz authoring UI: complete.** See this file's Phase 6E-2
      Status Snapshot entry above. Metadata CRUD + question picker/attach/
      reorder/detach, wired to 6C's endpoints, built directly on 6E-1's bank
      authoring UI.
    - **6E-3 — Student quiz-taking UI: complete.** See this file's Phase
      6E-3 Status Snapshot entry above. Start/answer/submit/results, wired
      to 6D's endpoints, live-verified end-to-end (backend contract and
      actual UI) in the same session it was built. **All three Phase 6E
      surfaces (bank authoring, quiz authoring, student quiz-taking) are
      now complete and live-verified.**
    - **6F — Exam Practice countdown timer + auto-submit: complete.** See
      this file's Phase 6F Status Snapshot entry above. Also fixed a real,
      previously-undiscovered timezone bug (naive-UTC `started_at` strings
      parsed as local time, not UTC) that made every timed attempt
      auto-submit instantly outside UTC — see the entry for the fix and its
      regression tests. Live-verified: correct countdown, the
      normal→warning color transition, and genuine auto-submit-at-zero
      across three attempts; the pure destructive (red) color state wasn't
      caught on screen (its window is too short relative to
      screenshot/tool round-trip latency) but its threshold logic is
      unit-tested and the states either side of it were confirmed live —
      see the entry for the full breakdown. `docs/ROADMAP.md`'s "Exam
      practice" box is now checked.
    - **6G — Results: complete, live-verified.** See this file's Phase 6G
      Status Snapshot entry above. `GET .../attempts` (list-my-attempts) +
      a new `.../quizzes/[quizid]/results/` history page, linking into
      6E-3's existing per-attempt breakdown rather than duplicating it.
      Live-verified end-to-end in the real browser (three seeded attempts —
      passed/needs-review/in-progress — rendered correctly, both new
      cross-links round-tripped, network call to the new endpoint
      confirmed, no console errors); QA fixtures deleted afterward.
    - **6H — Basic progress tracking: complete, live-verified.** See this
      file's Phase 6H Status Snapshot entry above. New `services/orgs/
      progress.py` (`GET /orgs/{org_id}/progress`) + new `.../progress/`
      page, both reusing 6G's `computeAttemptOutcome` and results-history
      page rather than duplicating them. Live-verified end-to-end (two
      seeded quizzes, correct aggregation and sort order, row navigation
      into 6G's results page, network call confirmed, no console errors);
      QA fixtures deleted afterward. **All five `docs/ROADMAP.md` Phase 6
      boxes are now checked**, but Phase 6 itself is not yet declared
      complete — see 6I below.
    - **6I — Cross-Cutting Verification: complete.** See this file's Phase
      6I Status Snapshot entry above. Full backend regression (5563 passed,
      10 pre-existing unrelated failures), full frontend suite (same
      pre-existing baseline), Ruff/ESLint/TypeScript/`git diff --check` all
      clean on every Phase 6 file, and a full live walkthrough of the
      entire student + admin journey (question bank → quiz authoring →
      quiz taking → exam practice timer + genuine auto-submit → grading →
      per-attempt results → attempt history → progress tracking), all
      through the real dashboard/browser UI this time. No bugs found, no
      code changes made. **Phase 6 — Exams & Practice is now complete.**
    **Phase 6 is complete.** Next per `docs/ROADMAP.md`: Phase 7 — Parents.
    Not started; do not begin automatically per `CLAUDE.md`'s "don't
    silently begin the next increment" rule.
12. **Phase 7A — Parent account capability (self-service `is_parent` flag):
    complete.** A plan-only session first investigated existing infra (no
    global account-type/persona concept existed; org-scoped `Role`/
    `RoleTypeEnum` was ruled out — see `docs/ARCHITECTURE.md` §
    "Parents (Phase 7A)") and got two decisions from the user: 7A adds a
    persisted global boolean rather than folding into 7B or a new global
    `Role`, and 7B (next) will use a child-approves-parent's-request consent
    flow. Implementation, this session:
    - Added `is_parent: bool = False` to `UserBase`
      (`apps/api/src/db/users.py`) — flows into `User` (table), `UserCreate`,
      `UserUpdate`, `UserRead` automatically; deliberately **not** added to
      `UserReadPublic` (doesn't inherit `UserBase`) so it stays invisible to
      other users' profile lookups.
    - New migration `apps/api/migrations/versions/
      72573d15ab51_add_is_parent_to_user.py` — `ADD COLUMN is_parent BOOLEAN
      NOT NULL DEFAULT false`. (Picked a fresh revision id after discovering
      an initial pick collided with a pre-existing `a1b2c3d4e5f6` migration
      already in the tree — not this session's file.)
    - No new endpoint/service: reused the existing `PUT /users/{user_id}` →
      `update_user()` (`services/users/users.py:523`) generic
      `model_dump(exclude_unset=True)` set-attr loop, which already applies
      RBAC (`rbac_check` — self-update always allowed, cross-user update
      needs the existing roles/authorship check) and an IDOR-safe target-user
      check. `is_parent` was deliberately kept out of `_PROTECTED_FIELDS` so
      it stays self-settable like `bio`/`avatar_image`.
    - Tests added to `apps/api/src/tests/services/test_users_service.py`
      (`TestIsParentField`): default is `false`; a user can set/unset their
      own flag and it round-trips through both the DB row and the returned
      `UserRead`; the field is absent from `UserReadPublic.model_fields`;
      another user's attempt to set it is rejected by the existing RBAC
      check (mocked to simulate denial) with the target's flag left
      unchanged — confirms no new bypass, not new authorization logic.
    - **Verification**: focused suite
      (`src/tests/services/test_users_service.py`, 34 passed) plus a wider
      regression pass over every other test touching `update_user`/users
      routers (`test_user_email_validation.py`, `admin/test_user_metadata.py`,
      `routers/test_*` filtered to `-k "user"` — 96 passed, 0 failed).
      Migration round-trip verified live against the running dev Postgres:
      `alembic upgrade head` → `downgrade -1` → `upgrade head`, all clean.
      Ruff clean on all three changed/added files (using the CI-pinned 0.15.9
      — a plain `uvx ruff` resolved 0.16.4 first, whose expanded default
      rule set flagged unrelated pre-existing style in files this increment
      only touched incidentally, e.g. `DTZ005`/`UP045` throughout the
      pre-existing test file; 0.15.9 confirmed clean, matching CI).
      `git diff --check` clean on all changed/new files. No frontend/browser
      verification — 7A is backend-only by design (see Limitations).
    - **Limitations / deliberately deferred**: no settings-page UI toggle for
      `is_parent` yet — reachable today only via direct API call. Decided
      against building one now to avoid dead UI with no downstream effect;
      revisit alongside 7B when there's an actual relationship flow to pair
      it with.
    - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new
      § "Parents (Phase 7A)" decision entry (data model choice + rationale,
      and the reused-endpoint/security boundary). `docs/ROADMAP.md`'s
      "Parent account capability" box is left unchecked: it's reachable only
      via direct API call with no UI yet, the same "backend-only, no
      frontend at all" state that kept every Phase 6 box unchecked through
      6A–6D — check it once a settings toggle actually exposes it (planned
      alongside 7B, see Limitations).
    **Phase 7 is IN PROGRESS.** Next: 7B — parent-child relationship
    (child-approves-parent's-request, modeled on `OrganizationFollow`). Not
    started; do not begin automatically per `CLAUDE.md`'s "don't silently
    begin the next increment" rule.
13. **Phase 7B — Parent-child relationship, backend only: complete.** An
    analysis-first session investigated existing infra (`OrganizationFollow`'s
    join-table shape, `ResourceAuthor`'s status-enum convention, the
    `Notification` table's hard non-nullable FK to `channelvideo` which rules
    it out for reuse here) and got two decisions from the user: the parent
    identifies the child by **username** (reuses the existing
    auth-gated-lookup enumeration convention), and this increment is
    **backend only**, mirroring 7A — the settings-page UI (is_parent toggle +
    request/approve screens) is deferred to a follow-up 7B-frontend
    increment. Implementation, this session:
    - New table `parentchildlink` (`apps/api/src/db/parent_child_links.py`):
      `parent_user_id`/`child_user_id` FKs to `user.id` (CASCADE), a
      `status` enum (`PENDING`/`APPROVED`/`REJECTED`), `link_uuid`, dates,
      and a `UniqueConstraint(parent_user_id, child_user_id)` — one row per
      pair, re-requesting after a rejection reopens it rather than
      duplicating. Migration `apps/api/migrations/versions/
      23f2681a2070_add_parent_child_link_table.py`, chained after 7A's
      `72573d15ab51`. Also added `ParentChildLinkRead`, the response
      projection (mirrors `OrganizationFollowStatus`'s non-table-model
      convention).
    - New service `apps/api/src/services/users/parent_links.py`:
      `request_parent_link` (403 if `current_user.is_parent` is false, 400
      on self-link, 404 generic-message on unknown username — matches
      `read_user_by_username`'s enumeration guard — idempotent while
      PENDING), `list_pending_parent_links` (child-scoped), and
      `respond_to_parent_link` (only the target child may approve/reject;
      wrong-user or unrelated caller gets 404, not 403, so a caller can't
      distinguish "not yours" from "doesn't exist" — an IDOR guard, not a
      new authz mechanism). `list_my_parent_links` (APPROVED rows on either
      side) is included now, unused, for 7C to consume directly.
    - New endpoints on the existing `/users` router (not org-scoped — this
      relationship is user-to-user): `POST /users/parent-links/request`,
      `GET /users/parent-links/pending`, `POST
      /users/parent-links/{link_uuid}/respond`. All behind `get_current_user`
      + `resolve_acting_user_id`, same pattern as `follows.py`/
      `notifications.py`.
    - Discovery of a pending request is poll-based (`GET .../pending`), not
      push — deliberately did **not** extend the `Notification` table (see
      the ruled-out-reuse note above); a push notification is out of scope
      for this increment and would be a separate later addition if wanted.
    - **Migration note**: the local dev environment runs a hot-reloading
      `uvicorn --reload` process whose startup calls
      `SQLModel.metadata.create_all` for any *missing* table (see
      `src/core/events/database.py::_bootstrap_schema`) — it does not add
      missing *columns* to existing tables. Editing `db/parent_child_links.py`
      while that process was live caused it to race with manual
      `alembic upgrade`/`downgrade` testing in this session, at one point
      leaving the dev DB's `user.is_parent` column dropped (a real
      `downgrade -1` executed) while the reload process silently recreated
      `parentchildlink` around it. Fixed by restoring `is_parent` via a
      real `alembic upgrade`, confirming the live `parentchildlink` schema
      matched the migration's target column-for-column (including that the
      `status` field is a native Postgres enum, `parentchildlinkstatusenum`,
      matching the `resourceauthorshipstatusenum` convention — an initial
      draft used a plain `VARCHAR` and had to be corrected), then
      `alembic stamp head` to sync tracking. Round-trip correctness was
      verified via `alembic upgrade/downgrade --sql` (offline mode, no DB
      contention) rather than a live round-trip, to avoid re-racing the
      reload process — this is a documented deviation from 7A's live
      round-trip verification, not a gap in what was checked.
    - **Verification**: focused suite (`test_parent_links_service.py`, 9
      passed; `test_parent_links_router.py`, 7 passed) plus a wider pass
      over every other users/follows/notifications test (50 passed, 0
      failed) — no regressions. Full backend regression:
      `TESTING=true pytest src/tests/` → **5582 passed, 29 skipped, 11
      failed** (920.55s), and all 11 failures are the exact pre-existing,
      unrelated baseline already logged after Phase 4G (`test_core_events*`,
      `test_active_users`, `test_custom_domains_service` ×3,
      `test_org_invites_service` ×3, `test_podcasts_service` ×2) — none
      touch users/parent-links/follows code. Ruff (0.15.9, CI-pinned) clean
      on every new/changed file. `git diff --check` clean. No
      frontend/browser verification — 7B backend is backend-only by design
      (see the scope decision above).
    - **Limitations / deliberately deferred**: no settings-page UI yet
      (request/approve screens, is_parent toggle) — that's the next
      increment. No push notification for a pending request — child must
      poll `GET /users/parent-links/pending`; revisit only if the frontend
      increment finds polling insufficient. 7C (activity view) still needs
      `list_my_parent_links` wired to an authorized target-user activity
      query — not built.
    - **Documentation**: this entry. `docs/ROADMAP.md`'s "Parent-child
      relationship" box is left unchecked — same "backend-only, no frontend"
      convention as 7A/Phase 6 — check it once the frontend increment ships.
    **Phase 7 is IN PROGRESS.** Next: 7B-frontend — settings-page UI for the
    `is_parent` toggle plus request/approve screens consuming the endpoints
    above. Not started; do not begin automatically per `CLAUDE.md`'s "don't
    silently begin the next increment" rule.

14. **Phase 7B-frontend — settings-page UI for the parent-link flow: complete.**
    An analysis-first session mapped the three already-built endpoints to a
    UI, then implementation found and corrected a placement mistake from the
    analysis: this app ships two separate personal-account-settings surfaces
    — `app/(hub)/account` (SaaS-only management hub, 404s under
    `mode: oss|ee` via `HubLayout`) and the real, org-scoped
    `app/orgs/(withmenu)/[orgslug]/account/[subpage]` (backed by
    `AccountClient`/`AccountSidebar`, rendered through this dev environment's
    single-tenancy collapse of bare paths onto the default org). The analysis
    initially wired the new UI into the SaaS-only page; live browser
    verification caught that `/account` actually resolves to the org-scoped
    surface here, so that edit was reverted and the feature rebuilt against
    the live component tree instead — see docs/ARCHITECTURE.md's new
    decision entry for the full trail.
    - New `AccountFamily` (`apps/web/components/Objects/Account/subpages/
      AccountFamily.tsx`): an `is_parent` toggle (reuses `PUT /users/{id}`
      via the existing `updateProfile`, sourcing username/email/is_parent
      from the session's own `UserRead` — not from `getUser()`'s
      `/users/id/{id}`, which returns `UserReadPublic` and deliberately
      excludes email; using the wrong one 422'd during live testing, see
      Limitations), a request form (client-side self-link/empty-value guard
      via a small pure `validateChildUsername` helper, TDD'd — the one piece
      of this increment with real branching logic; unknown-username 404s
      surface the backend's own generic message unchanged), and a pending-
      requests list (polls `GET /users/parent-links/pending` every 60s,
      mirroring `useNotifications`'s `unreadCount` cadence; resolves each
      requester's display name/avatar via the existing `GET /users/id/{id}`,
      correct there since it's the "look up another user" case).
    - New `apps/web/services/users/parentLinks.ts` + `apps/web/hooks/queries/
      useParentLinks.ts`, structured identically to `services/organizations/
      notifications.ts` / `useNotifications.ts` (this codebase's convention:
      thin fetch wrappers and React Query hooks are not unit-tested here —
      only pure logic like `channelVideoFilters.ts`/`validateChildUsername`
      is). New `queryKeys.parentLinks.pending(userId)` in `lib/query/keys.ts`.
    - Wired into the live surface: `AccountSidebar.tsx` and
      `AccountActionsMobile.tsx` gained a `family` nav item;
      `AccountClient.tsx` renders `AccountFamily` for it;
      `account/[subpage]/page.tsx`'s `VALID_SUBPAGES` and title map extended.
      Added the `account.family` key to `locales/en.json` and `ar.json` (the
      two kept in lockstep by the existing RTL-guard test; other locales
      already tolerate lag on newer keys, e.g. `two_factor`).
    - **Tests**: `apps/web/tests/parent-link-validation.test.mjs` (6 cases,
      TDD'd RED→GREEN) covers `validateChildUsername`. No new hook/component
      tests — matches the repo's existing convention for this class of file
      (no test exists for `useNotifications`/`notifications.ts` either).
    - **Verification**: `bun run lint:strict` clean on every new/changed
      file. `bunx tsc --noEmit` clean across the whole app. Full frontend
      suite: 174 passed, 13 failed, 2 errors — all pre-existing and
      unrelated (billing-internal-key env-var tests, an Arabic-translation
      timeout, a missing `catalog-pagination` module from earlier
      in-progress work), confirmed unrelated by file scope. `git diff
      --check` clean. Live browser verification against the real dev
      environment (`mode: saas`, `tenancy: single`): toggle flips
      `is_parent`, persists across reload, session refreshes via
      `session.update(true)`; self-link and unknown-username cases handled
      correctly (client guard and backend 404 respectively). The pending-
      requests list and accept/reject flow were verified by mocking just
      the three network responses in-page (`fetch` intercepted for
      `GET .../pending`, `GET /users/id/999`, `POST .../respond`) rather
      than against a second real account — see Limitations.
    - **Limitations**: creating a second real account to exercise the
      accept/reject flow end-to-end against live data was blocked by this
      dev environment's own configuration (`mode: saas` enforces
      email-verification-before-login, and account creation itself 503s
      because no mail service is configured locally) — an environment gap,
      not a defect in this increment. The mocked-fetch check confirms the
      frontend calls the right endpoints with the right payloads and renders
      correctly; it does not confirm the already-tested backend behavior
      again. No backend files were touched.
    - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new
      decision entry on the two account-settings surfaces. `docs/ROADMAP.md`'s
      "Parent account capability" and "Parent-child relationship" boxes are
      now both checked — the `is_parent` toggle built here is 7A's deferred
      frontend as well as 7B's.
    **Phase 7 is IN PROGRESS.** Next: 7C — basic learning activity view
    (parent-side, read-only, authorized against `list_my_parent_links`'s
    APPROVED rows). Not started; do not begin automatically.

15. **Phase 7C — Basic learning activity view: complete.** Analysis-first session with two
    user-decided forks (both accepted as recommended): the child's quiz progress is aggregated
    **cross-org** rather than extending 6H's per-org endpoint (avoids needing a new "list a
    user's org memberships" endpoint just to support a channel-picker), and the activity URL
    identifies the child by numeric `child_user_id` rather than username. Implementation:
    - **Backend, new**: `apps/api/src/services/users/child_progress.py` —
      `ChildQuizProgressSummary` (6H's `QuizProgressSummary` fields + `org_id`/`org_name`/
      `org_slug`) and `get_child_quiz_progress`, authorized by an APPROVED `ParentChildLink`
      lookup (`_require_approved_link`, 404-not-403 — same IDOR convention as
      `respond_to_parent_link`), then a `QuizAttempt` × `Quiz` × `Organization` join filtered to
      the child's `user_id` with no org filter. Two new endpoints on `/users`:
      `GET /parent-links/mine` (finally wires up `list_my_parent_links`, which 7B built and left
      completely unrouted and untested) and `GET /parent-links/children/{child_user_id}/quiz-progress`.
    - **Backend tests**: 3 new `list_my_parent_links` service tests (both-directions visibility,
      excludes PENDING/REJECTED, requires auth — closing a real gap, this function had zero
      coverage since 7B), 9 new `get_child_quiz_progress` service tests (no link / pending /
      rejected / wrong-direction / unrelated-parent all 404; empty when no attempts; cross-org
      aggregation; isolation from other users' attempts on the same quiz), 6 new router tests
      (`mine` and `children/{id}/quiz-progress`, mocked-service pattern matching
      `test_parent_links_router.py`'s existing style). Ruff (0.15.9, CI-pinned via
      `uv run --with ruff==0.15.9`, matching CI exactly after an unpinned run showed
      version-drift noise) clean.
    - **Frontend, new**: `AccountFamily.tsx` gained a "Linked family" section (both directions
      per user's choice — parent-of-child rows get a "View activity" button, child-of-parent
      rows are informational only), consuming a new `useMyParentLinks` hook. New page
      `app/orgs/(withmenu)/[orgslug]/account/family/[childUserId]/page.tsx` +
      `AccountFamilyChildActivity.tsx` (reuses `progress.tsx`'s row-rendering pattern —
      attempts/best-recent-score/pass-fail badge — but rows are inert, unlike `progress.tsx`'s
      own click-through to `/quizzes/{id}/results`, since that page is self-scoped and would
      show the *viewer's* attempts, not the child's). `useResolvedUser` (the small
      other-user-profile-fetch hook `PendingLinkRow` had inlined) extracted to
      `hooks/useResolvedUser.ts` so both `AccountFamily` row components and the new activity
      page share it — a refactor, no behavior change.
    - **A real bug found and fixed via live verification, not by the test suite**: the
      unauthorized-child path (a real 404 from a missing `ParentChildLink`) never reached the
      "can't show this activity" UI — `useChildQuizProgress`'s default retry left the query
      stuck oscillating `paused ↔ fetching` with `status` never leaving `pending`, so the
      component's `isLoading`/`isError` guards both read false and it silently fell through to
      the empty-state UI instead. A raw `fetch()` to the identical URL returned the 404 cleanly,
      confirming the bug was in the query's retry path, not the authorization logic. Fixed with
      `retry: false` (a 404 here is a fixed authorization fact, never worth retrying) — see
      docs/ARCHITECTURE.md § "Parents (Phase 7C)" for the full trail. This is exactly the kind of
      thing unit tests (which mock the service layer) cannot catch; only exercising the real
      hook against a real HTTP response surfaced it.
    - **Verification**: `bun run lint:strict` and `bunx tsc --noEmit` clean on every
      new/changed frontend file. Backend: 12 parent-links service tests + 9 child-progress
      service tests + 13 router tests all passed; full backend regression
      (`TESTING=true pytest src/tests/`) → 5600 passed, 11 failed (0:20:09) — the same 11
      pre-existing, unrelated baseline failures logged after 4G/7B (core_events, active_users,
      custom_domains ×3, org_invites ×3, podcasts ×2), confirmed unrelated by file scope.
      Frontend suite: 174 passed, 13 failed, 2 errors — identical to 7B's baseline (billing
      env-var tests, an Arabic-translation timeout, a pre-existing missing module), no new
      failures. Live browser verification against the real dev environment: the toggle/empty
      states from 7B still correct; the real unauthorized-child 404 path (found the bug above);
      the "Linked family" row and the activity page's success path (org-tagged rows, correct
      score/pass-fail badges) verified via a fetch-mock in-page, the same technique used for
      7B's pending-request flow, since — same limitation as 7B — creating a second real linked
      account is blocked by this dev environment's SaaS email-verification gate.
    - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new decision entry
      (cross-org-vs-per-org choice, the retry/paused-query lesson, the child-id-in-URL choice).
      `docs/ROADMAP.md`'s "Basic learning activity view" box is now checked. **Phase 7 is
      COMPLETE** (all three boxes: parent account capability, parent-child relationship, basic
      learning activity view).
- **Phase 8A (Reporting — ChannelVideo/Shorts, submission only): complete** — an authenticated
  viewer can report a `ChannelVideo` (long-form or Short) with a fixed reason; the report is
  stored as `status="OPEN"`. No list/review/resolve endpoint or admin queue yet — that is Phase
  8B ("Content moderation workflow"), a separate, later increment; scope confirmed with the user
  before implementation (single approval covering the schema, reason set, and org_id
  denormalization decisions — see docs/ARCHITECTURE.md § "Trust & Moderation (Phase 8A)").
  - **Backend**: new `db/channel_video_reports.py` (`ChannelVideoReport` — single-purpose FK to
    `channelvideo_id`, same convention as `Notification`/the Phase 4A engagement tables; a
    `UniqueConstraint("channelvideo_id", "reporter_id")` makes a repeat report from the same user
    idempotent rather than a second row, mirroring `ChannelVideoSave`'s abuse-prevention shape).
    Migration `a3c7f92e15b4_add_channel_video_report_table.py` (down_revision `23f2681a2070`,
    the confirmed single head at the time — resolved via real `alembic heads` in WSL after this
    session's `uv`/Python tooling turned out to only be on PATH in a real WSL Ubuntu shell, not
    the Windows git-bash environment the rest of the session runs in; applied cleanly against the
    real dev Postgres). `services/orgs/channel_video_reports.py`
    (`create_channel_video_report` — reuses the existing `get_channel_video` visibility rule
    unmodified, same as every other engagement service; `reason` validated against a fixed
    `ALLOWED_REPORT_REASONS` set server-side — `SPAM`/`INAPPROPRIATE`/`MISINFORMATION`/
    `COPYRIGHT`/`OTHER`, a placeholder set not sourced from any real moderation policy yet;
    `details` optional, capped at `MAX_REPORT_DETAILS_LENGTH=1000`). One new endpoint on the
    existing `orgs` router: `POST /orgs/{org_id}/videos/{channelvideo_id}/report`.
    `services/communities/moderation.py`'s `Community.moderation_settings` was confirmed (again)
    not reusable — it is pre-publish content filtering scoped to `Community`/`Discussion`, not a
    report-after-the-fact mechanism, and doesn't apply to `ChannelVideo` at all.
  - **Tests (TDD)**: 11 new service tests (`test_channel_video_reports_service.py` — create/
    idempotent-repeat/isolated-per-different-user, anonymous 401, invalid reason 422, over-length
    details 422, draft-video 403, missing/cross-org video 404, fixed-reason-set assertion) + 2 new
    router tests (`TestChannelVideoReportEndpoints` appended to `test_orgs_router.py`, mirroring
    `TestChannelVideoCommentEndpoints`). Scoped regression (report service + router + channel
    videos service + engagement model tests): **156 passed, 0 failed.** Full backend suite
    (`TESTING=true pytest src/tests/`, 0:30:42): **5613 passed, 11 failed, 29 skipped** — the
    same 11 pre-existing, unrelated baseline failures logged since 4G/7B (core_events ×2,
    active_users, custom_domains ×3, org_invites ×3, podcasts ×2); 5613 = the 5600-passed
    baseline plus this phase's 13 new tests exactly, confirming no regressions. Ruff (pinned
    0.15.9) clean on all changed backend files.
  - **Frontend**: `services/organizations/channelVideos.ts` gained `reportChannelVideo` +
    `ChannelVideoReportReason`/`ChannelVideoReport` types; `useReportChannelVideo` mutation hook
    added to `useChannelVideoEngagement.ts` (no status query — a report has no toggle state to
    read back, unlike Like/Save/Share, and nothing else in this phase reads report data, so there
    is no cache to update on success). New `components/Objects/Channel/ReportChannelVideoDialog.tsx`
    — a `Dialog` with a reason `Select` + optional details `Textarea`, reusing the exact Dialog/
    Select primitives already shipped for `ChannelVideoCommentsPanel`. Mounted as one small
    flag-icon entry in `ChannelVideoEngagementBar.tsx` (both `horizontal` and `rail` layouts),
    gated on `isAuthenticated` like the Save button — no changes to `video.tsx`/`short.tsx`.
  - **Verification**: `eslint` (strict) and `bunx tsc --noEmit` clean on all changed/new frontend
    files (the repo-wide `tsconfig.json` `baseUrl` blocker logged since Phase 2G-3 is confirmed
    resolved — `tsc --noEmit` now runs clean; the fix landed in `bb245607` before this session).
    **Live backend verification against the real dev environment**: started the FastAPI dev
    server directly (Postgres/Redis were already up via the existing `learnhouse-db-dev`/
    `learnhouse-redis-dev` Docker containers) and minted a real JWT for an existing seeded user
    (`create_access_token({"sub": "<email>"})` — `sub` is looked up as an email, not a username;
    tripped over this once with a username-only token before finding the correct claim shape) to
    exercise the live endpoint via `httpx` against the real Postgres: first report → 200 with
    `status="OPEN"`; repeat report by the same user → 200, same `report_uuid`, confirmed only one
    row exists via a direct `psql` query; invalid reason → 422; anonymous → 401. The smoke-test
    row was deleted afterward. **Browser UI verification**: attempted, but blocked by the same
    standing, pre-existing `(withmenu)/[orgslug]/*` route-group 404 logged since Phase 3F —
    re-confirmed in this session on a freshly started `bun run dev` (both `/orgs/default/videos/1`
    and the unrelated `/orgs/default/home` 404 identically), so this is not something Phase 8A
    introduced. The `bb245607` fix note only covered the `tsconfig.json` `baseUrl` half of that
    commit, not this route-group issue. Same accepted standing limitation as 3F/3G/3H/4B–4H/5B/
    7B/7C: verified via backend tests + live API smoke test + lint/typecheck only.
  - **Deferred (per the approved 8A scope)**: reporting on `ChannelResource` (PDFs/past papers)
    and on comments; any admin-facing list/queue of reports; `status` transitions (resolve/
    dismiss) — all explicitly Phase 8B+ per the approved plan, not a gap in this increment.
  - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new decision entry (the
    unique-constraint/idempotency choice, the fixed placeholder reason set, the denormalized
    `org_id`, and the `sub`-is-an-email JWT-minting note for future live-smoke-test verification).
    `docs/ROADMAP.md`'s "Reporting" box is now checked (noting the ChannelResource/comment scope
    narrowing in the same line).
    **Next per `docs/ROADMAP.md`: Phase 8B — Content moderation workflow** (the admin-facing
    review/resolve surface for the `ChannelVideoReport` rows this phase created). Not started; do
    not begin automatically.
- **Phase 8B (Content moderation workflow): complete** — the admin-facing surface that lists and
  resolves the `ChannelVideoReport` rows Phase 8A creates. No new table/migration — `status`
  already existed; this phase only adds the read/transition surface over it. See
  docs/ARCHITECTURE.md § "Trust & Moderation (Phase 8B)" for the full decision record
  (authorization reuse, one-way status transitions, no audit-trail columns, no cascading action on
  the reported video).
  - **Backend**: `services/orgs/channel_video_reports.py` gains `list_channel_video_reports`
    (optional `status` filter, newest-first, scoped to `org_id`) and `resolve_channel_video_report`
    (`status` → `RESOLVED`/`DISMISSED` only — `OPEN` is not a valid transition target, so a
    reviewed report can't be reopened via this endpoint). Both gate on a locally-defined
    `_require_channel_admin` (same duplicated-per-module convention as `questions.py`/
    `channel_resources.py`/`quizzes.py` — superadmin bypass baked into `is_org_admin`), so a
    channel's own owner/admin reviews reports against their own channel's content, same as every
    other admin-only channel action. Two new endpoints on the existing `orgs` router: `GET
    /orgs/{org_id}/reports` (optional `?status=`) and `PATCH /orgs/{org_id}/reports/{report_uuid}`
    (`{"status": ...}`), mirroring `questions.py`'s `api_list_questions` shape.
  - **Tests (TDD)**: 20 new service tests appended to `test_channel_video_reports_service.py`
    (list: scoping to org, newest-first ordering, status filtering, non-admin/anonymous rejection,
    cross-org isolation proven via a second `UserOrganization` row rather than relying solely on
    the 403 guard; resolve: RESOLVED/DISMISSED transitions, invalid-status 422, missing/cross-org
    report 404, non-admin/anonymous rejection, fixed-status-set assertion) + 6 new router tests
    (`TestChannelVideoReportEndpoints` extended in `test_orgs_router.py`, mirroring
    `TestChannelVideoCommentEndpoints`). Scoped regression (router + reports service + channel
    videos service + engagement/channel-video model tests): **182 passed, 0 failed.** Ruff (pinned
    0.15.9) clean on all changed backend files.
  - **Frontend**: new `services/organizations/channelVideoReports.ts`
    (`listChannelVideoReports`/`resolveChannelVideoReport`, reusing the `ChannelVideoReport` type
    from `channelVideos.ts`) + `hooks/queries/useChannelVideoReports.ts`
    (`useChannelVideoReports`/`useResolveChannelVideoReport`, mirroring `useQuestion.ts`'s
    admin-only-query-gated-on-access-token shape) + a `channelVideoReports.list` query key. New
    `/dash/moderation` page (`page.tsx`/`client.tsx`) mirroring `dash/questions`'s list-with-filter
    layout (Breadcrumbs, status-tab `Select`, skeleton/error/empty states) — status tabs
    Open/Resolved/Dismissed/All (default Open); each report card shows its reason, optional
    details, relative report date, a "View video" link, and Resolve/Dismiss buttons (hidden once a
    report is no longer OPEN — no reopen UI, matching the one-way backend transition). New
    "Moderation" entry added to `DashLeftMenu.tsx` (`Flag` icon, same `MenuLink` pattern as
    Questions/Quizzes); not added to `DashMobileMenu.tsx`, which already omits Questions/Quizzes
    too — consistent with that existing scope, not a gap introduced here.
  - **Verification**: ESLint (`lint:strict`) and `bunx tsc --noEmit` clean on all changed/new
    frontend files. Full `bun test tests`: **174 passed, 13 failed, 2 errors** — the same
    pre-existing, unrelated baseline documented since Phase 6/7 (`billing-internal-key.test.mjs`,
    `catalog-pagination.test.mjs`'s missing fixture, the `ar.json` coverage timeout); no
    regressions (pass count is higher only because more test files/assertions exist now than at
    the last-documented 168-pass baseline — no test file was added this phase).
  - **Known limitation — live browser verification not possible**: same standing app-wide Next.js
    `[dynamicSegment]/(routeGroup)/page.tsx` 404 regression logged since Phase 3F/4B–4H/5B/7B/7C/8A
    (`/orgs/[orgslug]/(withmenu)/*` — note `/dash/moderation` itself is **not** under
    `(withmenu)`, it's under the plain `[orgslug]/dash/*` tree like every other dash page, but the
    watch page it links out to is). Not independently re-diagnosed this phase; verified via
    backend tests + lint/typecheck only, same accepted standard as prior phases. No live API smoke
    test was run this phase (8A already proved the report-creation path live; 8B is a pure
    read/transition layer over the same rows, exercised thoroughly by the scoped backend suite
    above).
  - **Deferred (per the 8B scope, consistent with 8A's boundaries)**: reviewer/timestamp audit
    trail, reopening a resolved/dismissed report, cascading action on the reported video (manual
    unpublish/delete remains a separate, existing admin action), reporting/moderation of
    `ChannelResource` or comments (still Phase 8A's original deferral), bulk actions, pagination
    (list has no limit/offset — same precedent as `ChannelVideoCommentsPanel`'s `limit=100`
    single-fetch convention, deferred until report volume warrants it).
  - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new decision entry (the
    authorization-reuse choice, one-way status transitions, no-audit-trail rationale, no-cascade
    rationale). `docs/ROADMAP.md`'s "Content moderation workflow" box is now checked.
    **Next per `docs/ROADMAP.md`: Phase 8 continues with "Teacher/organization verification"**,
    then "Basic admin tools". Not started; do not begin automatically.
- **Phase 8C (Teacher/organization verification): complete** — a superadmin-grantable `Organization.is_verified`
  flag and a public "Verified" badge. Scoped down from the roadmap line during planning (approved by the user
  before implementation): flag only, no application/request workflow, no audit-trail columns (who/when) — see
  docs/ARCHITECTURE.md § "Trust & Moderation (Phase 8C)" for the full decision record (why superadmin-only
  instead of `is_org_admin`, why the platform-wide `/admin` dashboard couldn't be reused, why the field is kept
  out of `OrganizationUpdate`).
  - **Backend**: `Organization.is_verified: bool` (new migration `b7e4f1a92c83`, applied to the dev DB this
    session). New `services/orgs/verification.py`: `_require_superadmin` (reuses `is_user_superadmin` directly —
    not the EE-gated `require_superadmin` dependency, and not `is_org_admin`, so a channel can never verify
    itself) and `set_org_verification`, checked *before* the org-existence lookup so a non-superadmin gets 403
    rather than a 404 that would leak which org ids exist. New endpoint on the existing `orgs` router: `PATCH
    /orgs/{org_id}/verification` (`{"is_verified": bool}`).
  - **Tests (TDD)**: 7 new service tests (`test_org_verification_service.py`) — superadmin can verify/unverify;
    anonymous (401), regular member (403), **the channel's own admin (403 — the key self-verification guard)**,
    missing org (404), and superadmin-check-before-org-existence (403 not 404) — + 3 new router tests
    (`TestOrgVerificationEndpoint` in `test_orgs_router.py`, mirroring `TestChannelVideoReportEndpoints`). Scoped
    regression (orgs router + new service + `test_superadmin.py`): **107 passed, 0 failed.** `uvx ruff@0.15.9`
    clean on all changed backend files.
  - **Frontend**: badge only in `ChannelHeader.tsx` (a `BadgeCheck` icon next to the org name when
    `org.is_verified`) — not added to video/short cards or search listings this phase (deferred, not a gap).
    Toggle added to `OrgEditOther.tsx` (existing settings tab), gated on `session?.data?.user?.is_superadmin
    === true` read directly off the NextAuth session — **not** `useSuperadminStatus`/`getSuperadminStatus`,
    which call `ee/superadmin/status`, a route that does not exist anywhere in this OSS backend (confirmed: no
    `superadmin` router prefix under `apps/api/src`). New `services/organizations/verification.ts`
    (`setOrgVerification`) + `hooks/queries/useOrgVerification.ts` (`useSetOrgVerification`, invalidates
    `queryKeys.org.detail`).
  - **Verification**: ESLint (`lint:strict`) and `bunx tsc --noEmit` clean on all changed/new frontend files.
    Full `bun test tests`: **174 passed, 13 failed, 2 errors** — same pre-existing baseline documented since
    Phase 6/7/8B (no regressions, no new test file needed for this UI). `git diff --check` clean.
  - **Known limitation — live browser verification not possible**: same standing app-wide Next.js
    `(withmenu)/[orgslug]/*` route-group 404 logged since Phase 3F/4B–4H/5B/7B/7C/8A/8B; not independently
    re-diagnosed this phase. Verified via backend tests + migration applied live against the dev Postgres +
    lint/typecheck only, same accepted standard as prior phases.
  - **Deferred (per the approved 8C scope)**: application/request workflow (channel owner requesting
    verification), audit-trail columns (`verified_by_id`/`verified_at`), badge placement beyond the channel
    header (video/short cards, search/directory listings), and any general admin UI — that is explicitly Phase
    8D ("Basic admin tools")'s job, not built here.
  - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new decision entry (the superadmin-vs-org-
    admin rationale, the EE-admin-dashboard conflict and why it ruled out reusing `/admin`, the
    OrganizationUpdate exclusion, the no-audit-trail rationale). `docs/ROADMAP.md`'s "Teacher/organization
    verification" box is now checked.
    **Next per `docs/ROADMAP.md`: Phase 8 continues with "Basic admin tools" (8D).** Not started; do not begin
    automatically.
- **Phase 8D (Basic admin tools): complete** — closes the exact gap 8B's own docs flagged as deferred ("no
  cascading action on the reported video... left for the admin to take manually"): the moderation queue
  (`/dash/moderation`) now has "Unpublish" and "Delete video" quick actions on each OPEN report, calling the
  existing Phase 2A `PUT .../publish` / `DELETE .../videos/{id}` endpoints directly. Scope was narrowed from the
  bare roadmap line ("Basic admin tools" — no PRD elaboration, same underspecification 8C had) to this single
  capability during planning, confirmed with the user before implementation: no suspend/ban, no platform-wide
  admin/org-listing surface (the existing `/admin` dashboard is EE-gated — see docs/ARCHITECTURE.md § "Trust &
  Moderation (Phase 8C)" — and building an OSS equivalent was explicitly ruled out as inventing new platform-wide
  admin infrastructure), no bulk actions, no auto-resolve. See docs/ARCHITECTURE.md § "Trust & Moderation (Phase
  8D)" for the full decision record.
  - **Backend**: **zero changes.** Both endpoints (`set_channel_video_published`/`delete_channel_video`) already
    existed since Phase 2A and are already gated by `_require_channel_admin` — the same authorization already
    governing the moderation queue itself, so no new RBAC surface. This is the first time either was actually
    wired into any admin-facing UI: `setChannelVideoPublished` previously had exactly one caller (the
    upload-completion auto-publish step), and no frontend `deleteChannelVideo` wrapper existed at all before
    this phase.
  - **Frontend**: `services/organizations/channelVideos.ts` gains `deleteChannelVideo` (mirrors
    `updateChannelVideo`'s fetch-wrapper shape exactly). New `hooks/queries/useChannelVideoAdmin.ts`
    (`useSetChannelVideoPublished`/`useDeleteChannelVideo`) — deliberately not invalidating or touching the
    reports query, so resolving a report stays a fully separate action from acting on the video (confirmed with
    the user: no auto-resolve). `/dash/moderation/client.tsx`'s existing OPEN-only action row gains "Unpublish"
    (plain button, calls the mutation blindly — no per-report video-state fetch, confirmed with the user as
    acceptable since an already-unpublished video is a harmless no-op) and "Delete video" (wrapped in the
    existing `ConfirmationModal`, `status="warning"`, mirroring `OrgEditDangerZone.tsx`'s destructive-action
    pattern exactly).
  - **Tests**: no new backend tests (no backend code changed) and no new frontend unit tests — matches this
    codebase's actual convention: no other simple fetch-wrapper service function in `channelVideos.ts` has a
    dedicated bun test (the `bun test tests` suite covers functions with real logic, not thin fetch wrappers).
    Both underlying endpoints already have pytest coverage from Phase 2A.
  - **Verification**: ESLint (`lint:strict`) and `bunx tsc --noEmit` clean on all changed/new frontend files.
    Full `bun test tests`: **174 passed, 13 failed, 2 errors** — same pre-existing baseline documented since
    Phase 6/7/8B/8C (no regressions). `git diff --check` clean.
  - **Known limitation — live browser verification not possible this session**: the API dev server was not
    running (only the `learnhouse-db-dev`/`learnhouse-redis-dev` Docker containers were up) and was not started
    to avoid a full environment bootstrap for a change with zero new backend logic over already-proven endpoints
    — same acceptance rationale as the standing route-group 404 limitation logged since Phase 3F (8A–8C). Not
    independently verified live; verified via lint/typecheck only.
  - **Deferred (per the approved 8D scope)**: report auto-resolution when a video is unpublished/deleted, bulk
    moderation actions, any platform-wide admin/org-listing surface, suspend/ban of any kind, audit trail of who
    took which action, accurate Publish/Unpublish button state (would require a per-report video-state fetch).
  - **Documentation**: this entry; `docs/ARCHITECTURE.md` gained a new decision entry. `docs/ROADMAP.md`'s
    "Basic admin tools" box is now checked — **Phase 8 is complete.**
    **Next per `docs/ROADMAP.md`: Phase 9 — V1 Hardening.** Not started; do not begin automatically.
- **Phase 9A (Security review): complete** — an audit of the authorization, data-exposure, and
  abuse-resistance properties of the API surface LearnOrbit added in Phases 1–8, plus one code fix. Phase 9's
  roadmap line is a bare six-item list with no sub-definitions and no PRD elaboration (the same
  underspecification 8C/8D hit), so the increment was scoped during planning and the scope stated before
  implementation: 9A = "Security review" (roadmap order); audit + fix genuine LearnOrbit defects only; backend
  deep, frontend shallow; rate limiting identified but not implemented; inherited LearnHouse posture
  documented, not retrofitted. See docs/ARCHITECTURE.md § "V1 Hardening (Phase 9A)" for the decision record on
  the one fix.
  - **Security standard applied — the pre-existing `docs/SECURITY_REVIEW.md` was reviewed as part of this
    assessment.** That file (present in the working tree but untracked) is the project's own security
    standard, and 9A used it as the review checklist rather than inventing its own criteria: findings are
    classified by its severity guidelines (§52), and the audit's depth ordering follows its
    highest-priority security areas (§55 — authorization first, then organization/tenant isolation), which is
    why those two got the deepest coverage. The sections covering the audited surface — §5 authorization/IDOR,
    §6 multi-tenant isolation, §7 API security/mass assignment, §8 input validation, §11 CSRF, §13 file
    upload, §21 rate limiting, §25 data exposure, §27 user-generated content — are what the "Verified correct"
    items and findings F1–F6 below map back to. Two of its requirements are the direct source of the two
    deferred findings: §21 (rate limiting) → F2, and §11 (CSRF) → F3; both remain deferred here, not folded
    into this increment. Its deployment/infra sections were read and deliberately mapped to later increments
    rather than audited now — see "Not reviewed in 9A" below.
  - **Scope audited**: 20 new service modules (`services/orgs/channel_videos|channel_resources|
    channel_video_{comments,likes,saves,shares,reports}|follows|progress|questions|quizzes|quiz_attempts|
    verification`, `services/notifications/notifications`, `services/users/{parent_links,child_progress}`), 3
    new routers (`feed`/`notifications`/`shorts`), the LearnOrbit endpoints on `routers/orgs/orgs.py` and
    `routers/users.py`, and 13 new `db/` models. Frontend limited to client-only-gating and UGC-rendering
    checks across the 36 LearnOrbit `services/organizations/*` + `hooks/queries/*` files. Inherited LearnHouse
    code out of scope except at LearnOrbit call sites.
  - **Verified correct (no change needed)** — the existing patterns hold:
    - Every engagement service (likes/saves/shares/comments/reports) routes its visibility decision through
      `get_channel_video`, so none can be used as an existence oracle for a draft/unlisted/private video.
    - Answer-key containment is intact on every student-reachable path: `_strip_question` removes `is_correct`
      from options **and** pops `accepted_answers` (the key for `short_answer`/`number_answer`), and
      `explanation` is a top-level `Question` column absent from `QuestionForAttempt`. The one endpoint that
      returns full question `contents` (`list_quiz_questions`) is `_require_channel_admin`-gated.
    - All six question-bank operations are admin-gated; `_get_*_or_404` helpers are org-scoped throughout, so
      cross-org isolation holds on every read and mutation.
    - IDOR guards use 404-not-403 where existence itself is sensitive (`_get_own_pending_link_or_404`,
      `_require_approved_link`), and `request_parent_link` returns a generic 404 for an unknown username.
    - PII projection: comments **and** notifications both serialize authors through the pre-existing
      `UserReadAuthor`, never `UserRead` — no email/`is_superadmin`/raw profile blobs. Notification rows carry
      ids only, no comment text.
    - No mass-assignment: `ChannelVideoUpdate`/`ChannelResourceUpdate` exclude `org_id`, `activity_id`,
      `published`, and `visibility`, so the `exclude_unset` + `setattr` loop cannot repoint a row at another
      org's content.
    - No `dangerouslySetInnerHTML` anywhere in the LearnOrbit-added frontend.
    - PDF upload is correctly delegated: `channel_resources.py` never accepts a file, only an `activity_id`
      that must already belong to the same org, created through the unmodified validated `documentpdf`
      endpoint.
  - **Finding F1 (genuine LearnOrbit gap — FIXED this increment): an APPROVED `ParentChildLink` could never be
    revoked.** `respond_to_parent_link` rejects non-PENDING links, and no other endpoint mutated an approved
    one — so once a child approved, the parent retained permanent, cross-org read access to the child's entire
    quiz history via `get_child_quiz_progress`. Not present in Phase 7B's documented deferral list (which
    covered UI, push notifications, and 7C wiring only), so a gap rather than an accepted boundary.
    - **Backend**: new `revoke_parent_link` in `services/users/parent_links.py` (either party may revoke;
      404-not-403 for a non-party; 400 if the link is not APPROVED; sets `REJECTED`, so no migration and no new
      enum value) + `POST /users/parent-links/{link_uuid}/revoke` on the existing `users` router.
    - **Frontend**: `revokeParentLink` service wrapper, `useRevokeParentLink` hook (invalidates both
      `parentLinks.mine` and `parentLinks.childProgress` so a revoked parent's activity view cannot linger),
      and a `ConfirmationModal`-wrapped "Remove link" action on each row of the existing `AccountFamily`
      linked-family list — shown to both sides, with side-specific confirmation copy, reusing the same
      destructive-action modal pattern as `OrgEditDangerZone`/8D. Without UI the control would exist only for
      curl, which is not a real control for a student.
    - **Tests (TDD, RED confirmed before implementation)**: 7 new service tests appended to
      `test_parent_links_service.py` (child revokes; parent revokes; unrelated user 404 with the link left
      APPROVED; anonymous 401; non-approved link 400; **revocation immediately cuts off
      `get_child_quiz_progress`**; re-request after revocation reopens as PENDING and does *not* restore
      access) + 3 router tests (`TestRevokeParentLink`). The RED run failed first on `ImportError: cannot
      import name 'revoke_parent_link'`, then on `AttributeError` for the router symbol — both watched to fail
      before any implementation existed.
  - **Finding F2 (genuine gap — NOT fixed, deferred by the approved scope): no rate limiting on any LearnOrbit
    mutation endpoint.** Comments, reports, follows, likes, shares, and `request_parent_link` have no
    throttling, while a proven `services/security/rate_limiting.py::check_rate_limit` already exists and is
    used by the AI and auth paths. Concrete impact: report-spam degrades the Phase 8B moderation queue, which
    has no pagination. **Note for whoever picks this up:** the repo's own untracked `docs/SECURITY_REVIEW.md`
    §21 explicitly names Comments, Follows, and Uploads as endpoints requiring rate limits — so this is a
    documented project requirement, not optional polish. Recommended as its own increment (~8 endpoints,
    introduces a Redis dependency on paths that do not currently have one).
  - **Finding F3 (pre-existing LearnHouse, low, NOT fixed): the CSRF origin-validation middleware is never
    registered.** `src/security/csrf.py` defines `CSRFProtectionMiddleware`, but `apps/api/app.py` only calls
    `register_ee_middlewares`, which no-ops because `is_ee_available()` requires an `ee/hooks.py` that does not
    exist on the API side of this repo. Auth does fall back to a cookie (`get_token_from_request`), so this
    would matter — **but `SameSite=Lax` on the JWT cookie (`security/auth.py:80`, `routers/auth.py:194`)
    blocks cross-site POST/PUT/PATCH/DELETE, which covers every LearnOrbit mutation.** Residual risk is
    confined to same-registrable-domain scenarios. `apps/api/app.py` is untouched by LearnOrbit (`git diff
    dev...HEAD` empty), so this is inherited, not introduced. Flagged for 9F (deployment) rather than
    retrofitted here — wiring app-wide middleware is exactly the "broad architectural change" CLAUDE.md says
    to report rather than make unilaterally.
  - **Findings F4–F6 (informational, no action)**: `org_id` is accepted but unused by
    `update_channel_video_comment`/`delete_channel_video_comment` (the author-ownership check is the real
    control, so there is no privilege gain — an API-contract wart, not a defect); notification rows persist
    after an admin loses org access (they carry ids only, no content); and `request_parent_link`'s `is_parent`
    check is UX, not a security boundary, since the flag is self-declared per Phase 7A — the child's approval
    is the actual control. All three are correct as designed.
  - **Verification**: `test_parent_links_service.py` 19 passed; `test_parent_links_router.py` 16 passed;
    scoped regression across parent-links + child-progress + users router/service: **85 passed, 0 failed**.
    `uvx ruff@0.15.9` clean on all changed Python. `bunx tsc --noEmit` clean. ESLint `--max-warnings=0` clean
    on all three changed frontend files. Full `bun test tests`: **174 passed, 13 failed, 2 errors** — the same
    pre-existing baseline documented since Phase 6/7/8B–8D (`billing-internal-key`, `catalog-pagination`'s
    missing fixture, the `ar.json` coverage timeout); no regressions, and no frontend test file added (`bun
    test` covers logic, not thin fetch wrappers — same convention as 8D). `git diff --check` clean.
  - **Known limitation — no live browser or live API verification this session.** The API dev server was not
    running and was not started; the revoke path is exercised by the service and router suites only. The
    standing single-tenancy limitation also means cross-org isolation can only ever be proven via direct API
    calls with two seeded orgs, not through the browser — the audit's cross-org conclusions rest on reading
    the org-scoped query predicates plus the existing backend tests, not on a live multi-org smoke test.
    Stated rather than skipped silently.
  - **Not reviewed in 9A** (outside the approved scope, mapped to later increments): the deployment/infra
    sections of `docs/SECURITY_REVIEW.md` — secrets management, Docker/container, CI/CD, security headers,
    HTTPS, dependency security, DoS, caching, background jobs, payments, webhooks — which belong to 9F; and
    pagination/query-cost concerns (the unpaginated moderation queue, the comment `limit=100` single-fetch),
    which are 9B's. A full line-by-line audit of the 107 LearnOrbit-added frontend files was also not done;
    frontend coverage was deliberately limited to client-gating and UGC rendering.
  - **Documentation**: this entry; docs/ARCHITECTURE.md gained a new decision entry (the reuse-`REJECTED`
    rationale, the either-party and 404-not-403 choices, the re-approval consequence). docs/ROADMAP.md's
    "Security review" box is now checked, with the two deferrals noted inline.
    **Next per `docs/ROADMAP.md`: Phase 9B — Performance review.** Not started; do not begin automatically.
    Two items are queued ahead of it if wanted first: the F2 rate-limiting increment, and the F3
    CSRF-middleware decision for 9F.
- **Phase 9B (Performance review): complete** — a review of the LearnOrbit-added surface from Phases 1–8 for
  query cost, request fan-out, and payload size, followed by an approved three-part fix scope. Like 9A, the
  increment was scoped during planning and the scope approved before implementation, since Phase 9's roadmap
  line is a bare six-item list with no sub-definitions. The review itself was **static analysis only** — the
  API dev server and Postgres were not running and were not started, so no `EXPLAIN`, no query-count
  instrumentation, and no live profiling informed it. Every query-count figure below is read from the code
  path, not measured. Two candidate optimizations were deliberately **not** implemented for exactly that
  reason (see "Deferred pending measurement").
  - **Scope reviewed**: the same 20 service modules / 3 routers / 13 `db/` models as 9A, plus the 6 LearnOrbit
    Alembic migrations (cross-checked against the models — no index drift; every declared `index=True` /
    `Index(...)` has a matching `op.create_index`) and the LearnOrbit frontend (hooks, services, Channel
    components, Shorts/feed/moderation/family pages).
  - **Reviewed with no issue found** (recorded so a later increment doesn't re-litigate them): comment and
    notification listing both batch author/actor lookups through a single `IN` query — no N+1; quiz-attempt
    grading and `_graded_answers` are joined single queries; the 6H/7C progress aggregations are one joined
    query each over a per-user-bounded row set; the moderation queue renders `report.channelvideo_id` directly
    with no per-report video fetch; `get_user_org` and `is_user_superadmin` memoize per `db_session`, so
    repeated `is_org_admin` calls inside one request are free; React Query's defaults
    (`staleTime: 60_000`, `refetchOnWindowFocus: false`, `retry: 1`) are sound; every engagement mutation uses
    `setQueryData`/`setQueriesData` rather than an invalidate round-trip; the unique constraints on
    likes/saves/reports bound per-user row growth (`ChannelVideoShare`'s append-only growth is a documented
    Phase 4A decision, not an oversight); and `creation_date`-as-string orders lexicographically correctly.
  - **9B-1 — pagination on four unbounded list endpoints.** `page`/`limit`, `default=50, ge=1, le=100`,
    matching the existing `routers/orgs/orgs.py` convention. See docs/ARCHITECTURE.md § "V1 Hardening (Phase
    9B)" for the decision record, including the load-bearing rule that the window is applied *after* the
    filters and the visibility predicate, never instead of either.
    - `GET /shorts` (`list_public_shorts`) — the worst case: cross-org, cross-tenant, public, and refetched by
      the Shorts viewer to resolve prev/next. Grew with every Short published anywhere on the platform.
    - `GET /feed` (`list_home_feed`) — returned the union of every followed channel's entire back catalogue.
    - `GET /orgs/{id}/questions` (`list_questions`) — the question bank is designed to accumulate.
    - `GET /orgs/{id}/reports` (`list_channel_video_reports`) — the moderation queue 9A finding F2 named as the
      concrete casualty of the still-deferred reporting rate limit.
  - **9B-2 — four frontend fetch fixes.**
    - `useResolvedUser` was a bare `useEffect` + `useState` fetch sitting outside the query cache entirely —
      one uncached request per row on the family page, duplicated for repeated ids, refetched on every remount.
      Now a `useQuery` keyed on user id (new `queryKeys.publicUsers.byId`). Same signature and same
      `user | null` return, so both call sites are unchanged.
    - `ChannelVideoCommentsPanel` fetched 100 comments unconditionally on every watch page and both Shorts
      rails, to render one integer on a closed trigger. Now a 20-row preview while closed, the full page once
      opened, with `limit` in the query key so a preview can never be served as the complete list. **The
      trigger renders `20+` when the preview is saturated** — capping the fetch without labelling the count
      would have introduced a wrong-count UI regression, which the approved "reduce the limit" fix did not
      anticipate. The three comment mutations now use `setQueriesData` prefix-matching so the preview and full
      entries stay in step.
    - `NotificationBell` lives in the global org nav and fetched 50 hydrated notification rows plus 50 actor
      objects on **every** authenticated page load. Now gated on the dropdown being open; the badge keeps using
      the separate, cheap unread-count endpoint. This one was found *after* the review was delivered, while
      checking two backgrounded greps against the reported findings — the notification listing service itself
      was, and remains, correct; the defect was entirely in when the client chose to call it.
    - `ChannelVideoCard` / `ChannelShortCard` thumbnails gained `loading="lazy" decoding="async"`. They were
      raw `<img>` with neither, so every card in a 4-column grid fetched eagerly including below the fold —
      a deviation from the 27 other components in this repo that already lazy-load.
  - **9B-3 — two query cleanups.** `mark_all_notifications_read` hydrated every unread row into Python to flip
    one boolean; now a single bulk `UPDATE` returning `rowcount` (the `{"marked_read": n}` contract is
    unchanged). `_question_counts` transferred one row per attached question to count them; now a
    `GROUP BY quiz_id` aggregate — callers must keep reading the map with a default of 0, since a quiz with no
    questions produces no GROUP BY row.
  - **Tests (TDD, RED confirmed before implementation)**: 40 new tests. The RED run failed first with
    `TypeError: list_home_feed() got an unexpected keyword argument 'page'` and the equivalent for
    `list_public_shorts` / `list_questions` / `list_channel_video_reports` — all watched to fail before any
    implementation existed. The behaviour-preservation guards (`*_default_call_still_works`, the notification
    scoping/idempotence pair, the mixed question-count case) were green from the start **by design** — they
    exist to prove the refactors changed nothing, not to drive them. Every paginated service additionally
    carries an explicit authorization test: paging must not widen visibility (drafts/unlisted stay excluded),
    must not bypass the 401/403 gate, and must not cross org boundaries.
  - **Verification** (exact): scoped LearnOrbit backend regression across channel-videos, questions, reports,
    notifications, quizzes, comments, resources, quiz-attempts, progress, child-progress, parent-links,
    follows and their routers — **305 passed, 0 failed**. `uvx ruff@0.15.9` clean on all 15 changed Python
    files. `bunx tsc --noEmit` clean. ESLint `--max-warnings=0` clean on all 12 changed frontend files.
    Full `bun test tests`: **174 passed, 13 failed, 2 errors** — the same pre-existing baseline documented
    since Phase 6/7/8B–8D/9A (`billing-internal-key`, `catalog-pagination`'s missing fixture, the `ar.json`
    coverage timeout); no regressions. `git diff --check` clean.
  - **Deferred pending measurement (NOT implemented — this is the point):**
    - **The combined engagement endpoint.** The watch page issues four separate status requests
      (like/save/share/comments) that each re-open with `get_channel_video`, i.e. the same org + video lookup
      done four times; counted from the code, one authenticated watch-page load is ~8 HTTP requests and ~22 DB
      queries, 8 of them redundant repeats. Collapsing them is a new API contract, and 9A's authorization
      argument is currently anchored on each engagement service routing through `get_channel_video`
      individually. Not worth changing on a count read off the source.
    - **A composite/partial index for the Shorts predicate.** Only `content_format` is indexed; `published`,
      `visibility` and `creation_date` are not. Whether that matters depends entirely on the eventual
      long/short mix, which nobody knows yet — and 9B-1's pagination reduces the sort cost more reliably than
      an index would. Add it only if `EXPLAIN ANALYZE` on seeded data shows the sort dominating.
  - **Not fixed, with reason:** `GET /orgs/{id}/videos|resources|quizzes` remain unpaginated. Their section
    components (`ChannelVideosSection`, `ChannelResourcesSection`, `ChannelQuizzesSection`) each issue a
    second, deliberately unfiltered query whose only job is supplying distinct Subject/Topic/Level values for
    the filter dropdowns. Paginating the endpoint without addressing that coupling would silently truncate the
    dropdown options — a correctness bug traded for a performance win. Needs either a dedicated
    filter-options endpoint or an accepted UX change; both are larger than 9B's approved scope.
  - **Acceptable trade-offs, no action:** the section components' double-fetch while a filter is active
    (documented, shares a cache entry when unfiltered); the watch/Shorts 3-deep request waterfall
    (video → activity → course is genuinely sequential — each id comes from the previous response); full
    `description` in list payloads; and the 60s unread-count poll per open tab.
  - **Known limitation — no live browser or live API verification this session.** The dev server was not
    running and was not started, so every change is covered by the automated suites, typecheck and lint only.
    This matters more for 9B than it did for 9A: the four frontend changes alter *when* requests fire, and
    that behaviour is exactly what a browser check would confirm. Unlike 9A, the affected pages (feed, watch,
    Shorts, family, any page with the nav bell) are all single-org surfaces, so the standing single-tenancy
    limitation does **not** block this — it is available as a follow-up, and is the single most valuable
    outstanding check on this increment. Stated rather than skipped silently.
  - **Documentation**: this entry; docs/ARCHITECTURE.md gained a decision entry recording the pagination
    contract, the window-applied-last authorization rule, and the count-must-be-labelled-as-bounded frontend
    convention. docs/ROADMAP.md's "Performance review" box is now checked, with the deferrals noted inline.
    **Next per `docs/ROADMAP.md`: Phase 9C — Accessibility review.** Not started; do not begin automatically.
- **Phase 9C (Accessibility review): complete** — an audit of the LearnOrbit-added frontend from Phases 1–8
  against the project's stated **WCAG 2.1 AA** floor (`docs/DESIGN_SYSTEM.md` §22,
  `docs/UI_UX_IMPLEMENTATION_PLAN.md` UI-13), followed by an approved three-part fix scope. Like 9A and 9B,
  the increment was scoped during planning and the scope approved before implementation, since Phase 9's
  roadmap line is a bare six-item list with no sub-definitions.
  - **Review was static analysis only.** Neither dev server was running (`localhost:3000` and `localhost:1338`
    both refused) and neither was started, so **no browser run, no screen-reader run, no axe scan** informed
    this. Every contrast figure below is computed from the token values in `styles/globals.css`, not sampled
    from a rendered page. Two fixes correct behaviour never confirmed defective at runtime — see "Not
    verified" below.
  - **Scope reviewed**: the 25 components and 37 pages/clients added on `learnorbit-v1`
    (`git diff --diff-filter=A dev...learnorbit-v1 -- apps/web`), ~9,000 lines. Inherited LearnHouse surfaces
    (editor, dash left menu, communities, playgrounds, store) were **not** audited — pre-existing and outside
    the Phase 1–8 boundary.
  - **Reviewed with no issue found** (recorded so a later increment doesn't re-litigate them): all five form
    modals (`UploadChannelVideoModal`, `UploadChannelResourceModal`, `QuestionFormModal`, `QuizFormModal`,
    `ReportChannelVideoDialog`) already wire `<Label htmlFor>` + `aria-invalid` + `aria-describedby` + a
    form-level `role="alert"` + `aria-live="polite"` upload progress — this is the pattern the rest of the app
    should copy, and M7's fix does; the four Channel section headers use correct `h2` + `aria-label`led filter
    Selects + `aria-hidden` icons + full empty/error/retry states; the four card components use `h3`,
    decorative `alt=""`, and keep the edit control a *sibling* of the anchor rather than a button nested in
    one; the watch page has `h1` + `role="list"` metadata chips; engagement toggles use `aria-pressed`
    correctly; Radix primitives are consumed unmodified so focus trap/restore and roving tabindex are
    inherited; `Video.tsx` already resolves caption tracks, so §22's captions requirement is met at the player
    level (creator-supplied captions are a content question, not a code fix); the bottom tab bar already meets
    the 44px touch target; and `--muted-foreground` (4.76:1), `--destructive` (4.53:1) and `--primary`
    (4.55:1) all clear the 4.5:1 text floor.
  - **9C-1 — structure, names and labels (8 fixes).** `OrgMenuChrome.tsx` gained the `<main id="main-content">`
    landmark and a skip link — every org page previously had two `nav`s and a `footer` but **no main**, and no
    bypass mechanism, forcing ~12 tab stops before content (WCAG 2.4.1, Level A, the most severe class found).
    The comment composer and both quiz answer fields were placeholder-only, which §22 forbids outright
    (3.3.2/4.1.2); the sidebar labelled its `<aside>` instead of its `<nav>`; active nav state was colour +
    icon-weight only with nothing in the accessibility tree (`aria-current`); unauthenticated like/share
    counts used `aria-label` on a bare `<span>`, which is not exposed at all; the notification bell's
    `aria-label` overrode its own unread badge; three search inputs were placeholder-only with unnamed clear
    buttons; and the family-link error was a detached `<p>` with no `role="alert"` or field association.
  - **9C-2 — contrast (3 fixes).** `--success` measured **3.31:1** and `--warning` **2.16:1** on
    `--background`, both used as `text-xs` badge text across quiz results, progress, family activity and the
    exam timer. Rather than change the base tokens — legitimately fine at the 3:1 non-text bar, and used by
    icons/fills/borders throughout — 9C added `--success-strong` (5.02:1) and `--warning-strong` (5.05:1) for
    text only. Also swapped `text-neutral-400`/`text-gray-400` body text (~2.6:1) and `text-red-500` (~3.3:1)
    for tokens. See docs/ARCHITECTURE.md § "V1 Hardening (Phase 9C)" for the fill-vs-text rule.
  - **9C-3 — keyboard and live regions (5 fixes).** The Shorts viewer's global ArrowUp/ArrowDown handler
    excluded only INPUT/TEXTAREA/SELECT, so an open Radix dialog or menu — none of those tag names — had its
    arrow keys stolen *and* the page navigated out from under it; it now bails on any open overlay. "Mark all
    read" was a plain `<button>` inside a Radix `role="menu"`, which Radix's roving tabindex never reaches,
    and is now a real `DropdownMenuItem`. The quiz options claimed `role="radiogroup"`/`role="radio"` without
    implementing that pattern's keyboard contract and are now toggle buttons in a labelled group. The exam
    timer switched to `aria-live="assertive"` on a region re-rendering **every second** — one screen-reader
    interruption per second during a timed exam — and now announces at 5min/1min/30s/10s milestones from a
    separate polite region. Advancing a question now moves focus to the prompt, previously never announced.
  - **Deferred, recorded not fixed** (approved as out of 9C scope): **M11** — `prefers-reduced-motion` has
    **zero** occurrences in `apps/web`, affecting 12 `animate-pulse`, 7 `animate-spin`, and the Shorts
    snap-scroll transitions. This is *not* a WCAG 2.1 AA failure (2.3.3 is AAA) but *is* an explicit
    §21/UI-13 requirement, and the Shorts viewer is the case that matters for vestibular-sensitive users.
    Plus 7 Low findings: spinner-only submit buttons lose their accessible name while pending;
    feed/comment/moderation lists are `div` stacks rather than `ul`/`li`; loading→loaded→error transitions
    aren't announced; the verified badge is an SVG with `aria-label` + `<title>` but no `role="img"`; Shorts
    rail buttons (40px) and the follow button (~24px) sit under the §7 44px target (WCAG 2.5.5 is AAA);
    `ChannelHeader`/`AccountFamily` hardcode `text-gray-*` instead of tokens (latent only — **no dark-mode
    toggle ships**, zero `next-themes`/`useTheme` matches, so `.dark` is unreachable); and two orphan
    `<Label>` elements in `AccountFamily` used as section headings. The `<main>` landmark was added to the
    `(withmenu)` tree only — the `dash` tree's chrome is inherited `ClientAdminLayout.tsx`, outside scope.
  - **Verification**: `tsc --noEmit` **clean**. `eslint --max-warnings=0` **clean** on all 19 changed files
    plus the new test. `bun test tests` → **198 pass / 13 fail / 2 errors**, against a **measured baseline of
    174 pass / 13 fail / 2 errors** — the +24 are the new guard test, and the failure set is identical. That
    baseline was established by `git stash push` of only the 9C paths and re-running, not by trusting the
    documented record; the stash popped cleanly and `git stash list` is empty. The 13 failures remain the
    pre-existing `billing-platform-key`, `billing-internal-key`, `catalog-pagination` (missing fixture module)
    and the `ar.json` coverage timeout — none touch the changed files. `git diff --check` clean.
  - **New test**: `apps/web/tests/a11y-guard.test.mjs` (24 assertions) in the existing `rtl-guard.test.mjs`
    style. **No new lint rules and no new dependency** — enabling the fuller `jsx-a11y` set would light up the
    inherited LearnHouse tree, and CI lints whole changed files, so PRs would block on debt they merely walked
    past (the same reasoning `eslint.config.mjs` already records for the React Compiler rules). The guard
    strips comments before asserting: it initially failed against the 9C comments that quote the removed
    attributes verbatim.
  - **Not verified — the most valuable outstanding check on this increment.** No browser, screen-reader or axe
    run happened. Two 9C-3 fixes correct behaviour never confirmed defective at runtime: the Shorts arrow-key
    hijack inside an open overlay, and "Mark all read" being keyboard-unreachable, were both reasoned from
    Radix's documented focus model, not observed. Both fixes are safe and idiomatic regardless of whether the
    original defect reproduced exactly as described, but the *findings* are unconfirmed. A keyboard pass over
    the Shorts viewer with comments open, the notification dropdown, a full quiz attempt, and the timer's
    final minute would settle all of it. Every affected page is a single-org surface, so the standing
    single-tenancy limitation does **not** block this.
  - **Documentation**: this entry; docs/ARCHITECTURE.md gained a decision entry for the fill-vs-text token
    split and the guard-test-not-lint-rules convention; docs/DESIGN_SYSTEM.md §3 gained the correction — it
    had asserted every token pairing met WCAG AA, which was **not true** for `--success`/`--warning` — plus
    the new token table; docs/ROADMAP.md's "Accessibility review" box is now checked with the deferrals inline.
    **Next per `docs/ROADMAP.md`: Phase 9D — Mobile-responsive polish.** Not started; do not begin
    automatically.
- **Phase 9D (Mobile-responsive polish): PARTIAL — M1–M4 of M1–M9 implemented, M5–M9 deferred.** A responsive
  review of the LearnOrbit-added frontend (62 `.tsx` files, `c28889d2..HEAD`) across the Phase 1–8 surfaces
  produced nine findings; the approved implementation batch was the four that break navigation or overflow the
  viewport. `docs/ROADMAP.md`'s "Mobile-responsive polish" box is deliberately **still unchecked** — the
  milestone is not complete while M5–M9 stand.
  - **M1 (Critical) — mobile/tablet navigation could not reach the overflow destinations.** `OrgBottomTabBar`
    renders Home + Shorts + `MAX_TABS = 2` config-driven items + "More", and the panel "More" opened carried
    *only* search/notifications/account by design. With the default six-item menu that left **Podcasts,
    Communities, Playgrounds and Store with no entry point at all below `lg`** — the panel had no
    destinations in it. `MAX_TABS` is now exported from `OrgBottomTabBar` and `OrgMenu` derives
    `overflowMenuItems` from the same `useOrgMenuItems(orgslug)` data and the same split, rendering them as a
    labelled `<nav aria-label="More destinations">` styled like the desktop sidebar's items (44px rows,
    `aria-current`, external items as `<a target="_blank">`, each closing the panel on click). No second
    hardcoded menu list.
    - **Correction to the finding as originally written.** The analysis claimed Library was among the
      stranded items. Live measurement disproves that for the default org: the tab bar renders **Home,
      Shorts, Courses, Library, More**, so Library occupies the second `MAX_TABS` slot and was always
      reachable. It *would* fall into the overflow on any org whose config reorders or disables Courses, which
      is why the fix is still the right one — but "Library was unreachable" was wrong and is not what the
      change fixed.
  - **M2 (Critical) — "More" did nothing between 768px and 1023px.** The button lives in the `lg:hidden` tab
    bar; the panel it toggles was `md:hidden`, i.e. `display: none` across the whole tablet band. The panel is
    now `lg:hidden`, and its duplicated search / notification bell / profile box — which the header itself
    shows from `md` up — are individually re-gated `md:hidden` so they don't render twice at tablet widths.
    The panel also gained `inert={!isMenuOpen}`: it is only translated off-screen (`-top-full opacity-0`), so
    without it the six new links would have joined the existing three controls as off-screen tab stops.
  - **M3 (High) — Shorts was not a full-viewport mobile experience.** The `100dvh` slide sat inside `<main>`'s
    `pb-16` *below* the 60px fixed header, with `OrgFooter` and `Watermark` beneath it: the page scrolled, and
    the fixed tab bar covered the bottom of the frame. `OrgMenuChrome` now adds `shorts` to `noFooterPaths`,
    and a separate `isFullViewportPage` flag drops `pb-16 lg:pb-0` for **Shorts only** (copilot keeps its
    padding). It publishes the real remaining height as a custom property on `<main>`:
    `--org-content-viewport: calc(100dvh - {chromeHeight}px - env(safe-area-inset-bottom))`, where
    `chromeHeight` = join banner (0 or `JOIN_BANNER_HEIGHT`) + `HEADER_HEIGHT` + `BOTTOM_TAB_BAR_HEIGHT` —
    all three imported, none re-typed. `HEADER_HEIGHT` is newly exported from `OrgSidebar`,
    `BOTTOM_TAB_BAR_HEIGHT` newly exported from `OrgBottomTabBar`. `short.tsx` and `shorts-index.tsx` then
    swap every bare `100dvh` for `var(--org-content-viewport,100dvh)` — including inside
    `h-[min(...,calc(100vw*16/9))]` — so the snap scroller, both IntersectionObserver spacers and the slide
    stay exactly one *visible* viewport tall and the swipe math is unchanged.
    - **Why a CSS variable and not an inline height:** an inline style beats `sm:`-prefixed classes, which
      would have destroyed the viewer's centred fixed-aspect desktop layout (§16). The `,100dvh` fallback
      keeps the route renderable outside the org chrome (e.g. `?chrome=none`).
    - **A deliberate 7px of slack.** `BOTTOM_TAB_BAR_HEIGHT = 64` matches the `pb-16` the chrome already
      assumes everywhere else; the bar measures **57px** rendered at these viewports. Content therefore ends
      ~7px above the bar rather than flush with it. Keeping the number aligned with the existing `pb-16`
      assumption was preferred over a second, divergent constant.
  - **M4 (High) — engagement controls overflowed narrow viewports.** `ChannelVideoEngagementBar`'s inline
    `bar` layout packed like / save / share / comments / report into `flex items-center gap-2` with no wrap
    (≈294px of controls in a 328px column; four-digit counts pushed it past). Now `flex flex-wrap
    items-center gap-2`. The `rail` layout (a column, also `role="group"`) is untouched.
  - **Files changed (7):** `components/Objects/Menus/OrgMenu.tsx`, `OrgMenuChrome.tsx`, `OrgSidebar.tsx`,
    `OrgBottomTabBar.tsx`; `components/Objects/Channel/ChannelVideoEngagementBar.tsx`;
    `app/orgs/(withmenu)/[orgslug]/shorts/[channelvideoid]/short.tsx`; `.../shorts/shorts-index.tsx`.
    **New test:** `apps/web/tests/responsive-guard.test.mjs` (9 tests / 18 assertions) in the established
    `a11y-guard`/`rtl-guard` static-source style, including the same comment-stripping helper — the 9D
    comments quote the replaced values verbatim, so the "must not appear" checks have to read code only.
  - **Verification — exact results.**
    - `bun test tests/responsive-guard.test.mjs` → **9 pass / 0 fail** (RED first: the same file ran
      **0 pass / 9 fail** before any implementation edit).
    - `bun test tests` → **207 pass / 13 fail / 2 errors**, against 9C's recorded **198 / 13 / 2**. The +9 are
      the new guard tests; the failure set is byte-identical (`billing-platform-key`,
      `billing-internal-key`, `catalog-pagination` missing fixture, and the `ar.json` coverage timeout).
    - `tsc --noEmit` → **clean**.
    - `eslint --max-warnings=0` on all 7 changed files → **0 errors, 1 warning**, and the warning is
      pre-existing (`OrgMenu.tsx:120` `react-hooks/set-state-in-effect`, in the untouched focus-mode effect).
    - `git diff --check` → **clean**.
    - **Tailwind actually emits the new arbitrary utilities** — verified against the dev server's compiled
      CSS, not assumed: `.h-\[var\(--org-content-viewport\,100dvh\)\]`,
      `.min-h-\[var\(--org-content-viewport\,100dvh\)\]` and
      `.h-\[min\(var\(--org-content-viewport\,100dvh\)\,calc\(100vw\*16\/9\)\)\]` are all present.
  - **Live browser verification — done, and this is the first increment in Phase 9 to get it.** The Chrome
    extension was unavailable and a Playwright browser download was declined, so the run instead drove the
    already-installed headless Chrome over CDP from a throwaway Node script (no new dependency, nothing
    installed, nothing committed), against the local dev stack (`bun run dev` + `uvicorn app:app`, the
    existing `learnhouse-db-dev`/`learnhouse-redis-dev` containers). Measured at **360×640, 390×844,
    768×1024 and 1024×768** over `/feed`, `/shorts`, `/shorts/<id>` and `/videos/<id>`:
    - `document.documentElement.scrollWidth > clientWidth` was **false on every page at every viewport** —
      no horizontal overflow anywhere.
    - `--org-content-viewport` resolved to `calc(100dvh - 124px - 0px)` (60 + 64, join banner not shown).
    - `<main>` `padding-bottom` was **0px on `/shorts` and `/shorts/<id>`** and **64px on `/feed` and
      `/videos/<id>`** — the M3 opt-out is route-scoped, not global. No `<footer>` on either Shorts route.
    - Shorts did **not** scroll: `scrollHeight === clientHeight` at 360×640, 390×844 and 768×1024.
    - The More panel opened and rendered its `<nav>` at 360, 390 **and 768** (`display: block`) — M2
      confirmed at the width that was previously dead — with all four overflow links 44px tall and fully
      inside the viewport. At 1024 the panel is `display: none` and the tab bar `display: none`, i.e. the
      desktop sidebar owns navigation.
  - **Not live-verified (2), both blocked by dev-database content, not by the code.**
    - **The Shorts slide/snap geometry.** All three `channelvideo` rows in the dev DB are
      `content_format = 'long'`, so `/shorts` renders its empty state and `/shorts/<id>` its unavailable
      state. Both use the new variable and both were measured, but the one-viewport-per-slide scroller, the
      two IntersectionObserver spacers and swipe navigation were **not** exercised against a real short.
    - **M4 at runtime.** `/videos/<id>` renders signed-out with no video body, so
      `div[role="group"][aria-label="Video engagement"]` never mounted. The wrap fix is guard-tested and
      code-reviewed only. Seeding one published short and one signed-in session would close both gaps.
  - **Deferred — recorded, not fixed** (explicitly out of the approved batch):
    - **M5 (Medium)** `QuizTimer.tsx:88` — `fixed top-20 end-4` overlays the answer options' right edge on a
      full-width mobile column, and with `OrgJoinBanner` visible the header drops past 80px and hides the
      timer outright. Fix: offset from the same `topOffset` the header/sidebar use; make it in-flow below
      `sm`.
    - **M6 (Medium)** `ChannelVideoCommentsPanel.tsx:317`, `ReportChannelVideoDialog.tsx:114` — raw
      `DialogContent` (`w-full max-w-lg`, no inset) and `max-h-[85vh]` rather than `dvh`; composer and submit
      go behind the on-screen keyboard below `sm`. Fix per-dialog (`w-[95vw]`, `max-h-[85dvh]`).
    - **M7 (Medium)** `components/ui/dialog.tsx:101` — `DialogFooter` is `flex-col-reverse` with no gap, so
      stacked buttons touch below `sm`. **Explicitly excluded by the approval**: shared inherited UI.
    - **M8 (Low)** `OrgMenuChrome.tsx` — `pb-16` omits `env(safe-area-inset-bottom)`, which the tab bar
      itself adds, so notched devices lose ~34px of content behind the home indicator. (The new
      `--org-content-viewport` already subtracts the inset; `pb-16` still does not.)
    - **M9 (Low / 9C carry-over)** — engagement `size="sm"` (32px) and the `ChannelHeader` follow button
      (~24px) sit under §7's 44px target; tracked with 9C's deferred Lows.
    - **No action** (reviewed, genuinely fine): the `dash` tree (`ClientAdminLayout` already stacks with
      `lg:flex-row` + `pb-24`), every LearnOrbit grid (`grid-cols-1 sm:… lg:…`), feed, library, progress,
      results and family surfaces, and the shared `Modal.tsx` (`w-[95vw] max-h-[90vh]`, scrolling body).
      Rows consistently use `min-w-0`/`truncate`/`shrink-0`; there is no `<table>` in the added surface.
  - **9C observation carried forward, deliberately not fixed here.** The mobile panel's children were already
    focusable while the panel was closed (it is moved off-screen, not unmounted). M2's `inert` closes that for
    the panel, but the underlying pattern — off-screen-but-focusable chrome — was not audited elsewhere; that
    belongs to 9C's deferred list, not to 9D.
  - **Documentation**: this entry. `docs/ARCHITECTURE.md` unchanged — `--org-content-viewport` is a local
    layout detail of the org chrome, not a new API boundary, data model or reusable convention.
    `docs/ROADMAP.md` unchanged: the 9D box stays open until M5–M9 are resolved or explicitly waived.
    **Next recommended increment: 9D batch 2 — M5 + M6 + M8** (M7 needs an explicit call on editing shared
    inherited UI; M9 rides with 9C's Lows). Not started; do not begin automatically.
- **Phase 9D batch 2 (M5 + M6 + M8): complete. 9D is now M1–M6 + M8 done, M7 and M9 deferred.** The
  `docs/ROADMAP.md` "Mobile-responsive polish" box remains **unchecked** — M7 and M9 are still open, so the
  milestone is not finished.
  - **M5 (Medium) — the exam timer could hide behind the chrome and could cover the answer column.**
    `QuizTimer` was `fixed top-20 end-4`, i.e. an 80px guess at the chrome's height. The fixed header is
    **60px**, and with `OrgJoinBanner` visible it starts **48px lower** — so on exactly the pages a
    not-yet-joined student sees, the timer sat *behind* the header and was invisible. It now derives
    `timerTop = (isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0) + HEADER_HEIGHT + 8` from the same
    `useJoinBannerVisible()` / `JOIN_BANNER_HEIGHT` / `HEADER_HEIGHT` the sidebar and `OrgMenuChrome` already
    position against — no new constants. Separately, being `fixed` at *every* width floated the pill over the
    right edge of the answer options on the full-width mobile column; a positioning wrapper is now
    `sticky … w-full … sm:fixed sm:end-4 sm:w-auto`, so below `sm` the timer takes its own row in flow and
    can cover nothing, and from `sm` up — where the `max-w-2xl` column is narrower than the viewport — it
    floats as before. `role="timer"`, `aria-live="off"`, the label and the 9C milestone announcements all
    stayed on the pill; only positioning moved to the wrapper.
  - **M6 (Medium) — the comments and report dialogs were unusable with the on-screen keyboard.** Both used
    the raw primitive (`w-full max-w-lg`, no inset) so they ran edge to edge at 360px, and the comments panel
    capped at `max-h-[85vh]` — `vh` ignores the on-screen keyboard, which put the composer and its Post
    button underneath it. `ChannelVideoCommentsPanel` is now
    `w-[95vw] sm:w-full max-h-[85dvh] flex flex-col p-6`; `ReportChannelVideoDialog` is
    `w-[95vw] sm:w-full max-h-[85dvh] overflow-y-auto p-6` — it needs its own scroll container because,
    unlike the comments panel, it has no inner scrolling region. Both sized **per dialog**;
    `components/ui/dialog.tsx` is untouched, and a guard test now pins that.
  - **M8 (Low) — the mobile bottom padding did not clear the home indicator.** The tab bar adds
    `env(safe-area-inset-bottom)` to its own padding but `<main>` cleared only the bar's `4rem`, so on a
    notched device the last row of content sat under the indicator. `pb-16` →
    `pb-[calc(4rem_+_env(safe-area-inset-bottom))]`, with `lg:pb-0` unchanged so the desktop layout gains no
    stray spacing. (Tailwind's `_` → space conversion is required here: `calc(4rem+env(…))` without spaces
    around the `+` is invalid CSS.)
  - **Files changed (5):** `components/Objects/Channel/QuizTimer.tsx`,
    `components/Objects/Channel/ChannelVideoCommentsPanel.tsx`,
    `components/Objects/Channel/ReportChannelVideoDialog.tsx`, `components/Objects/Menus/OrgMenuChrome.tsx`,
    `components/Objects/Menus/OrgBottomTabBar.tsx` (comment only — it named the now-replaced `pb-16`).
    `apps/web/tests/responsive-guard.test.mjs` extended from 9 tests to **15**.
  - **Verification — exact results.**
    - `bun test tests/responsive-guard.test.mjs` → RED first at **10 pass / 5 fail** (the 5 new M5/M6/M8
      assertions), then **15 pass / 0 fail** after implementation.
    - `bun test tests` → **213 pass / 13 fail / 2 errors**, against batch 1's **207 / 13 / 2**. The +6 are the
      new guard tests; the failure set is unchanged (`billing-platform-key`, `billing-internal-key`,
      `catalog-pagination` missing fixture, `ar.json` coverage timeout).
    - `tsc --noEmit` → **clean**. `eslint --max-warnings=0` on all 5 changed files → **clean, 0 problems**
      (batch 1's single pre-existing `OrgMenu.tsx:120` warning is not in this batch's file set).
      `git diff --check` → **clean**.
    - **Tailwind emits the new utilities** — confirmed in the dev server's compiled CSS, not assumed:
      `padding-bottom: calc(4rem + env(safe-area-inset-bottom))` and `max-height: 85dvh` are both present.
  - **Live browser verification** — same method as batch 1 (already-installed headless Chrome driven over CDP
    from a throwaway Node script; no new dependency, nothing installed or committed), against the local dev
    stack, at **360×640, 390×844, 768×1024** plus **1024×768** as the desktop control:
    - **No horizontal overflow at any of the four viewports** (`scrollWidth > clientWidth` false throughout).
    - **M8 confirmed:** `<main>` computed `padding-bottom` is **64px below lg and 0px at 1024×768**. Headless
      desktop Chrome resolves `env(safe-area-inset-bottom)` to `0`, so the calc yields exactly the previous
      64px on non-notched viewports — the change is additive only where an inset actually exists, and
      `lg:pb-0` still drops all of it on desktop.
    - **M6 and M5 verified at the utility-contract level.** The real dialogs need an authenticated video page
      and the real timer needs a live timed attempt, neither of which this dev DB can serve (see limitations),
      so the run mounted a node carrying each component's exact class string and read the resolved cascade:
      the dialog measured **342px wide × 544px max-height at 360×640** and **370.5 × 717.4 at 390×844**
      (= 95vw / 85dvh in both cases), and switched to `sm:w-full` (full parent width) at 768 and 1024 — the
      inset applies below `sm` only. The timer wrapper resolved to `position: sticky, width: 100%` at 360 and
      390 and `position: fixed, width: auto` at 768 and 1024, which is precisely the M5 breakpoint contract.
  - **Limitations — what was *not* observed at runtime.**
    - **The timer against real answer controls.** Reaching it needs an authenticated student, a
      `quiz_type = 'exam_practice'` quiz with `time_limit_minutes`, and an in-progress attempt. That
      `position: sticky` in normal flow cannot overlap a following sibling is structural, and the computed
      position was confirmed — but the pinned-while-scrolling behaviour over a real question list, and the
      join-banner-visible offset, were **not** seen. (Sticky also fails silently inside an
      `overflow: hidden` ancestor; `<main>` is `flex-1 relative` and the root is `flex flex-col
      min-h-screen`, so it is clear by inspection, not by observation.)
    - **The dialogs with an actual on-screen keyboard.** `/videos/<id>` renders signed-out with no video
      body, so neither dialog mounts; and a software keyboard cannot be raised in headless Chrome at all. The
      `dvh` choice is the correct unit for it, but the keyboard-open case is reasoned, not measured.
    - **The safe-area inset itself is always `0` here.** Only a notched device (or a UA that reports a
      non-zero inset) exercises the part of M8 that actually changed.
    - Seeding a published short, a timed exam attempt and a signed-in session would close every gap listed
      here and the two carried over from batch 1.
  - **Still deferred after this batch:**
    - **M7 (Medium)** `components/ui/dialog.tsx:101` — `DialogFooter` is `flex-col-reverse` with no gap, so
      stacked buttons touch below `sm`. Fix is `gap-2 sm:gap-0`, but the file is inherited shared UI used
      across the whole LearnHouse tree; **excluded by the approval for both 9D batches** and still needs an
      explicit call.
    - **M9 (Low / 9C carry-over)** — engagement `size="sm"` (32px) and the `ChannelHeader` follow button
      (~24px) sit under §7's 44px target; tracked with 9C's deferred Lows, not with 9D.
  - **Documentation**: this entry. `docs/ARCHITECTURE.md` unchanged — nothing here introduces an API
    boundary, data model, security pattern or reusable convention. `docs/ROADMAP.md` unchanged: the 9D box
    stays open while M7 and M9 stand. **Next recommended increment: a scope call on M7** (one-line change to
    inherited shared UI) — or, if 9D is to be closed as-is with M7/M9 waived, check the ROADMAP box and move
    to **9E — Testing**. Not started; do not begin automatically.
- **Phase 9D batch 3 (M7): complete. Phase 9D — Mobile-responsive polish is now DONE** (M1–M8 implemented,
  **M9 intentionally deferred** under the existing 9C Low-findings decision). `docs/ROADMAP.md`'s
  "Mobile-responsive polish" box is checked, with the M9 deferral noted inline.
  - **M7 (Medium) — stacked dialog buttons touched below `sm`.** `DialogFooter` in the inherited shared
    `components/ui/dialog.tsx` was `flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3`: the only
    spacing rule is `sm:`-prefixed *and* horizontal, so in the mobile column the two buttons had **no
    separation at all**. Measured at **0px** between Cancel and Submit at both 360×640 and 390×844 before the
    fix. Now `flex flex-col-reverse gap-y-2 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-y-0`.
  - **Deviation from the approved class pair, and why — this is the finding of the increment.** The approval
    specified `gap-2` / `sm:gap-0`. Inspecting all **20** `DialogFooter` usages across 10 files first showed
    that pair would have broken two of the same approval's own constraints ("preserve the existing desktop
    behavior", "do not modify unrelated dialog components"):
    - **5 usages already pass their own unprefixed `gap-2`** — `app/home/home.tsx:461` and `:516`,
      `app/(hub)/account/page.tsx:261`, `AccountDangerZone.tsx:149` (all `className="mt-5 gap-2"`), and
      `Modal.tsx:95` (`flex flex-row justify-end gap-2`).
    - twMerge resolves a caller's unprefixed `gap-2` against a base `gap-2` (caller wins) but **keeps a base
      `sm:gap-0`**, because a different breakpoint modifier is a different key. Those five would therefore
      have kept their mobile gap and *lost* their desktop one.
    - Measured, not assumed: with `gap-2 sm:gap-0` those five dropped from **20px to 12px** between buttons at
      1024×768 (they currently get `gap-2`'s 8px *plus* `space-x-3`'s 12px). The remaining 15 usages were
      unaffected either way.
    - `gap-y-2` / `sm:gap-y-0` produces an **identical** mobile fix (0 → 8px) and is inert in a single-row
      flex, so every desktop measurement stayed byte-identical to the pre-fix baseline. It is the same
      one-line change, scoped to the axis that actually had the bug. **Reversing this to the literal
      `gap-2 sm:gap-0` is a one-line edit if the 8px desktop change is wanted after all.**
  - **Files changed (1):** `components/ui/dialog.tsx` — the `DialogFooter` class string plus the comment
    recording the twMerge interaction above. **No other dialog component was touched**, and a guard test now
    asserts that the five gap-supplying callers are unedited.
  - `apps/web/tests/responsive-guard.test.mjs` extended from 15 tests to **18**: the stack has a gap; the gap
    is axis-scoped and `sm:gap-0` specifically must *not* appear (with the measured reason inline);
    `sm:space-x-3` survives; and the five callers still carry their own `gap-2`.
  - **Verification — exact results.**
    - `bun test tests/responsive-guard.test.mjs` → RED at **16 pass / 2 fail**, then **18 pass / 0 fail**.
    - `bun test tests` → **216 pass / 13 fail / 2 errors** against batch 2's **213 / 13 / 2**. The +3 are the
      new M7 tests; the failure set is unchanged (`billing-platform-key`, `billing-internal-key`,
      `catalog-pagination` missing fixture, `ar.json` coverage timeout).
    - `eslint --max-warnings=0 components/ui/dialog.tsx` → **clean**. `tsc --noEmit` → **clean**.
      `git diff --check` → **clean**.
  - **Live verification — a genuine before/after regression test, the strongest in Phase 9.** Same method as
    batches 1–2 (already-installed headless Chrome over CDP; no new dependency, nothing installed or
    committed). The pre-fix spacing of all four *usage shapes* was measured and recorded **before** the
    primitive was edited; the exact `cn()`/twMerge output the component now ships was then computed with the
    repo's own `tailwind-merge` (so the probe measured what actually renders, not a hand-written guess) and
    re-measured at 360×640, 390×844 and 1024×768:
    - `bare` (14 usages) and `feedback` — **0px → 8px** on both mobile viewports. **Fixed.**
    - `callerGap2` (4 usages) and `modalRow` — **8px, unchanged** on mobile.
    - **All four shapes unchanged at 1024×768**: 12px, 20px, 20px, 12px — identical to the pre-fix baseline.
    - Harness verdict: **"no regression in any usage shape"** across all 12 shape × viewport combinations.
  - **Limitations.** Only the *shapes* of usage were rendered, not each of the 20 call sites individually —
    but the four shapes are exhaustive over the distinct class strings twMerge produces, which was verified
    by running the repo's own `cn()` over every usage's `className`. The dialogs themselves were still not
    driven with a real on-screen keyboard (that limitation belongs to M6 and stands unchanged). No new
    device conditions were manufactured for this increment.
  - **Carried-forward limitations from batches 1–2, all still open** (none of them is blocked by code — each
    needs dev-database content or real hardware): the Shorts **snap/slide geometry** is unexercised (every
    `channelvideo` row is `content_format = 'long'`); the **engagement-bar wrap** is guard-tested only
    (`/videos/<id>` renders signed-out with no video body); the **quiz timer over real answer controls** is
    unexercised (needs an authenticated in-progress timed `exam_practice` attempt); the **dialogs with an
    on-screen keyboard** cannot be reproduced in headless Chrome; and **`env(safe-area-inset-bottom)` is
    always `0`** here, so the part of M8 that actually changed only takes effect on a notched device.
    Seeding a published short, a timed exam attempt and a signed-in session closes the first four.
  - **M9 remains intentionally deferred** — engagement `size="sm"` (32px) and the `ChannelHeader` follow
    button (~24px) sit under §7's 44px target. WCAG 2.5.5 is AAA, not the AA bar 9C worked to, and 9C already
    recorded this among its seven deferred Low findings; it is tracked there, not as 9D work. This is the
    standing decision under which 9D is being closed.
  - **Documentation**: this entry; `docs/ROADMAP.md`'s "Mobile-responsive polish" box checked with the M9
    deferral inline. `docs/ARCHITECTURE.md` unchanged — a one-line utility change to an inherited primitive
    is not an architectural decision, API boundary or new convention.
    **Next per `docs/ROADMAP.md`: Phase 9E — Testing.** Not started; do not begin automatically.
- **Phase 9D M5 + M6 — code-review verification pass (no implementation change).** M5 and M6 were already
  implemented in batch 2; this pass re-read the shipped code without a browser, at the request to verify by
  code review rather than CDP. It produced **one correction to the batch-2 record** and no code changes.
  - **Confirmed correct by inspection.**
    - **M5** — `timerTop = (isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0) + HEADER_HEIGHT + 8` puts the pill
      8px below the fixed header's bottom edge in both banner states, using the same two values the sidebar
      and `OrgMenuChrome` position against. The positioning wrapper is `sticky … w-full … sm:fixed sm:end-4
      sm:w-auto`, with `top` supplied inline so it applies in both modes. `position: sticky` is not clipped
      here: the wrapper's parent is `<main>` (`flex-1 relative`, no `overflow`) inside a root that is
      `flex flex-col min-h-screen`, and the timer is rendered as a fragment sibling *before*
      `QuestionRunner`, so it pins for the whole question list. Being in normal flow below `sm`, it cannot
      overlap the answer options — it takes its own row instead. `role="timer"`, `aria-live="off"`, the
      accessible name and the 9C milestone announcements all remained on the pill, not the wrapper. `end-4`
      and `justify-end` are both logical, so RTL is unaffected.
    - **M6** — twMerge resolves `w-[95vw]` over the primitive's `w-full` and `sm:w-full` restores it from
      `sm` up, while `max-w-lg` survives and still caps wide screens; at 360px the 95vw inset binds and the
      cap does not. The comments panel keeps `flex flex-col` + an inner `flex-1 overflow-y-auto` region, so
      the list scrolls and the composer stays pinned; the report dialog has no inner region, hence
      `overflow-y-auto` on the content itself.
  - **Correction — the batch-2 claim about `vh` → `dvh` and the on-screen keyboard was overstated.** This app
    sets no viewport meta of its own (no `export const viewport` anywhere under `app/`), so Next.js emits the
    default `width=device-width, initial-scale=1` with no `interactive-widget` value. Chrome's default is
    `interactive-widget=resizes-visual`, under which the on-screen keyboard resizes only the **visual**
    viewport — the layout viewport and therefore `dvh` are unchanged; iOS Safari behaves the same way. So
    `max-h-[85dvh]` does **not**, on its own, shrink the dialog when the keyboard opens.
    - What `dvh` genuinely fixes over `vh` is **dynamic browser chrome** (the collapsing URL bar), which
      `vh` ignores — a real improvement, and the `w-[95vw]` inset is correct regardless. M6 is still a net
      win; it is just not the complete keyboard fix batch 2 described.
    - **Closing the keyboard case properly** needs either `interactive-widget=resizes-content` on the root
      viewport export, or a `visualViewport` listener. Both are global/new-infrastructure changes well
      outside "per-dialog responsive sizing", so neither was made here. **Recommended follow-up, not done.**
  - **Verification (code-level only — no browser was used for this pass).**
    `bun test tests/responsive-guard.test.mjs` → **18 pass / 0 fail**. `bun test tests` → **216 pass /
    13 fail / 2 errors**, identical to the established baseline; the 13 failures remain the pre-existing
    `billing-platform-key`, `billing-internal-key`, `catalog-pagination` (missing fixture) and the `ar.json`
    coverage timeout. `eslint --max-warnings=0` on the three M5/M6 files → **clean**. `tsc --noEmit` →
    **clean**. `git diff --check` → **clean**.
  - **Limitations unchanged.** Nothing was manufactured for this pass: the timer was still not driven over a
    real in-progress timed attempt, and the dialogs were still not opened with a real on-screen keyboard.
    The other carried-forward gaps (Shorts snap geometry, engagement-bar wrap, zero safe-area inset) stand
    as recorded. **M9 remains intentionally deferred** under 9C's Low-findings decision. Phase 9D's status is
    unchanged by this pass — still complete, with the `docs/ROADMAP.md` box checked.
- **Phase 9D M5 + M6 — independent code-review verification pass (no browser).** Requested explicitly as
  code review rather than the headless-Chrome/CDP method used in the batch-2 record above. No implementation
  changed; this pass re-read the shipped code and checked the things a browser run cannot settle. It produced
  **one correction to the batch-2 record** (M6, below).
  - **Checks re-run (code-level only):** `bun test tests/responsive-guard.test.mjs` → **18 pass / 0 fail**;
    `bun test tests` → **216 pass / 13 fail / 2 errors**, unchanged from the established baseline and with an
    identical failure set; `eslint --max-warnings=0` on `QuizTimer.tsx`, `ChannelVideoCommentsPanel.tsx`,
    `ReportChannelVideoDialog.tsx` → **clean**; `tsc --noEmit` → **clean**; `git diff --check` → **clean**.
  - **M5 — confirmed sound, including its one real failure mode.** `position: sticky` is silently inert
    inside any ancestor that sets `overflow`, which would have made the mobile fix a no-op with no error
    anywhere. `styles/globals.css` was scanned programmatically for every rule whose selector names `html` or
    `body` and sets `overflow`: **none exist**. `<body>` carries no className, and `<main>` is
    `flex-1 relative`. The sticky wrapper is therefore in a clean containing block.
    - **Offset arithmetic re-derived:** the header is fixed at `top: topOffset` (`JOIN_BANNER_HEIGHT` or `0`)
      with `h-[60px]`, so its bottom edge is `banner + 60`. `timerTop = banner + HEADER_HEIGHT + 8` clears it
      by exactly 8px in **both** banner states, and matches `OrgSidebar`'s own
      `topOffset = banner + HEADER_HEIGHT`. The old `top-20` (80px) cleared the no-banner case by 20px and
      the banner case by **−28px** — i.e. sat behind the header, which is the reported defect.
    - **Semantics preserved:** `role="timer"`, `aria-live="off"`, the `aria-label`, and the 9C milestone
      `role="status"` region with `ANNOUNCE_AT_SECONDS` are all still on the inner pill and untouched; only
      positioning moved to the new wrapper. RTL-safe — `sm:end-4` is a logical property and `justify-end`
      flips with direction.
  - **M6 — correction to the batch-2 record.** That entry stated `dvh` "is the correct unit" for the
    on-screen keyboard. More precisely: **`dvh` tracks the *dynamic viewport*** — browser chrome expanding
    and collapsing — and the on-screen keyboard only shrinks that viewport when the page opts in with
    `interactive-widget=resizes-content`. This app has **no `export const viewport` anywhere** and no
    `viewport` meta in `app/layout.tsx`, so Next.js emits its default
    (`width=device-width, initial-scale=1`) with no `interactive-widget` directive. On browsers that overlay
    the keyboard rather than resize, `85dvh` therefore does **not** shrink when it opens.
    - **What M6 does reliably fix, unchanged:** the dialog can no longer overshoot the viewport
      (`85vh` → `85dvh` removes the URL-bar error), and `w-[95vw] sm:w-full` supplies the 360px inset the raw
      primitive lacked. The keyboard-overlap case is **improved but not guaranteed**.
    - Closing it fully needs a root `viewport` export with `interactiveWidget: 'resizes-content'` — a global
      change affecting every page, i.e. new responsive infrastructure and out of 9D's scope. **Recorded, not
      fixed**; a reasonable candidate for 9E or a follow-up increment.
    - **twMerge interaction verified:** `w-[95vw]` overrides the primitive's `w-full`, `sm:w-full` re-applies
      it from `sm`, and `max-w-lg` survives — so wide screens are unchanged. The comments panel keeps
      `flex flex-col` plus its inner `flex-1 overflow-y-auto` region, so the list scrolls while the composer
      stays pinned; the report dialog has no inner scroll region, which is why `overflow-y-auto` sits on the
      dialog content itself.
  - **Limitations unchanged.** This pass deliberately manufactured no device or keyboard conditions and ran
    no browser. Everything above is source-level reasoning plus the code-level checks listed; it complements
    the batch-2 live measurements rather than superseding them. The carried-forward runtime gaps (Shorts snap
    geometry, engagement-bar wrap, the timer over real answer controls, the dialogs with a real keyboard, and
    `env(safe-area-inset-bottom)` always being `0` off-device) all still stand.
- **Phase 9E (Testing): complete** — an audit of what the LearnOrbit-added surface from Phases 1–8 was
  actually protected against, followed by four narrowly-scoped test increments. No implementation code was
  written or changed. Like 9A–9D, the increment was scoped during planning and the scope stated before
  implementation, since Phase 9's roadmap line is a bare six-item list with no sub-definitions and no PRD
  elaboration.
  - **What "Testing" was taken to mean, and what it was not.** The audit's first finding is that LearnOrbit
    already has substantial, per-phase-TDD coverage: **7,352 lines of backend test across the 16 LearnOrbit
    service modules and 5 router test files**, plus 23 frontend `bun test` files. Every one of the 16 service
    modules already has a dedicated test file, and **10 of the 16 already carried an explicit
    cross-organization isolation case** (`channel_videos`, `channel_resources`, `quizzes`, `questions`,
    `channel_video_reports`, `progress`, and the four engagement modules). `quiz_attempts` and `follows` had
    **none** — the gap 9E-1 and 9E-2 close. Of the remaining four, `notifications`, `parent_links` and
    `child_progress` are cross-org *by design* (org scoping is not their boundary — recipient identity and
    link approval are), and `verification` is superadmin-gated platform-wide. So 9E was deliberately **not**
    run as "add tests everywhere" or as a coverage-percentage exercise —
    it was run as a gap hunt against the specific properties that break silently. Nothing was added to raise
    a count, no existing test was rewritten, no legacy test was touched, and no new test framework was
    introduced (`pytest` + `bun test` were sufficient; the two new frontend-shaped invariants fit the
    existing `a11y-guard`/`responsive-guard` source-assertion pattern).
  - **Method: mutation-checked, not just green.** Every security assertion added below was verified by
    removing the guard it covers from a scratch copy of the service, watching the new test fail, and
    restoring — the RED step that a regression test (as opposed to TDD of new code) otherwise never gets.
    All services were restored byte-identically; `git diff` on `quiz_attempts.py`, `follows.py`,
    `channel_video_comments.py`, `channel_video_likes.py` and `lib/query/keys.ts` is empty for this
    increment. The mutation results are recorded per finding, including **one case where the mutation showed
    the new test was redundant with existing coverage** — recorded rather than quietly dropped (see 9E-3).
  - **Baseline established before any change** (both suites run to completion first):
    - Backend `TESTING=true uv run pytest src/tests/ -q --no-cov -p no:randomly`:
      **5,688 passed, 10 failed, 29 skipped** in 20m23s.
    - The 10 failures are all pre-existing and all in **inherited LearnHouse** modules, none in
      LearnOrbit-added code: `test_core_events.py::test_register_ee_helpers_and_startup`,
      `test_core_events_runtime.py::test_ee_hook_registration_and_paid_access`,
      `test_custom_domains_service.py` (×3), `test_org_invites_service.py` (×3),
      `test_podcasts_service.py` (×2).
    - Frontend `bun test tests`: **216 passed, 13 failed, 2 errors** — the same baseline documented since
      Phase 6/7/8B–8D/9A (`billing-platform-key` ×3, `billing-internal-key` ×7, the `ar.json` coverage
      timeout; errors from `catalog-pagination`'s missing fixture module).
  - **Gap analysis — what was found, and what was found to be already fine.** Read in full: `quiz_attempts`,
    `channel_video_reports`, `notifications`, `child_progress`, `progress`, `verification`, `follows`,
    `quizzes`, `questions`, `channel_videos`, `channel_resources`, `parent_links`, plus their test files.
    - **Already adequately covered — no action taken** (stated so the next session does not re-audit them):
      report submission/queue/resolve authorization (32 tests incl. cross-org and pagination-preserves-admin);
      notification recipient isolation (15 service + 8 router tests incl. the bulk-UPDATE scoping);
      parent-child authorization (19 service + 6 router classes, incl. 9A's revocation cut-off);
      superadmin-only channel verification (7 tests, incl. "the channel's own admin cannot self-verify" and
      the check-order test); own-progress aggregation (8 tests incl. cross-org and cross-user); home-feed and
      global-Shorts visibility predicates; question-bank and quiz admin gating (28 + 30 tests). Frontend
      logic modules (filters ×4, uploads ×2, quiz timer, quiz results, parent-link validation, video source)
      are all tested, and 9C/9D's invariants are pinned by `a11y-guard`/`responsive-guard`.
    - **G1 (security, high) — `quiz_attempts` was the only LearnOrbit module with no cross-org test at all.**
      `_get_quiz_or_404` (org-scoped) and `_get_attempt_or_404` (quiz-scoped) both carry `SECURITY:` comments
      in the service source, and **neither predicate was exercised by any test**. This is the module where a
      missed predicate leaks an answer key rather than a title.
    - **G2 (security, medium) — no anonymous case on `get_quiz_attempt`/`submit_quiz_attempt`.**
      `start_quiz_attempt` and `list_quiz_attempts` each had one; the other two entry points did not.
    - **G3 (security, high) — the answer-key strip was asserted on only one of its two call sites.**
      `_strip_question` runs in `start_quiz_attempt` **and** in `get_quiz_attempt` (the "reload/resume the
      exam page" path). Only the start path was asserted; the resume-path test asserted merely that
      `questions is not None`.
    - **G4 (isolation, medium) — `follows` had no per-channel test.** Every one of its 10 existing tests used
      the single `org` fixture, so a service that ignored `org_id` entirely would have passed the whole file.
      Following is the input to the Phase 4G home feed, so a leaked follow edge is a content-visibility bug,
      not just a wrong follower count.
    - **G5 (cross-feature, medium) — the moderation → discovery seam was untested.** Phase 8D's admin quick
      action is `published → False`, and its *point* is that the video then leaves every surface a viewer
      could reach it through — surfaces owned by 2C, 3C, 4G and 4B–4C, each re-deriving visibility from its
      own predicate. Every existing per-surface test builds a video that was **never** published; the whole
      suite contained exactly one `published=False` call, inside an authorization test. The
      published → engaged-with → unpublished sequence that moderation actually produces was exercised nowhere.
    - **G6 (client-side isolation, medium) — the per-viewer query keys had no guard.** `lib/query/keys.ts`
      keys `feed.home`, `notifications.*` and `parentLinks.*` by user id. Dropping that argument still
      type-checks (the parameter is `number | undefined`), still lints, and still renders — but turns the
      React Query cache into a cross-user read for two accounts used in one browser. The backend stays
      correct and nothing fails. The prefix-based invalidation contract that keys.ts documents in prose was
      likewise asserted nowhere.
  - **9E-1 — exam-integrity regression tests (G1 + G2 + G3).** +9 tests appended to
    `src/tests/services/test_quiz_attempts_service.py` (17 → 26). Four cross-org (start/get/submit/list, each
    also asserting no side effect — no attempt row created, status still `in_progress`), two cross-quiz
    (get/submit, with the positive control that correct addressing still resolves), two anonymous
    (get/submit), and one resume-path answer-key containment test.
    - **Mutation results.** Dropping `Quiz.org_id == org_id` from `_get_quiz_or_404` → the 4 cross-org tests
      fail, 22 pass. Dropping `QuizAttempt.quiz_id == quiz_id` from `_get_attempt_or_404` → the 2 cross-quiz
      tests fail (submit surfacing `422 answers reference a question not attached to this quiz`, i.e. exactly
      the grading corruption its docstring predicts). Making `get_quiz_attempt` build `QuestionForAttempt`
      directly instead of via `_strip_question` → **only** the new resume test fails, 25 pass.
    - **That last mutation is the concrete finding of 9E-1**: before this increment, a regression that
      stripped the answer key on start but not on resume would have passed the entire 5,688-test suite while
      serving `is_correct`, `accepted_answers` and `explanation` to any student who refreshed the exam page.
      The new test also asserts on the serialized payload (`model_dump_json()`), so a future field added to
      `QuestionForAttempt` without stripping is caught too.
  - **9E-2 — per-channel follow isolation (G4).** +3 tests appended to
    `src/tests/services/test_organization_follows_service.py` (10 → 13): following one channel does not
    follow another; `_follower_count` reports 2 and 1 across two channels, never 3; unfollowing one channel
    leaves the other intact.
    - **Mutation results.** Neutralising `_follower_count`'s `org_id` predicate → 2 new tests fail, **all 10
      pre-existing tests still pass**. Neutralising `get_follow_status`'s `org_id` predicate → 2 new tests
      fail, **all 10 pre-existing tests still pass**. The gap was real in both directions.
  - **9E-3 — cross-feature moderation → discovery integration (G5).** New file,
    `src/tests/services/test_moderation_visibility_integration.py`, 6 tests. Each asserts the pre-moderation
    baseline first so the post-moderation assertions cannot pass vacuously: a moderated long video leaves the
    channel listing, the home feed and direct fetch (403); a moderated short leaves the global
    `list_public_shorts` queue; moderation does not take down the video's neighbours; a viewer who already
    liked and commented loses read *and* write access to both; the reporter cannot re-file after the report
    is resolved and the video pulled; and the channel admin still resolves the video and can restore it.
    - **Honest scoping of its value, measured not assumed.** Removing the `get_channel_video` delegation from
      `list_channel_video_comments`/`get_like_status` fails the new engagement test — **but it also fails 2
      tests in the existing likes/comments suites**, so that assertion is a composed re-check, not the only
      guard. The three assertions with no other coverage anywhere are the ones about the *shape* of a
      moderation action rather than any single predicate: non-collateral-damage, the resolved-report
      re-file path, and reversibility. **Nothing else in the suite performs a publish → unpublish → publish
      round trip.** This overlap analysis is recorded in the file's own docstring so it is not re-derived.
    - **Deliberately excluded, with reason, in the file's docstring**: report authorization (already fully
      covered — not duplicated), and FK `ondelete="CASCADE"` row cascade, which Postgres enforces but this
      SQLite-backed suite runs with `PRAGMA foreign_keys` off — a test there would assert the harness's
      behaviour, not production's. Left to a real-database integration pass.
  - **9E-4 — query-key cache-isolation guard (G6).** New file, `apps/web/tests/query-key-isolation.test.mjs`,
    48 tests. Per-viewer keys must differ per user, embed the id, stay stable for one user, never collide
    across resources, and never coincide with another viewer's key; org-scoped list keys must differ per org
    and not collide; filtered list keys must extend the unfiltered key **as a prefix** (the documented
    `invalidateQueries` contract, load-bearing for every filtered listing since 2G-3 and asserted nowhere
    until now), collapse back to the base key on an empty filters object, and differ per filter set and per
    org; `quizAttempts.list` must **not** sit under `detail`'s prefix (keys.ts states this deliberately);
    plus a sweep over all 11 LearnOrbit namespaces proving no two factories yield the same key.
    - **Mutation result.** Rewriting `notifications.list` to drop its `userId` segment → 3 tests fail. Same
      shape and rationale as the existing `a11y-guard`/`responsive-guard` files: an invariant spread across
      call sites that no lint rule or type check can express.
    - **Investigated and found NOT to be a defect** (recorded so it is not re-investigated): the per-viewer
      keys accept `number | undefined`, which would collapse to a shared `undefined` key during auth
      bootstrap. Every consuming hook gates on `enabled: isAuthenticated && !!accessToken`, and `userId` and
      `accessToken` are read from the same `session.data` object, so the undefined key is not reachable on an
      authenticated path. `useNotifications.ts`'s comment claims the gate checks "a session with an access
      token **and user id**" — it does not literally check the id, but the effect is the same. No fix made,
      no finding raised.
  - **Security: no new defect found, so nothing was fixed under 9E.** The audit re-walked authentication,
    ownership/IDOR, cross-organization isolation, parent-child authorization, moderation/report permissions,
    notification recipient isolation, unpublished/private content, admin/superadmin boundaries, and mutation
    authorization. Every guard checked was found **present and correct in the implementation** — G1–G6 are
    gaps in *coverage of* those guards, not gaps in the guards. That is why 9E changed no implementation
    code, which is the correct outcome for a testing increment: had a genuine defect been found, CLAUDE.md's
    scope rule would have required stopping and reporting it rather than folding a fix in here.
  - **Verification (exact, all actually run).**
    - Backend full suite, after: **5,706 passed, 10 failed, 29 skipped** — the same 10 pre-existing
      inherited-LearnHouse failures as the baseline, **zero regressions**, and the +18 delta is exactly the
      18 new backend tests.
    - **One apparent new failure was investigated and traced to a pre-existing test-isolation defect in
      inherited LearnHouse code — not a regression, and not fixed (out of 9E's scope).** The first
      post-change full run reported 5,705 passed / **11** failed, the extra being
      `src/tests/security/test_active_users.py::TestRecordActivity::test_ee_records`.
      - **Root cause, established rather than assumed.** That test calls `record_user_activity()` **without
        mocking Redis**, and `services/security/activity.py` guards the DB insert behind a Redis day-key
        (`activity_touched:{org}:{user}:{date}`, `SET NX` with TTL = seconds to UTC midnight). Once the key
        exists, `record_user_activity` returns *before* `_insert_activity_row`, so the spy never fires and
        `assert called["db"] is True` fails. **The test therefore passes only on the first run per UTC day
        per Redis instance** — and the *baseline run itself* set `activity_touched:1:1:2026-08-24`.
      - **Proof, not inference.** (1) The test fails in complete isolation —
        `pytest src/tests/security/test_active_users.py::TestRecordActivity::test_ee_records` → 1 failed —
        a run in which no 9E file is even collected. (2) The live dev Redis was queried through the app's own
        client and held exactly one matching key, `activity_touched:1:1:2026-08-24`. (3) Deleting that key
        and re-running the same test → **1 passed**.
      - **A second full re-run confirmed the day-key mechanism rather than clearing it**, and is worth
        recording because it is the trap here: that re-run also reported 5,705 / 11 with the same test
        failing — because the isolated verification run in step (3) had itself re-created the key. Only
        deleting the key and launching the full suite **without running that test first** yields a clean
        result. That is the run the headline figures above come from.
      - **Left unfixed** per this increment's scope (fixing unrelated pre-existing failures is outside 9E) —
        recorded here with the fix for whoever owns it: mock `get_redis_client` in that test, or give it a
        per-test unique user/org id so the day-key can never pre-exist.
    - Focused, before → after: `test_quiz_attempts_service.py` 17 → **26 passed**;
      `test_organization_follows_service.py` 10 → **13 passed**;
      `test_moderation_visibility_integration.py` (new) → **6 passed**. Combined scoped run of all three:
      **45 passed, 0 failed**.
    - Scoped regression across the three files' original baseline set
      (`test_quiz_attempts_service.py` + `test_organization_follows_service.py` +
      `test_channel_videos_service.py`), before: **80 passed**.
    - Frontend full suite, after: **264 passed, 13 failed, 2 errors** (216 → 264, i.e. the 48 new tests),
      with an **identical failure set** to the baseline.
    - `uvx ruff@0.15.9 check` on all three changed/new Python test files → **clean**.
    - `bunx eslint tests/query-key-isolation.test.mjs --max-warnings=0` → **clean**.
    - `bunx tsc --noEmit` → **clean**.
    - `git diff --check` → **clean** (exit 0; only pre-existing CRLF-conversion warnings, which are
      environment-level and unrelated).
  - **Live API verification — done, and it is a change from 9A/9B's record.** Unlike those increments, the
    API dev server **was** already running on `:1338` against the real Postgres this session, so the
    anonymous gates 9E-1 adds tests for were additionally confirmed at the real HTTP boundary, not only
    against the in-memory SQLite harness. Read-only, unauthenticated `curl` only — no data was written:
    - `GET /api/v1/orgs/1/quizzes/1/attempts` → **401**, `GET /api/v1/orgs/1/quizzes/1/attempts/1` → **401**
      — the live counterparts of 9E-1's `test_anonymous_cannot_get_an_attempt` and the existing
      `test_anonymous_cannot_list_attempts`.
    - `GET /api/v1/feed` → **401**, matching `test_feed_router.py::test_home_feed_rejects_anonymous_caller`.
    - `GET /api/v1/orgs/1/progress` → **401**; `GET /api/v1/notifications` → **401**;
      `GET /api/v1/notifications/unread-count` → **401**.
    - `GET /api/v1/shorts` → **200 `[]`** — the unauthenticated public discovery endpoint serves, and is
      empty because no published short is seeded (the same missing fixture 9D recorded).
    - `GET /api/v1/users/parent-links` → **405**, i.e. wrong verb for that route, not an auth result. Noted
      so it is not misread as a gate; not a finding.
    - So the classification for these specific assertions is **test-verified *and* live-verified**. The
      cross-org, cross-quiz, answer-key-strip, follow-isolation, moderation-sequence and query-key
      assertions remain **test-verified only** — they need two seeded orgs, a seeded quiz with questions, and
      an authenticated session, none of which exist in this environment (see the single-tenancy limitation
      below).
  - **Limitations — stated, not skipped.**
    - **No live browser verification, and none was applicable.** 9E adds no UI and changes no component;
      its one frontend increment is a pure-logic guard over a module with no runtime surface. This is
      *not needed*, distinct from 9C/9D's genuine unverified-at-runtime items — which are carried forward
      below, not absorbed into this line.
    - **No authenticated or multi-org live verification.** The smoke checks above are anonymous and
      read-only. Nothing was seeded and no session was created, so every positive-path assertion is
      test-verified against the in-memory SQLite harness only.
    - **The SQLite harness cannot prove FK cascade or DB-level constraint behaviour** — see 9E-3. The
      unique-constraint idempotency paths (`IntegrityError` handling in follows/reports) are likewise
      exercised only through their Python branch, not through a real concurrent violation.
    - **The standing single-tenancy limitation is unchanged**: cross-org isolation can only ever be proven
      via direct API calls with two seeded orgs, never through the browser. 9E's cross-org conclusions rest
      on the org-scoped query predicates plus these tests, not on a live multi-org smoke test — the same
      caveat 9A recorded.
    - **9C/9D's genuine runtime gaps are carried forward unchanged**, not silently dropped: the Shorts snap
      geometry, the engagement-bar wrap, the quiz timer over real answer controls, the dialogs with a real
      on-screen keyboard, `env(safe-area-inset-bottom)` always reading `0` off-device, and 9C's H5/H6
      keyboard checks.
  - **Deferred / not done in 9E, with reason.**
    - **Router-level HTTP tests for the 53 LearnOrbit endpoints on `routers/orgs/orgs.py`.** Router coverage
      is deliberately thin by existing convention — `test_channel_videos_router.py` and
      `test_feed_router.py` both state it: routers are tested for the boundary concerns only (query-param
      validation, anonymous access), with behaviour proven at the service layer. Adding 53 HTTP tests would
      re-prove service logic through a slower transport. Left as convention, not a gap.
    - **Frontend fetch-wrapper tests.** `channelVideos.ts`, `feed.ts`, `notifications.ts`, `quizProgress.ts`,
      `shorts.ts`, `verification.ts` etc. are thin `fetch` + `errorHandling` wrappers with no branching. The
      established convention (recorded at 8D and 9A) is that `bun test` covers logic, not thin fetch
      wrappers. Unchanged.
    - **9A's F2 (rate limiting) and F3 (CSRF middleware)** remain deferred exactly as recorded — F2 as its
      own increment, F3 to 9F.
    - **9D's `interactiveWidget: 'resizes-content'` follow-up**, which the 9D M6 record floated as "a
      reasonable candidate for 9E". It is a root `viewport` export affecting every page — responsive
      infrastructure, not testing — so folding it into 9E would have been scope creep. **Explicitly declined
      here and left as a standalone follow-up.**
    - **`test_active_users.py::TestRecordActivity::test_ee_records`'s Redis-state dependency** (see
      Verification). Real defect, inherited LearnHouse, one-line fix — but fixing unrelated pre-existing
      failures is outside this increment. Recorded, not fixed.
  - **Documentation**: this entry. `docs/ARCHITECTURE.md` was **not** updated — 9E introduced no new
    architectural decision, API boundary, data model or security pattern; the mutation-check convention is
    recorded here and in the test files themselves rather than promoted to an architecture decision.
    `docs/ROADMAP.md`'s "Testing" box is now checked, with the router/fetch-wrapper conventions noted inline.
    **Next per `docs/ROADMAP.md`: Phase 9F — Deployment plan**, the last Phase 9 item. Not started; do not
    begin automatically. It also owns 9A's F3 CSRF-middleware decision and the deployment/infra sections of
    `docs/SECURITY_REVIEW.md` that 9A mapped forward to it.

---

## Security re-verification against `docs/SECURITY_REVIEW.md` (2026-08-24, pre-9F)

Not a roadmap phase — a full, item-by-item re-audit requested before Phase 9F begins. Every
vulnerability/requirement in `docs/SECURITY_REVIEW.md` was treated as its own verification item and
re-confirmed **against the current code**, not carried over from 9A/9E. Full evidence table lives in
`docs/SECURITY_REVIEW.md` § "Re-verification Record — 2026-08-24 (pre-Phase-9F)" (appended; nothing in
§1–§56 was rewritten or deleted).

- **Result**: 101 items — **83 VERIFIED · 10 PARTIAL/accepted · 5 OPEN · 3 DEFERRED**.
  **No Critical or High severity item is open.**

- **Fixed this session** (scoped, test-backed, under the checklist's "small scoped security fixes"
  allowance): **§39 unbounded pagination** on the last two uncapped LearnOrbit list endpoints.
  - `apps/api/src/routers/notifications.py` — `GET /notifications` `page`/`limit` now
    `Query(ge=1)` / `Query(ge=1, le=100)`.
  - `apps/api/src/routers/orgs/orgs.py` — same cap on
    `GET /orgs/{org_id}/videos/{channelvideo_id}/comments`.
  - Matches the 9B-1 convention already used by `/shorts`, `/feed`, `/orgs/{id}/questions`,
    `/orgs/{id}/reports`. Both service layers offset/limit unclamped, so these were real unbounded reads.
  - Regression tests in `src/tests/routers/test_notifications_router.py` and
    `test_channel_videos_router.py` (out-of-range → 422, in-range → 200). **Mutation-verified**: reverting
    the `/notifications` cap makes `test_notifications_rejects_out_of_range_pagination_params` fail.

- **New finding, reported not fixed — quiz time limit is client-only (MEDIUM, §45 / §2.19).**
  `services/orgs/quiz_attempts.py::submit_quiz_attempt` validates ownership, rejects non-`in_progress`
  (409) and unknown/duplicate question ids (422), but never compares `now` to
  `started_at + quiz.time_limit_minutes`. `apps/web/components/Objects/Channel/QuizTimer.tsx` is the only
  enforcement, so a student can let the timer expire and still submit. Phase 6F recorded the timer as a
  deliberate client-side implementation but never recorded it as an accepted *security* limitation — it is
  now recorded as OPEN. **Deliberately not fixed here**: the remedy needs a product decision (reject with
  409 vs. accept and mark the attempt expired/ungraded), and those produce materially different
  student-facing behavior.

- **Still open / deferred, unchanged and re-confirmed against current code**:
  - **F2 rate limiting (§21, §2.17, §54.16 — MEDIUM, OPEN).** `check_rate_limit` exists and is wired into
    auth/admin/AI/invite/password-reset, but **zero** LearnOrbit mutation endpoints use it. Still its own
    future increment.
  - **F3 CSRF (§11, §54.9 — MEDIUM, DEFERRED to 9F).** `security/csrf.py::CSRFProtectionMiddleware` is
    implemented and tested but never registered — `apps/api/app.py` adds only CORS + GZip + EE hooks.
    Mitigated, not eliminated, by `SameSite=Lax` on `LH_access`/`LH_refresh`.

- **Non-LearnOrbit / inherited LOW gaps, recorded for separate increments** (deliberately not fixed —
  infrastructure changes outside this task's scope): no `Permissions-Policy` header (§30); API Dockerfile
  has no `USER` directive so the container runs as root (§34); no `permissions:` block in any
  `.github/workflows/` file (§35); `images.remotePatterns: hostname: '**'` in `apps/web/next.config.js`
  gives the Next image optimizer an arbitrary-host server-side fetch (§15).

- **Verification** (all actually run):
  - `TESTING=true uv run pytest src/tests/security/` → **1331 passed, 4 skipped, 1 failed** —
    `test_active_users.py::TestRecordActivity::test_ee_records`, the pre-existing EE-gate failure already
    recorded in the 9E entry (`is_ee_available()` is False because `ee/hooks.py` is absent API-side).
    Unrelated to this diff.
  - `pytest` over 15 LearnOrbit router/service suites (feed, shorts, notifications, channel videos, parent
    links, quizzes, quiz attempts, questions, reports, follows, SSRF guard, link preview) → **295 passed**.
  - `uvx ruff@0.15.9 check` on the 4 changed Python files → **All checks passed**.
  - `bunx tsc --noEmit` in `apps/web` → **clean**.
  - ESLint **not run — no frontend file changed** in this diff.
  - `git diff --check` → clean (CRLF advisories only, pre-existing repo-wide).
  - **Browser verification not attempted** — no UI change. Separately, browser-level cross-org isolation
    (§6, §3.5) remains unprovable locally: `tenancy: single` collapses org routing, and `multi` is
    hard-rejected on localhost domains. Verified at service/router level instead.

- **Documentation**: `docs/SECURITY_REVIEW.md` (Re-verification Record appended) and this entry.
  `docs/ARCHITECTURE.md` **not** updated — no new architectural decision. `docs/ROADMAP.md` **not**
  touched, per instruction.

- **Git**: no commit, no push. Working tree left as-is.

- **Next**: **Phase 9F — Deployment plan** (unchanged), which owns F3 CSRF-middleware registration.
  Before or alongside it, the quiz time-limit product decision above needs an answer. Not started.

### Security re-verification — second pass: checklist reconciliation (2026-08-24)

Continuation of the entry above, not a restart. Goal: make `docs/SECURITY_REVIEW.md` self-reporting, so
opening it shows immediately which original requirements are complete and which are outstanding.

- **No code changed in this pass.** The only code changes from this audit remain the two §39 pagination
  caps recorded in the previous entry.

- **`docs/SECURITY_REVIEW.md` — reconciled in place, original wording preserved:**
  - The document's **only literal checklist** is §54's 24-item block (it was lines 1709–1732; the §2 rules
    and §§ headings are numbered prose, not checkboxes). Those 24 `[ ]` boxes are now **marked in place**,
    question wording untouched, each outstanding one annotated inline with its status and a §-reference.
  - Added **§1a Status Index** immediately after §1 Purpose — a status view over the existing IDs and
    wording (not a new checklist), leading with a short table of only the outstanding items.
  - Normalised every status in the appended Re-verification Record to the five-value vocabulary
    `[x]` / `[ ] OPEN` / `[ ] DEFERRED` / `[ ] INHERITED` / `[ ] N/A`, replacing the earlier
    `[~] PARTIAL` / `[D]` markers so there is one consistent view.
  - Nothing in §1–§56 was rewritten or deleted.

- **Final reconciliation: 101 items — 84 `[x]` · 5 OPEN · 7 DEFERRED · 4 INHERITED · 1 N/A.**
  **No Critical or High severity item is outstanding.**

- **New finding this pass — link-preview error detail leak (LOW, §19 / §54.15, OPEN).**
  `apps/api/src/services/utils/link_preview.py:98` and `:105` return `detail=str(exc)` from
  `SSRFBlockedError`, so the caller receives the internal detail verbatim — e.g. the blocked private IP a
  hostname resolved to, or the rebinding message naming the validated address set. That turns the
  link-preview endpoint into an internal-network oracle, which is exactly what §19 and §2.12 forbid.
  **Reported, not fixed:** `src/tests/services/test_link_preview_service.py:169, 210, 230, 284` assert on
  those exact strings, so changing the message rewrites an error contract four existing tests encode as
  intentional. That is beyond a scoped fix and needs a decision rather than a silent edit.

- **Outstanding, by root cause** (5 OPEN rows, 7 DEFERRED rows, but only 4 distinct causes):
  - Quiz time limit not enforced server-side — §2.19, §45, §54.23 (MEDIUM, OPEN, needs product decision)
  - Link-preview error detail leak — §19, §54.15 (LOW, OPEN, new this pass)
  - **F2** rate limiting — §2.17, §21, §22, §54.16, §54.17 (MEDIUM, DEFERRED, own increment)
  - **F3** CSRF middleware registration — §11, §54.9 (MEDIUM, DEFERRED to 9F)
  - Plus 4 INHERITED LOW infra gaps (§15 `remotePatterns: '**'`, §30 `Permissions-Policy`,
    §34 API container runs as root, §35 no workflow `permissions:` block) and §43 Payments N/A (EE-only).

- **Verification completed this pass** (all actually run):
  - `dangerouslySetInnerHTML` sweep of `apps/web` → exactly 3 sinks, all sanitised
    (`EmbedBlockComponent.tsx`, `EmbedObjectsComponent.tsx` via DOMPurify; `JsonLd.tsx` via
    `serializeJsonLd`), none in LearnOrbit-authored components — §10 confirmed.
  - `detail=str(exc)` / `traceback` sweep of `apps/api/src/services` → surfaced the §19 finding above;
    no other error path leaks internals.
  - Secret-logging sweep → the three matches log *failures about* secrets, never a secret value — §20.
  - Migration coverage → every LearnOrbit table has one (`add_channel_video_table`,
    `add_channel_video_engagement_tables`, `add_organization_follows_table`,
    `add_parent_child_link_table`, `add_quiz_attempt_tables`, `add_notification_table`,
    `add_channel_video_report_table`, `add_channel_type_to_organization`) — §23.
  - `pytest src/tests/security/` re-run → **1331 passed, 4 skipped, 1 pre-existing EE failure**
    (`test_active_users.py::TestRecordActivity::test_ee_records`), unchanged.
  - `pytest` over the 15 LearnOrbit router/service suites re-run → **295 passed**.
  - `git diff --check` → clean (CRLF advisories only, pre-existing repo-wide).
  - Ruff / tsc / ESLint: not re-run — **no code file changed in this pass**; the previous entry's results
    stand.
  - Browser verification: not attempted, no UI change.

- **Documentation**: `docs/SECURITY_REVIEW.md` (§1a index, §54 marked in place, record normalised) and
  this entry. `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` **not** touched.

- **Git**: no commit, no push.

- **Next**: **Phase 9F — Deployment plan** (unchanged), which owns F3. Two product decisions are queued
  ahead of / alongside it: the quiz time-limit behavior (§45) and whether to change the link-preview
  error contract (§19). Not started.

### Security fix — server-side quiz time-limit enforcement (2026-08-24)

Resolves the OPEN finding raised by the security re-verification above (`docs/SECURITY_REVIEW.md`
§2.19, §45, §54.23). **Decision taken by the user: enforce server-side and reject a late
submission as expired rather than grading it.** This is a scoped security fix, not a new phase.

- **The hole**: `submit_quiz_attempt` validated ownership, attempt status and question ids, but never
  compared `now` to `started_at + quiz.time_limit_minutes`. The limit existed only in
  `apps/web/components/Objects/Channel/QuizTimer.tsx`, so a student who let the timer expire — or any
  client that never ran it — could still have a late attempt graded normally.

- **Files changed** (2):
  - `apps/api/src/services/orgs/quiz_attempts.py` — new `_require_within_time_limit(quiz, attempt)`,
    called from `submit_quiz_attempt` right after the existing `status != "in_progress"` check and
    **before** answer-shape validation and the grader. Late submission → `409 "This attempt has
    expired"`. Added `timedelta` to the `datetime` import.
  - `apps/api/src/tests/services/test_quiz_attempts_service.py` — 11 new cases; the existing
    `_published_quiz_with_questions` helper gained an optional `time_limit_minutes=None` parameter
    (every existing caller is unaffected).

- **Design decisions, deliberately scoped small**:
  - **No state change on rejection.** The attempt stays `in_progress`, no `QuizAnswer` rows, score
    untouched. A terminal `"expired"` status was *not* added — `db/quiz_attempts.py` documents the
    vocabulary as `"in_progress" | "submitted" | "graded"`, so a fourth value is a schema/vocabulary
    change rather than the minimum enforcement. Available as a follow-up if expired attempts should
    appear in history.
  - **Inclusive deadline** — only `now > deadline` expires; a 30-minute quiz means 30 minutes.
  - **No clock-skew grace window** — adding one is a product decision, not a security default.
  - **Fail closed** — a *timed* attempt whose `started_at` is empty or unparseable is refused, since
    it cannot be shown to be inside its window. Untimed quizzes short-circuit before any parsing and
    are completely unaffected.
  - **Timezone correctness**: `started_at` is written by `_now()` as a naive string that already means
    UTC, so it is re-stamped UTC only when `tzinfo is None`; an offset-aware value is honoured, not
    clobbered. Comparing against a local-time `now` would shift every deadline by the server offset.

- **Frontend unchanged.** `QuizTimer.tsx` is now a convenience only. `attempt.tsx`'s existing
  `handleSubmit` catch already renders a failed submission as `submitError`, so a 409 shows as a
  message rather than breaking the page. The timer's auto-submit fires *at* the deadline, which the
  inclusive boundary accepts; only genuinely late arrivals are refused. If slow connections turn out
  to push legitimate auto-submits past the deadline, an explicit grace window is the fix — flagged,
  not assumed.

- **Verification** (all actually run):
  - `TESTING=true uv run pytest src/tests/services/test_quiz_attempts_service.py` → **38 passed**
    (26 pre-existing + 12 new test ids from 11 cases, one parametrized ×2).
  - Quiz/question service suites + `test_quiz_attempt_model.py` + `test_quiz_model.py` + the entire
    `src/tests/routers/` tree → **948 passed, 0 failed** (247 s).
  - **Mutation-verified three ways**, each breaking a different test, so no property passes by
    accident: deleting the guard call → 5 rejection tests fail; `>` → `>=` → the exact-deadline test
    fails; dropping the `tzinfo is None` guard → the offset-aware test fails. Guard restored and
    re-passing after each.
  - Note: the first drafts of the boundary and timezone tests **survived** mutations 2 and 3 — wall
    clock can never hit the deadline to the microsecond, and a `+02:00` offset happens to fail safe.
    Both were rewritten (a `_ClockAt` stand-in freezing the module's `datetime.now`, and a `-05:00`
    offset) until they actually bit.
  - `uvx ruff@0.15.9 check` on both changed files → **All checks passed**.
  - `git diff --check` → clean (CRLF advisories only, pre-existing repo-wide).
  - No frontend file changed → ESLint/tsc not re-run.
  - Browser verification not attempted — no UI change.

- **Checklist impact**: §2.19, §45 and §54.23 flip from OPEN to `[x]`, including the in-place §54
  checkbox. `docs/SECURITY_REVIEW.md` totals are now **101 items — 87 `[x]` · 2 OPEN · 7 DEFERRED ·
  4 INHERITED · 1 N/A**. Exactly one unfixed root cause remains in LearnOrbit-owned code: the
  link-preview error-detail leak (§19 / §54.15, LOW).

- **Documentation**: `docs/SECURITY_REVIEW.md` (§1a index, §54 checkbox, record rows, totals, and a
  new "Time-Limit Enforcement" note) and this entry. `docs/ARCHITECTURE.md` **not** updated — this
  applies an existing security pattern (server-side authorization of a client-visible constraint), it
  does not introduce a new one. `docs/ROADMAP.md` untouched.

- **Git**: no commit, no push.

- **Next**: **Phase 9F — Deployment plan**, which owns F3 CSRF-middleware registration. One decision
  still queued: whether to change the link-preview error contract (§19). Not started.

### Security fix — link-preview SSRF error-detail disclosure (2026-08-24)

Resolves the last OPEN finding from the security re-verification (`docs/SECURITY_REVIEW.md` §19,
§54.15, LOW). Scoped security fix, not a new phase.

- **The leak**: `apps/api/src/services/utils/link_preview.py` raised
  `HTTPException(400, detail=str(exc))` for both SSRF-guard rejections, handing the caller the
  guard's own words — the private address a hostname resolved to, or the peer plus validated
  address set from a rebinding detection. The guard blocked the fetch but the error narrated what
  it had found, making the preview endpoint an internal-network oracle.

- **Files changed** (2):
  - `apps/api/src/services/utils/link_preview.py` — added `logging` + module `logger`; new
    `_BLOCKED_URL_DETAIL = "This URL cannot be previewed"` returned for **every** guard rejection,
    with `logger.warning("Link preview blocked by SSRF guard: %s", exc)` preserving the real cause
    server-side.
  - `apps/api/src/tests/services/test_link_preview_service.py` — the four tests that intentionally
    asserted the leaked strings now assert the generic message *and* the absence of the internal
    token; 5 new regression cases added (7 test ids, one parametrized ×4).

- **Why one message for all four reasons**: disallowed scheme, blocked hostname, blocked address
  range and DNS rebinding all collapse to the same string. A per-reason message leaks the same
  topology more slowly — an attacker could still separate "blocked because private range" from
  "blocked because bad scheme" and walk the network that way.

- **Pattern reused, not invented**: `services/orgs/custom_domains.py:597-603` already handled the
  identical case exactly this way (log the detail, return a fixed generic message).
  `link_preview.py` was the outlier and now matches.

- **Deliberately not changed**: `services/webhooks/dispatch.py` also records
  `f"SSRF guard: {e}"`, but into `WebhookDeliveryLog.error_message` — a server-side delivery log
  read by the org admin who supplied that URL, not a response to an arbitrary caller. Different
  risk class; left alone.

- **Residual, recorded not fixed**: the 400 status code itself still separates "SSRF-blocked" from
  every other preview failure (those return 200 + minimal preview card), leaving a binary
  "does this host resolve privately?" oracle with no address disclosed. Closing it means returning
  `_minimal_preview(url)` on a block too, which changes the endpoint contract from 400 to 200 — a
  product/API decision, so it is documented rather than assumed. Much weaker than the original
  leak; does not keep §19 open.

- **Verification** (all actually run):
  - `pytest src/tests/services/test_link_preview_service.py` → **28 passed**.
  - link-preview + SSRF-guard + the entire `src/tests/security/` tree + `test_utils_router.py` →
    **1379 passed, 4 skipped, 1 failed** — the pre-existing
    `test_active_users.py::TestRecordActivity::test_ee_records` EE-gate failure, unrelated.
  - **Mutation-verified three ways**: restoring `detail=str(exc)` → 10 tests fail; appending the
    reason to the generic message → 10 tests fail (indistinguishability test bites); deleting the
    `logger.warning` calls → 2 tests fail, so the server-side diagnostics are asserted rather than
    assumed. Restored and re-passing after each.
  - Repo-wide grep confirmed nothing else depended on the old strings — the only other matches are
    the guard itself, its own tests, and the untouched webhooks/custom-domains paths. **No frontend
    dependency**, so no UI change was needed.
  - `uvx ruff@0.15.9 check` on both changed files → **All checks passed**.
  - `git diff --check` → clean (CRLF advisories only, pre-existing repo-wide).
  - No frontend file changed → ESLint/tsc not re-run. Browser verification not attempted.

- **Checklist impact**: §19 and §54.15 flip to `[x]`, including the in-place §54 checkbox.
  `docs/SECURITY_REVIEW.md` totals are now **101 items — 89 `[x]` · 0 OPEN · 7 DEFERRED ·
  4 INHERITED · 1 N/A**. **No OPEN item remains in LearnOrbit-owned code**; everything still
  outstanding is deferred by plan (F2, F3) or inherited infrastructure.

- **Documentation**: `docs/SECURITY_REVIEW.md` (§1a index, §54 checkbox, record rows, totals, and a
  new "Error-Detail Disclosure" note) and this entry. `docs/ARCHITECTURE.md` **not** updated — this
  applies an existing convention rather than introducing one. `docs/ROADMAP.md` untouched.

- **Git**: no commit, no push.

- **Next**: **Phase 9F — Deployment plan**, which owns F3 CSRF-middleware registration. F2 (rate
  limiting) remains its own increment. No decisions are queued. Not started.

---

## F2 — Rate Limiting (2026-08-24, security increment, pre-9F)

The rate-limiting increment queued by 9A / the 2026-08-24 security re-verification. Closes
`docs/SECURITY_REVIEW.md` **F2** — §2 rule 17, §21, §22, §54.16, §54.17. Scoped to F2 only:
quiz server-side expiry, the link-preview error leak, 9F and the CSRF decision were all left
alone, and no inherited LearnHouse/EE infrastructure was modified.

- **Existing infrastructure reused, not replaced.** `services/security/rate_limiting.py` already
  had `check_rate_limit` (Redis counter + TTL, `rate_limit:` key namespace) plus a family of
  `check_*` / `enforce_*` wrappers used by auth, AI, invites, search and the admin API — but no
  LearnOrbit endpoint called any of them. Two functions were added to that same module on top of
  the same primitive: `check_learnorbit_rate_limit()` and `enforce_learnorbit_rate_limit()`. No new
  Redis architecture, no middleware, no new dependency, no schema change.

- **Strategy.** One table, `LEARNORBIT_RATE_LIMITS`, holds `(max_attempts, window_seconds)` per
  *action*. Handlers name an action, never a raw key, so buckets cannot drift per endpoint. The
  enforce call is the **first statement** of every protected handler, so a rejected request never
  reaches the service and never writes. Keyed `lo:{action}:user:{id}` for authenticated callers
  (via `resolve_acting_user_id`, so API tokens resolve to their creator) and
  `lo:{action}:ip:{client_ip}` for anonymous ones, capped tighter at
  `LEARNORBIT_ANON_MAX_ATTEMPTS = 20`. The key deliberately contains **no request parameters**, so
  re-pointing the same action at a different org/video/comment does not reset the counter.
  Rejections return 429 with `Retry-After` and the codebase's existing
  `{"code": "RATE_LIMITED", ...}` envelope, so the frontend needed no change.

- **Endpoints protected — 36.** 33 in `apps/api/src/routers/orgs/orgs.py`, 3 in
  `apps/api/src/routers/users.py`:
  - `follow_toggle` (60/min) — `POST`/`DELETE /{org_id}/follow`
  - `reaction_toggle` (120/min) — like and save, `POST`/`DELETE` each
  - `share_create` (60/min) — `POST …/share`
  - `comment_write` (20/min) — comment create, update, delete
  - `report_create` (10/hour) — `POST …/report`
  - `moderation_write` (60/min) — report resolve, org verification
  - `content_write` (60/min) — 19 routes: channel video / resource / question / quiz CRUD,
    publish toggles, quiz-question attach/reorder/detach
  - `quiz_attempt_start` (30/hour) — `POST …/quizzes/{quiz_id}/attempts`
  - `parent_link_write` (10/hour) — parent-link request, respond, revoke
    (these three handlers gained a `request: Request` parameter so anonymous callers can be
    IP-keyed; no behaviour change otherwise)

- **Limits chosen so a fast, legitimate human never notices.** Shorts reactions get the loosest
  ceiling (120/min) because scrolling is the fastest real interaction on the platform; comments the
  tightest per-minute one (20/min) because it is the top spam vector; reports and parent-link
  requests are hourly (10/hour) because both push work or notifications onto *another person*.
  `content_write` is generous (60/min) so a teacher bulk-authoring a question bank is never
  blocked. Full per-action rationale table in `docs/SECURITY_REVIEW.md` § "Rate Limiting (F2)".

- **Intentionally unprotected, recorded not overlooked.**
  - `POST …/attempts/{attempt_id}/submit` — an attempt submits exactly once (409 after that), so
    `quiz_attempt_start` already bounds it, and a 429 here would discard a student's finished quiz.
    It is the single entry in `EXPECTED_UNPROTECTED` in the router test, so it fails the build if
    it ever stops being a deliberate choice.
  - `PATCH /notifications/{uuid}/read`, `PATCH /notifications/read-all` — caller's own rows only,
    no fan-out, nothing exposed.
  - Read-only endpoints — out of scope by the review's own guidance; §39 page-size caps already
    bound them.

- **Fail-open on Redis failure — a deliberate, documented decision.** If Redis is unconfigured or
  unreachable the LearnOrbit limiter allows the request, logs a warning and backs off for 30s
  instead of re-dialling per request. `core/redis.py` already treats Redis as optional and degrades;
  these are engagement endpoints with nothing to brute-force, and a cache-tier blip must not take
  comments/likes/follows down platform-wide. Auth-side helpers keep their stricter behaviour
  unchanged. Residual risk (no ceilings during an outage) is recorded in `SECURITY_REVIEW.md`;
  closing it needs an availability trade or a per-worker counter, both beyond F2.

- **Tests — 29 new.**
  - `apps/api/src/tests/services/test_learnorbit_rate_limiting_service.py` (20) — ceiling
    allow/deny, per-user isolation, per-action isolation, parameter-tampering resistance, anonymous
    IP keying, anonymous ceiling never looser, per-IP isolation, user bucket separate from the IP
    bucket, window expiry, TTL always set, 429 envelope + `Retry-After`, no information leak,
    fail-open, backoff, reset.
  - `apps/api/src/tests/routers/test_learnorbit_rate_limits_router.py` (9) — a route-coverage test
    that enumerates every LearnOrbit mutation route and fails on any unprotected one, a
    declared-action test, a "limiter runs first" test, and six over-HTTP tests.
  - `apps/api/src/tests/fixtures/fake_redis.py` (new) and an autouse `isolated_rate_limit_store`
    fixture in `apps/api/src/tests/conftest.py` give every test its own in-memory store — the
    limiter now runs inside the endpoints under test, CI has no Redis, and a dev machine usually
    has the dev Redis up, so without this the suite would behave differently in each place and
    accumulate counters across reruns.
  - **Mutation-verified four ways**: dropping the limiter from one handler → the coverage test
    fails; making the limiter always allow → 14 tests fail; keying anonymous callers to one shared
    bucket → 3 tests fail; moving the limiter after the service call → the ordering test fails.
    Restored and re-passing after each.

- **Verification.**
  - Focused: `pytest src/tests/services/test_learnorbit_rate_limiting_service.py
    src/tests/routers/test_learnorbit_rate_limits_router.py` → **29 passed**.
  - LearnOrbit regression (the pre-change baseline set, re-run): orgs / parent-links /
    notifications / channel-videos / shorts / feed routers + AI-rate-limit, search, auth, invite
    hardening and resource-exhaustion security tests → **244 passed**. The same LearnOrbit router
    baseline was **137 passed** before any change, and all 137 still pass.
  - Full API suite: **5757 passed, 29 skipped, 11 failed (15:12)**. All 11 failures are
    **pre-existing and unrelated** — proven by re-running them with every file this increment
    touched stashed, which reproduces the same 11: three EE-gate tests
    (`test_core_events.py::test_register_ee_helpers_and_startup`,
    `test_core_events_runtime.py::test_ee_hook_registration_and_paid_access`,
    `test_active_users.py::TestRecordActivity::test_ee_records`), three
    `test_custom_domains_service.py`, three `test_org_invites_service.py`, two
    `test_podcasts_service.py`. Only `test_ee_records` was previously recorded; the other ten are
    newly *observed* here, not newly *caused* — the earlier security session ran a subset, never
    the full suite. All sit in inherited LearnHouse code (podcast listing RBAC, custom domains,
    invite codes, EE gating) that F2 does not touch.
  - `uvx ruff@0.15.9 check` on all changed backend files → **All checks passed**.
  - `git diff --check` → clean (CRLF advisories only, pre-existing repo-wide).
  - No frontend file changed → ESLint/tsc not re-run. No browser verification: backend-only
    increment, no UI change, and the 429 envelope is the one the frontend already handles.

- **Files changed**: `apps/api/src/services/security/rate_limiting.py`,
  `apps/api/src/routers/orgs/orgs.py`, `apps/api/src/routers/users.py`,
  `apps/api/src/tests/conftest.py`; new — `apps/api/src/tests/fixtures/fake_redis.py`,
  `apps/api/src/tests/services/test_learnorbit_rate_limiting_service.py`,
  `apps/api/src/tests/routers/test_learnorbit_rate_limits_router.py`.

- **Checklist impact**: §2.17, §21, §22, §54.16 and §54.17 flip to `[x]`, including the in-place
  §54 checkboxes. `docs/SECURITY_REVIEW.md` totals are now **101 items — 94 `[x]` · 0 OPEN ·
  2 DEFERRED · 4 INHERITED · 1 N/A**. The only remaining DEFERRED items are §11 and §54.9, both
  **F3 CSRF middleware**, which belongs to Phase 9F.

- **Documentation**: `docs/SECURITY_REVIEW.md` (§1a index, "Everything else", totals, §54
  checkboxes, record rows 2.17 / §21 / §22 / 54.16 / 54.17, the "Recommended fixes before Phase 9F"
  list, and a new "Rate Limiting (F2)" note) and this entry. `docs/ARCHITECTURE.md` **not** updated
  — F2 reuses an existing helper family and its existing conventions rather than introducing an
  architectural decision. `docs/ROADMAP.md` untouched (no roadmap milestone changed).

- **Git**: no commit, no push.

- **Next**: **Phase 9F — Deployment plan**, the last Phase 9 item, which owns the F3 CSRF-middleware
  registration decision (§11 / §54.9). Not started; do not begin automatically.

---

## Phase 9F — Deployment Plan (2026-08-25)

The final Phase 9 V1 Hardening increment. **A read-only deployment audit and plan: no deployment
infrastructure was built, no production configuration was changed, and no code was modified.** It also
owns and resolves 9A's **F3 CSRF-middleware decision**.

### Completed

- **`docs/DEPLOYMENT_PLAN.md` (new, 17 sections)** — a deployment plan grounded in this repository rather
  than a generic checklist. Every instruction is traced to a file: current architecture, production
  prerequisites, environment/secrets inventory, database & migrations, Redis, storage, HTTPS/browser
  security, monitoring, backups/recovery, deployment strategy, CI/CD, rollback, the deployment procedure,
  post-deployment verification, the F3 decision, and the final checklist.

- **F3 CSRF — resolved config-first. Decision taken by the user.** This **supersedes** the
  "register `CSRFProtectionMiddleware` in `apps/api/app.py`" recommendation in `docs/SECURITY_REVIEW.md`
  § "Recommended fixes before Phase 9F" item 4, which assumed a one-line change. Verified against current
  code:
  - Auth is **both** cookie- and header-based. `security/auth.py:85` prefers `Authorization: Bearer <jwt>`
    (excluding `Bearer lh_*`) and **falls back to the `LH_access` cookie**; the web client sends
    `credentials: 'include'` on every request, so browser traffic always carries cookies.
  - `LH_access` (8 h) / `LH_refresh` (30 d): `httponly=True`, `secure=is_request_secure(request)`,
    `samesite="lax"`, `domain=None` under `tenancy: single` (`routers/auth.py:189-206, 435-452`).
  - **Why it is unregistered:** `app.py` calls `register_ee_middlewares(app)`, and `is_ee_available()`
    requires both `ee/` and `ee/hooks.py`. `apps/api/ee` **does not exist in this checkout** (gitignored
    private overlay) and is deleted from every published image by `ARG LEARNHOUSE_PUBLIC=true`, which
    `build-community.yaml` and `release.yaml` both pass. The hook is a permanent no-op in OSS builds.
  - **The finding that changed the decision:** `config.yaml:44` ships an `allowed_regexp` that is a
    **catch-all — it `fullmatch`es any well-formed origin**, an attacker's included. The file's own
    comment says CORS and CSRF are "effectively open unless you scope it", and
    `services/email/utils.py:57` independently detects and ignores this exact pattern as unscoped. The
    CLI's generated `.env` (`apps/cli/src/templates/env.ts`) sets neither `LEARNHOUSE_ALLOWED_REGEXP` nor
    `LEARNHOUSE_ALLOWED_ORIGINS`. **Registering the middleware today would therefore protect nothing.**
  - **And it would break things:** a state-changing request with neither `Origin` nor `Referer` gets 403.
    That is **475 mutation calls across 53 test files** (`TestClient` sends no `Origin`; only 14 lines in
    the whole suite set one), plus non-browser JWT clients (only `lh_*` tokens are exempt) and the
    `app/api/billing/*` / `app/api/loops/*` route handlers that build their own server-side fetches.
  - **`SameSite=Lax` assessed as near-sufficient for the V1 threat model:** it suppresses cookies on every
    cross-site state-changing method the API exposes. Residual gaps — cross-site GET (no LearnOrbit
    mutation is exposed over GET) and same-site different-origin (requires `tenancy: multi` with a dotted
    cookie domain, which is EE-only and not the V1 deployment). A defence-in-depth gap, not an exploitable
    hole.
  - **Outcome:** scoping `LEARNHOUSE_ALLOWED_REGEXP`/`LEARNHOUSE_ALLOWED_ORIGINS` is now a **mandatory
    pre-deployment step** (it already scopes CORS and email links today); middleware registration is
    queued as its own increment with the exact diff and six prerequisites recorded in
    `docs/DEPLOYMENT_PLAN.md` §15.6.

- **Production architecture mapped.** All-in-one image (root `Dockerfile`): Next.js standalone on 8000,
  FastAPI on 9000, Collab on 4000, internal nginx on 80, all under pm2 via `docker/start.sh`. Outer proxy
  is Caddy (auto-SSL) or nginx (no TLS), from `apps/cli/src/templates/`. Per-component env, volumes,
  ports, trust boundaries, health checks and failure behaviour tabulated in §1.3.

- **Recommended strategy: single-server Docker Compose via the LearnHouse CLI, with Caddy.** It is the
  only path the repo automates end to end — notably the Alembic baseline/stamp handling around
  `create_all` and the content-volume migration. Separate web/API deployment is **not** supported (no
  compose wires the three individual Dockerfiles together); Kubernetes and PaaS are out of scope.

### Key findings (audit, not fixes)

1. **`create_all` runs on every API start** (`core/events/database.py:398`) alongside Alembic. It creates
   missing *tables* but never alters existing ones, so new LearnOrbit tables self-create while new
   *columns* (`organization.channel_type`, `organization.is_verified`, `user.is_parent`,
   `channelvideo.content_format`) do not. A create_all-bootstrapped DB also has no `alembic_version` row.
   The CLI's `ensureAlembicBaseline` handles this; a hand-rolled deploy must stamp explicitly.
2. **All 14 LearnOrbit migrations are expand-only** — `create_table` or `add_column` with a
   `server_default`; no `drop_column`, `alter_column`, backfill or bare `NOT NULL`. **Rolling-deploy safe
   in both orderings**, which is why the plan recommends migrate-then-deploy even though the CLI does
   deploy-then-migrate. Single head verified: **`b7e4f1a92c83`** (three earlier heads merged by
   `e6f7a8b9c0d1_merge_heads.py`).
3. **F2 fail-open documented operationally.** While Redis is unreachable, every LearnOrbit engagement
   limit is off (30 s process-local backoff, one WARNING line), *and* login/signup/password-reset return
   500 because the auth-side limiters fail closed. Recorded as an alertable, security-relevant event.
4. **`npx learnhouse backup` covers PostgreSQL only** — the `learnhouse_content_*` volume (every uploaded
   video, PDF and past paper) is not included. A DB-only restore yields a catalogue of broken links.
   Explicit `docker run … tar` command added to the plan (§9.2).
5. **No `.env.example` exists anywhere in the repo**, which is why §3 writes the full variable inventory
   out by category (required secret / required non-secret / optional / dev-only / EE-only).
6. **`.gitignore` gap** — the root file covers `.env`, `.env.local` and `.env.*.local` but **not
   `.env.production`**, which would therefore be committable. Flagged, not changed.
7. **CI gaps for a deployment gate:** no `tsc --noEmit` on `apps/web`, no `bun test tests` (so 9E's 48
   frontend tests never run in CI), no Alembic head check, no migration smoke test, no image smoke test,
   and **no deployment workflow at all** — release ends at "image pushed".
8. **`SECURITY_REVIEW.md` §35 is partially stale:** five workflows *do* declare `permissions:` blocks
   (`api-tests`, `api-lint`, `web-lint`, `lockfiles`, `build-community`) and `release.yaml` declares
   `contents: write, packages: write`. Recorded for re-audit; **not** silently rewritten.

### Deployment decisions raised, not resolved (out of 9F's read-only scope)

- **Container registry (blocker).** `apps/cli/src/commands/update.ts:21` hardcodes
  `GHCR_BASE = 'ghcr.io/learnhouse/app'` and `constants.ts:2` sets `APP_IMAGE` to the same, and both
  `build-community.yaml` and `release.yaml` push there. **`npx learnhouse update` on a LearnOrbit install
  would pull upstream LearnHouse**, silently reverting Phases 1–9. Options in §12.4.
- Host sizing, alert thresholds/on-call/log retention, backup retention and RPO/RTO targets — labelled
  **Deployment decision** rather than invented.

### Files

- **New:** `docs/DEPLOYMENT_PLAN.md`
- **Changed:** `docs/ROADMAP.md` (Phase 9 "Deployment plan" → `[x]`), `docs/PROGRESS.md` (this entry)
- **No code, configuration, migration, Dockerfile or workflow file was modified.**

### Verification

- **`git diff --check`** → clean (pre-existing repo-wide CRLF advisories only, in files this increment did
  not touch).
- **Every deployment instruction cross-checked against the repository** — `Dockerfile`, `docker/start.sh`,
  `docker/nginx.conf`, `apps/api/Dockerfile`, `apps/api/docker-entrypoint.sh`, `apps/api/app.py`,
  `apps/api/config/config.py`, `apps/api/config/config.yaml`, `apps/api/alembic.ini`,
  `apps/api/migrations/env.py` + all 80 revisions,
  `apps/api/src/core/events/{database,events,logs,content,autoinstall}.py`,
  `apps/api/src/core/{redis,ee_hooks}.py`, `apps/api/src/core/middleware/cors.py`,
  `apps/api/src/security/{auth,csrf,file_validation}.py`, `apps/api/src/services/security/rate_limiting.py`,
  `apps/api/src/services/health/health.py`, `apps/api/src/routers/{auth,health,local_content}.py`,
  `apps/api/src/services/utils/upload_content.py`, `apps/web/{next.config.js,server-wrapper.js,proxy.ts}`,
  `apps/web/services/config/config.ts`, `apps/web/services/utils/ts/requests.ts`,
  `apps/web/app/api/health/route.ts`, `apps/web/app/api/v1/[...path]/route.ts`, `apps/collab/src/index.ts`,
  `apps/cli/src/templates/{docker-compose,env,caddyfile,nginx}.ts`,
  `apps/cli/src/commands/{update,update-ee,backup}.ts`, `apps/cli/src/constants.ts`,
  `.learnhouse/docker-compose.dev.yml`, all 10 `.github/workflows/`, and the root/app `.gitignore` files.
- **No secret values were printed or written** — variables are named, never valued. Re-checked the whole
  document before finalising.
- **Alembic head derived by parsing the 80 revision files**, not by running `alembic heads` — see
  Limitations.

### Limitations

- **The `apps/api/.venv` is a Linux venv reached over a Windows UNC path**, so `alembic`, `pytest` and
  `ruff` could not be executed in this session. Not needed for a documentation-only increment (no code
  changed, so the previous entries' results stand), but it means the **single-head conclusion should be
  confirmed with `alembic heads`** before the first deploy.
- **Nothing was deployed, built, migrated or started.** Every statement is derived from reading the
  repository. Live verification of the deployment procedure is inherently a deploy-time activity.
- **No browser verification, and none applicable** — 9F adds no UI and changes no component.
- **The multi-tenancy verification gap persists** (`SECURITY_REVIEW.md` §6/§3.5) and is carried forward
  unchanged. Irrelevant to V1's `tenancy: single` deployment, but it means the multi-tenant cookie-domain
  reasoning in the F3 analysis is analytical, not tested.
- **Inherited LOW findings deliberately not fixed** and cross-referenced instead of silently repaired:
  §30 `Permissions-Policy`, §34 API/all-in-one image runs as root, §35 workflow `permissions:` (partially
  stale), §15 `remotePatterns: '**'`.

### Documentation

`docs/DEPLOYMENT_PLAN.md` (new), `docs/ROADMAP.md` (Phase 9 final item marked complete), and this entry.
`docs/ARCHITECTURE.md` **not** updated — 9F introduces no new architectural decision, API boundary, data
model, security pattern or reusable convention; it documents the deployment of what already exists.
`docs/SECURITY_REVIEW.md` **not** modified — §11 / §54.9 stay DEFERRED, and the F3 decision above records
*why* the registration recommendation in that file is superseded rather than editing the security review
from a planning pass.

### Git

No commit, no push. Working tree left as-is.

### Phase 9 status

**Phase 9 V1 Hardening is complete: 9A–9F all closed.** The two remaining `docs/SECURITY_REVIEW.md`
DEFERRED rows (§11, §54.9) are the single F3 root cause, now decided rather than open. Before a first
production deploy, two **deployment decisions** are outstanding and are the user's to make: the container
registry pin (§12.4 — blocker) and the content-volume backup approach (§9.2).

- **Next**: no Phase 9 increment remains. The next smallest recommended increment is the queued
  **CSRF middleware registration** increment (`docs/DEPLOYMENT_PLAN.md` §15.6 — the `app.py` one-liner
  plus its six prerequisites, chiefly the `conftest.py` default-`Origin` fixture). Not started; do not
  begin automatically.

---

## Deployment — LearnOrbit GHCR Image Publishing (2026-08-25)

Resolves the Phase 9F container-registry blocker on the **publishing** side: LearnOrbit release images now
have a coordinate of their own. Full rationale and the option analysis live in `docs/DEPLOYMENT_PLAN.md`
§12.4 and are not repeated here.

### Completed

- **Image coordinate re-pointed.** `release.yaml` derives `IMAGE_NAME` from `github.repository` instead of a
  hardcoded upstream path, so it can only ever resolve to a namespace this repository's own token may write
  — `ghcr.io/williammuigai612-cell/learnorbit`.
- **Release tag namespace `lo-X.Y.Z`.** Trigger narrowed to the `lo-[0-9]*` tag glob only — no branch, no
  pull_request, no workflow_dispatch. The version step strips the prefix, so `lo-1.0.0` publishes `:1.0.0`;
  the prefix scopes the git tag and never reaches the image tag.
- **`:latest` no longer published.** One immutable version tag per release. A floating tag moves a
  deployment without anyone choosing to, and would give the CLI's no-version update fallback a live moving
  target.
- **Three inherited upstream triggers disarmed.** `release.yaml` off the `[0-9]*` glob (20 inherited tags
  matched it); `cli-publish.yaml` off `cli-[0-9]*` (13 inherited tags) and onto `workflow_dispatch`; the
  numeric tag trigger removed from `notify-infra.yaml`.
- **`build-community.yaml` given the same derived `IMAGE_NAME`.** It is dormant on this fork (it triggers on
  prod/dev/main while work happens on `learnorbit-v1`), but a push to `dev` would otherwise have aimed a
  LearnOrbit build at the upstream path.
- **Nested `.env` files excluded from the image.** `.dockerignore` now uses `**/.env` and `**/.env.*`. A
  pattern without `**` matches only at the context root, so the previous bare `.env` left `apps/api/.env` —
  which holds `LEARNHOUSE_AUTH_JWT_SECRET_KEY` and the database connection string — to be baked into the
  image at `/app/api/.env` by the stage that copies the API tree wholesale.

Multi-arch builds, buildx push-by-digest with manifest merge, GHA layer caching, `packages: write` and
`GITHUB_TOKEN` auth are all preserved unchanged.

### Files

`.github/workflows/release.yaml`, `.github/workflows/build-community.yaml`,
`.github/workflows/cli-publish.yaml`, `.github/workflows/notify-infra.yaml`, `.dockerignore`.

### Verification

- `.dockerignore` behaviour proved empirically with RED/GREEN Docker builds in an isolated scratch context.
- Trigger globs checked against all 37 inherited tags: none matches `lo-[0-9]*`.
- `git diff --check` clean. **No workflow was executed and no image was built or published.**

### Limitations

- **Nothing has been published.** `origin` is still an empty repository (zero branches, zero tags), so no
  workflow has ever run and no GHCR package exists. The anonymous GHCR probe returns `403 DENIED`, which
  cannot distinguish absent from private.
- **After the first publish the GHCR package is created private** and its visibility must be set once in the
  GitHub package settings.
- **`.github/utils/release.sh` is not usable as-is and was deliberately left untouched** — it creates a bare
  numeric tag (which cannot match `lo-[0-9]*`), pushes `dev` and `main`, prints the upstream docker pull
  line, uses BSD-style in-place sed, and calls `gh`. Out of scope for this increment.

### Documentation

`docs/DEPLOYMENT_PLAN.md` §12.4 rewritten from "Blocker to resolve" to "The LearnOrbit image — resolved";
§13.1, §13.2 and §16 retargeted to the new coordinate.

### Git

No commit, no push, no tag.

---

## Deployment — Deployment-Aware Application Image (appImage) (2026-08-25)

The application image is now a property of the **deployment**, not a hardcoded property of the CLI.

### Completed

- **Optional `appImage` (repository, no tag) in `learnhouse.config.json`**, written only when a deployment
  pins its own image, so a default install still produces exactly the file it always did.
- **`npx learnhouse setup --image <ref>`** accepting `ghcr.io/owner/name` or `ghcr.io/owner/name:tag`. The
  repository half is persisted; the tag half pins the generated `docker-compose.yml`. The value is written
  verbatim into compose, so it is validated by `validateImageReference` first — unchecked whitespace could
  inject YAML.
- **`update` derives the repository from `appImage`** and makes no registry probe for it. The previous
  resolver only knew the upstream repository and would either 404 a valid version or hand back the upstream
  image.
- **Silent image mismatch eliminated.** `update` now fails closed **before the backup** — no pull, no
  restart, no migration — when the compose file does not reference the configured repository.
- **`compose-utils.ts` parameterised by repository**: `DEFAULT_APP_IMAGE_REPOSITORY`,
  `findComposeImageForRepository`, `splitImageReference`, `ComposeImageMismatchError`.
- **Backward compatible**: a config without `appImage` behaves exactly as before.

### Files

`apps/cli/src/commands/setup.ts`, `apps/cli/src/commands/update.ts`,
`apps/cli/src/services/compose-utils.ts`, `apps/cli/src/services/config-store.ts`, `apps/cli/src/types.ts`,
`apps/cli/src/utils/validators.ts`, `apps/cli/bin/learnhouse.ts`, plus the CLI test suites.

### Verification

`bun run test` in `apps/cli`: **634/634 passing**, including 17 new tests covering the flag, the persisted
config shape, compose pinning, the mismatch failure and the legacy no-`appImage` path.

### Limitations

Not exercised against a live registry — no image has been published yet, so pull/update behaviour is
verified only against the local compose and config surfaces.

### Git

No commit, no push, no tag.

---

## Deployment — CLI Deployment-Image Security Fixes (2026-08-25)

Security review of the `appImage` increment above found two blockers and four lower-severity issues; all six
are fixed.

### Completed

- **HIGH-1 — unanchored compose matching (blocker).** The image-line pattern could match inside a comment or
  an embedded string, so a commented-out `image:` line could be rewritten, and the guard and the rewrite
  could disagree about which line they were looking at. Both now share one anchored pattern matching
  horizontal whitespace only, and the rewrite replaces the reference alone, so indentation and trailing
  comments survive.
- **HIGH-2 — unvalidated `--to` version (blocker).** The custom-version path skipped the registry lookup
  that had incidentally rejected junk, so a version carrying a newline was spliced into `docker-compose.yml`
  as attacker-chosen YAML (an `entrypoint:` override) that would run on the next `up`. `validateImageTag`
  now runs before the backup, and therefore before any write, pull, restart or migration.
- **MEDIUM-4 — digest-pinned images refused, not silently retagged.** Dropping a digest discards a
  supply-chain control.
- **LOW-5 — interactive Enterprise.** `--image` combined with Enterprise chosen at the prompt now fails
  loudly instead of discarding the flag.
- **LOW-6 — version prefix.** `lo-` and `v` are each stripped exactly once and the result validated, so
  `lo-lo-1.0.0` cannot become a `lo-` image tag.

### Files

`apps/cli/src/commands/update.ts`, `apps/cli/src/services/compose-utils.ts`,
`apps/cli/src/utils/validators.ts`, and the CLI test suites.

### Verification

- `bun run test` in `apps/cli`: **668/668 passing** (15 files, 86.12s), up from 634, zero regressions.
- **34 new tests**: comment bypass at both helper and command level, embedded strings, sibling services,
  digest refusal, `validateImageTag` and version-prefix tables, a ReDoS case, and a `fetch` spy proving the
  pinned path makes no registry request.
- All eight original attack probes re-run and **CLOSED**.
- `tsc --noEmit` output byte-identical to the pre-fix run; `git diff --check` exit 0.

### Limitations — open findings, deliberately out of the fix scope

- **MEDIUM-3**: `config.appImage` is not re-validated on read. Bounded — the guard requires the compose to
  already contain the value, and the value is regex-escaped.
- **LOW-7**: `splitImageReference` mis-parses digests (unreachable given the MEDIUM-4 refusal).
- **LOW-8**: no repository length bound.
- Quoted image values (`image: "repo:tag"`) now fail closed — deliberate.
- The upstream `--to` path remains unvalidated, protected only by the registry 404.

### Git

No commit, no push, no tag. Nothing published.

- **Next**: commit this deployment/image milestone, push `learnorbit-v1` to the currently empty `origin`,
  then create the first `lo-<version>` tag to exercise the GHCR publish and verify the resulting image. The
  queued **CSRF middleware registration** increment (`docs/DEPLOYMENT_PLAN.md` §15.6) remains the next code
  increment. Do not begin either automatically.

---

## Deployment — CLI `update` retag-before-pull fix (2026-08-25)

Confirmed production bug in `update --to <version>` on an installation with a custom `appImage`: the
compose file was rewritten to the requested tag *before* anything checked the tag could be pulled. A
nonexistent tag failed at `docker compose pull`, the command exited 1 — and left `docker-compose.yml`
pinned to an image that does not exist, so the next `up` had nothing to start.

### Completed

- **Resolve before rewrite.** The deployment-pinned path now pulls `<appImage>:<targetVersion|latest>`
  in a pre-flight step that runs before the backup, the Alembic baseline stamp, the compose rewrite, the
  restart and the migrations. A tag that cannot be pulled exits 1 with the install untouched. The pull is
  the same fetch `docker compose pull` performs later, moved to where it is still undoable — no HTTP
  registry probe was added to the CLI itself, so the custom path still issues no `fetch` of its own (the
  upstream path's `resolveTag` lookup is unchanged). The `docker pull` does contact the registry, as
  `docker compose pull` already did — what changed is when, not whether.
- The composed reference is vetted with the existing `validateImageReference` before it reaches a shell.
- `--to`, `--migrate`/`--no-migrate`, `--no-backup`, digest refusal, the mismatch fail-closed guard
  and the upstream warn arm are all unchanged.

### Files

`apps/cli/src/commands/update.ts` (pre-flight resolve; target image reused instead of recomputed),
`apps/cli/src/services/docker.ts` (new `dockerPullImage`), `apps/cli/tests/update-migration.test.ts`
(4 new tests).

### Verification

- `apps/cli` normal suite (`tsup` build + the 15 files `bun run test` runs): **672/672 passing**, 15
  files — 668 pre-existing plus the 4 new, zero regressions.
- **RED proven**: with the pre-flight pull commented out, "leaves docker-compose.yml byte-identical after
  that failure" fails with the compose left on `0.0.0-nonexistent`; restored, it passes.
- New tests: nonexistent custom-image version exits 1; compose byte-identical after that failure; no
  compose pull/up/down and no alembic after it; a valid custom-image update still rewrites the tag and
  restarts.
- `git diff --check` exit 0.

### Limitations

- Not exercised against a live Docker daemon or registry; the failure is simulated at the `execSync`
  boundary (both `docker pull repo:tag` and the `docker compose pull` that resolves the compose file).
- `tsc --noEmit` in `apps/cli` is pre-existing noise in this environment (`@types/node` unresolved —
  TS2591 across untouched files); the changed files add no new diagnostics.
- The upstream (non-`appImage`) path is untouched: it still relies on its GHCR manifest lookup.

### Git

No commit, no push, no tag. Nothing published.

- **Next**: unchanged — commit the deployment/image milestone and push `learnorbit-v1`, with the queued
  **CSRF middleware registration** increment (`docs/DEPLOYMENT_PLAN.md` §15.6) as the next code increment.
  Do not begin either automatically.

---

## Deployment — deterministic LearnOrbit image resolution (2026-08-26)

The two blockers the read-only release preflight found, either of which would have left a published
`lo-1.0.0` unreachable from the CLI: `resolveAppImage()` still asked
`api.github.com/repos/learnhouse/learnhouse/releases` which version a LearnOrbit deployment should run,
and every default path fell back to `…/learnorbit:latest` — a tag `release.yaml` deliberately never
publishes.

### The version this pins, and why

`APP_IMAGE_VERSION = '1.0.0'` (`apps/cli/src/constants.ts`) is the **application image** release line,
deliberately neither of the two version numbers already in the repo:

| Version | What it is | Release line |
|---|---|---|
| `1.5.1` — `apps/cli/package.json`, `VERSION` | this CLI's npm version | inherited `cli-*` tags |
| `1.3.4` — `apps/web`, `apps/collab`, `apps/api` | inherited upstream application version | inherited `[0-9]*` tags |
| **`1.0.0`** — `APP_IMAGE_VERSION` | **the image LearnOrbit publishes** | **`lo-[0-9]*` tags** |

Not ambiguous and not invented here: §12.4 of `docs/DEPLOYMENT_PLAN.md` already records the decision —
release tags are `lo-X.Y.Z` starting at `lo-1.0.0`, image tags are plain semver, `:latest` is never
published. `release.yaml` derives the image tag from the git tag alone and reads no version file, so
nothing in the repo can supply this number; it has to be stated once, and this is where.

### Completed

- **No upstream release discovery on any production path.** `resolveAppImage()` is now a pure mapping —
  `dev` → `DEV_IMAGE`, `stable` → `APP_IMAGE` — with no `fetch` at all. The GitHub releases request, the
  GHCR token request and the manifest probe are gone; `isLatest` is kept in the returned shape (callers
  destructure it) but can no longer be true.
- **No production path produces `learnorbit:latest`.** `APP_IMAGE` is now
  `…/learnorbit:${APP_IMAGE_VERSION}`; `setup --image <this repo>` with no tag pins that version instead
  of `:latest`; `update` with no `--to` targets it on both the default and the deployment-pinned path.
- **Third-party registries are untouched.** `--image ghcr.io/acme/fork` with no tag still falls back to
  `:latest` and still warns — only this project's own repository is known not to publish one.
- **The pre-flight pull safety fix is intact.** `--to`, `--migrate`/`--no-migrate`, `--no-backup`, digest
  refusal, the repository-mismatch fail-closed guard, and "a failed pull leaves docker-compose.yml
  unchanged" are all unchanged and still covered.
- `checkForUpdates()` is untouched: it checks the npm registry for this CLI's own package, which is not
  image resolution.

### Files

`apps/cli/src/constants.ts` (`APP_IMAGE_VERSION`, `APP_IMAGE` derived from it),
`apps/cli/src/services/version-check.ts` (`resolveAppImage` offline; upstream lookup deleted),
`apps/cli/src/commands/setup.ts` (`resolveDeploymentImage` fallback tag),
`apps/cli/src/commands/update.ts` (custom-path fallback tag; no-`--to` target),
`apps/cli/tests/unit.test.ts`, `apps/cli/tests/setup-ci-port.test.ts`,
`apps/cli/tests/commands.test.ts`, `apps/cli/tests/update-migration.test.ts`,
`docs/DEPLOYMENT_PLAN.md` §12.4, `docs/PROGRESS.md`.

### Verification

- `apps/cli` normal suite (`tsup` build + the 15 files `bun run test` runs): **675/675 passing**, 15
  files (672 before, +3 net new).
- **RED proven before implementing**: the new expectations failed 7/7 against the old resolution —
  `resolveAppImage('stable')` returned `…:latest`, `setup --image <repo>` wrote `…:latest`, and `update`
  with no `--to` wrote `…:latest`.
- New/updated tests prove: no `learnhouse/learnhouse` request (and in fact no `fetch`) on either channel;
  the stable channel resolves to a concrete `X.Y.Z`; no channel and no default path yields `:latest`;
  `--image` on a third-party repository still defaults to `:latest`; the compose template pins a version.
- `apps/cli/tests/integration.test.ts` **not modified** — Section 2 still pins
  `ghcr.io/learnhouse/app:1.0.1` upgrading to `1.3.4`, deliberately exercising upstream compatibility.
- `git diff --check` exit 0.

### Limitations

- **The tag must now be published.** With `APP_IMAGE_VERSION = 1.0.0`, a fresh `setup` writes
  `…/learnorbit:1.0.0`; until `lo-1.0.0` is pushed and `release.yaml` publishes that image, the pull
  fails. This change makes the release meaningful — it does not perform it. Nothing was tagged,
  published or deployed.
- **Live integration suite deliberately not run.** Its Section 1 failure on CI was
  `…/learnorbit:latest` not existing; pinning `:1.0.0`, which is also unpublished, cannot make it pass,
  so running it would only reproduce the same registry `denied`. It becomes meaningful after the first
  image is published.
- `tsc --noEmit` in `apps/cli` remains pre-existing noise in this environment (`@types/node`
  unresolved — TS2591 is 900 of 1028 diagnostics, spread across untouched files). No new diagnostic
  appears in the changed regions. It is not a configured gate (§11.2).
- `checkForUpdates()` and `apps/cli/package.json` still carry upstream's npm package name
  (`learnhouse`). Out of scope here — `cli-publish.yaml` is `workflow_dispatch`-only, so nothing can
  publish to it — but it is the remaining upstream coordinate in the CLI.

### Git

No commit, no push, no tag. Nothing published or deployed.

- **Next**: create and push the `lo-1.0.0` release tag (a user action — commands are in the preflight
  report), then the queued **CSRF middleware registration** increment (`docs/DEPLOYMENT_PLAN.md` §15.6).

---

## Deployment — `lo-1.0.0` release build failure: Bun base image pinned (2026-08-26)

The first release tag `lo-1.0.0` (→ `da277266`) triggered `release.yaml`; both build jobs failed at
"Build and push by digest" and the manifest/announce jobs were skipped, so **no image was published**.

### Cause

`Dockerfile` used the floating `oven/bun:1-alpine`, which now resolves to Bun **1.4.0**, while the
repository pins Bun **1.3.14** (`.bun-version`, `apps/web` and `apps/collab` `packageManager`) and
`apps/web/bun.lock` was written by 1.3.14. Bun 1.4.0 rejected it:

```
error: lockfile had changes, but lockfile is frozen
note: overrides in package.json changed since bun.lock was saved
```

Nothing in the repository was actually out of sync — `apps/web/package.json` and `apps/web/bun.lock`
carry the same 15 `overrides` entries with the same values, differing only in key order. 1.4.0 simply
wants the lockfile rewritten in its own format. `collab-builder` passed the same step because
`apps/collab/package.json` declares no `overrides` at all. The trigger was time (the upstream image
moving), not a repository change: the failing stages copy `apps/web`, `apps/collab` and `apps/api`, none
of which `da277266` touched.

### Completed

- Pinned all three Bun base images in the root `Dockerfile` to `oven/bun:1.3.14-alpine`
  (`frontend-deps`, `frontend-builder`, `collab-builder`) — the toolchain version the lockfiles were
  written for. The lockfiles were **not** regenerated and Bun was **not** upgraded.

### Files

`Dockerfile` (3 `FROM` lines), `docs/PROGRESS.md`.

### Verification

- `oven/bun:1.3.14-alpine` exists on Docker Hub for **both** `linux/amd64` and `linux/arm64`, which the
  multi-arch release requires.
- `docker run --rm oven/bun:1.3.14-alpine bun --version` → `1.3.14`.
- `docker build --target frontend-deps .` — the stage that failed in CI — now gets **past** the frozen
  lockfile check (`bun install v1.3.14`, no "lockfile is frozen" error).
- `docker build --target collab-builder .` → **succeeds** end to end.
- `git diff --check` exit 0.

### Limitations

- **The `frontend-deps` stage was not built to completion locally.** Both attempts cleared the frozen
  lockfile check and then failed while unpacking a dependency — `Fail extracting tarball for
  "pdfjs-dist"` on the first run, `"next"` on the second, each after ~280s, with 941 GB free. A
  different package each time points at this WSL Docker environment (extraction/network), not at the
  repository; the defect this change fixes is the lockfile rejection, which no longer occurs. Full
  confirmation comes from CI on the next release build.
- The same floating `oven/bun:1-alpine` remains in `apps/collab/Dockerfile`, `apps/web/Dockerfile` and
  the generated `apps/web/.next/standalone/Dockerfile`. None is built by `release.yaml`; left untouched
  as out of scope, but they carry the identical drift.
- The runtime stage still installs Bun via `curl https://bun.sh/install` (unpinned, so 1.4.0) for the
  collab `bun install --production`. That call does not use `--frozen-lockfile` and `apps/collab` has no
  `overrides`, so it is not affected by this failure mode — but it is unpinned.
- `lo-1.0.0` was **not** deleted, moved or force-updated, and no replacement tag was created. The tag
  still points at `da277266`, whose tree cannot build; publishing `:1.0.0` will need a decision about
  that tag.

### Git

Committed on `learnorbit-v1`. No tag created, moved or deleted. Nothing published or deployed.

- **Next**: decide how to re-release — either move/replace `lo-1.0.0` (it is unpublished, so nothing
  downstream depends on it) or cut the next `lo-` tag from the fixed commit.

---

## Deployment — LearnOrbit image target moved to 1.0.1 (2026-08-26)

`lo-1.0.0` exists remotely but points at `da277266`, whose tree cannot build (the Bun base image drift
fixed in `63053bd4`). That tag is not being deleted, moved or recreated, and `:1.0.0` was never
published — so the next publishable image is `…/learnorbit:1.0.1`, and the CLI has to target it before
`lo-1.0.1` is cut.

### Completed

- `APP_IMAGE_VERSION` `1.0.0` → **`1.0.1`** in `apps/cli/src/constants.ts`. `APP_IMAGE` derives from it,
  so `setup` (default and `--image <this repo>` with no tag) and `update` (no `--to`, both the default
  and deployment-pinned paths) now resolve `ghcr.io/williammuigai612-cell/learnorbit:1.0.1`.
- **No test changes were needed.** Every assertion on the default version interpolates
  `APP_IMAGE_VERSION` rather than hardcoding it (`unit.test.ts` 111/1875, `commands.test.ts` 2610,
  `setup-ci-port.test.ts` 113/133, `update-migration.test.ts` 172), so they followed the bump on their
  own. The remaining literal `1.0.0` strings in the suite are fixture tags — custom `--image` pins,
  compose fixtures, validator inputs — and are deliberately unchanged.
- `docs/DEPLOYMENT_PLAN.md` §12.4: the concrete `setup --image …:1.0.0` example now reads `:1.0.1`. The
  `lo-X.Y.Z` → `:X.Y.Z` scheme illustrations elsewhere are generic and untouched.

### Files

`apps/cli/src/constants.ts`, `docs/DEPLOYMENT_PLAN.md`, `docs/PROGRESS.md`.

### Verification

- `apps/cli` normal suite (`tsup` build + the 15 files `bun run test` runs): **675/675 passing**, 15
  files.
- `git diff --check` exit 0; `git diff --summary` empty (no mode changes).
- Unchanged, as required: CLI `VERSION` 1.5.1, web/collab/api 1.3.4, `.bun-version`, `packageManager`
  fields, every `bun.lock`, `release.yaml`, and `integration.test.ts`'s upstream coordinates
  (`ghcr.io/learnhouse/app:1.0.1` → `1.3.4`).

### Limitations

- `:1.0.1` does not exist yet — the tag `lo-1.0.1` has **not** been created. Until it is pushed and
  `release.yaml` publishes the image, a fresh `setup` writes a compose that cannot be pulled.
- `lo-1.0.0` remains exactly as it was: same tag object, same target commit, still unpublished.

### Git

Committed and pushed on `learnorbit-v1`. No tag created, moved or deleted. Nothing published or
deployed.

- **Next**: create and push `lo-1.0.1` from this commit, then watch the release workflow.

---

## Deployment — `lo-1.0.1` published and verified end to end (2026-08-26)

The first LearnOrbit production image is live. `ghcr.io/williammuigai612-cell/learnorbit:1.0.1` exists,
is publicly pullable, and a real CLI install runs on it.

### The release

- **Tag `lo-1.0.1`** (annotated, object `515ca0f5dab517cc066ddac4afd4ed3297590abf`) → commit
  `6cb08b116cbcb8f579901e1aa602a18ff89a0b1a` *fix(cli): target LearnOrbit image 1.0.1*. Pushed as a
  single ref; `git push --tags` was never used.
- **Release workflow run `32944722191`: success** in ~8 minutes — `Build (linux/amd64)` ✅,
  `Build (linux/arm64)` ✅, `Create release and push manifest` ✅, `Announce release` ✅. The
  `frontend-deps` stage that killed `lo-1.0.0` at 25 seconds passed cleanly, confirming the Bun base-image
  pin in `63053bd4`.
- **Published image** — one immutable tag, exactly as §12.4 specifies:

  | | |
  |---|---|
  | Coordinate | `ghcr.io/williammuigai612-cell/learnorbit:1.0.1` |
  | Media type | `application/vnd.oci.image.index.v1+json` (manifest list) |
  | `linux/amd64` | `sha256:1e0cbcd9d1514212f1737360c81547ef9718df75803665d4efa4871614da7f68` |
  | `linux/arm64` | `sha256:0022557db106397c37fccf2232c3f2ded7623b89d97833b6c011ecebbb5ab0a3` |
  | List digest | `sha256:7e565b078bc1c12989658bf1a6e675d69411fed4f62b062d96d04773c558732e` |

- **Verified independently of the workflow**, by anonymous registry probe (no credentials): `:1.0.1` →
  **HTTP 200**; `:latest` → **404** (deliberately never published); `:1.0.0` → **404** (the failed release
  published nothing, confirmed).
- **`lo-1.0.0` was left exactly as it was** — same tag object, same target `da277266`, still unpublished.
  Not deleted, moved, force-updated or recreated.

### Verification — live integration suite

Three runs, all on `6cb08b11` with nothing modified:

| Run | Result |
|---|---|
| Full suite, first attempt | ❌ 8 passed / 54 skipped, 944 s |
| **Section 1 only** (`-t "live install"`), image cached | ✅ **39 passed / 0 failed**, 157 s |
| **Section 2 only** (`-t "upgrade \(old"`), images cached | ✅ **15 passed / 0 failed**, 428 s |

**Section 1 — LearnOrbit 1.0.1 install.** All five containers healthy **36 s** after start (db+redis at
21 s), `acme` org seeded, and `docker-compose.yml` pinned `ghcr.io/williammuigai612-cell/learnorbit:` as
asserted at `integration.test.ts:97`. Covered: `setup --ci` file generation, all six input-validation
error paths, `status`, `health`, `doctor`, `logs`, `env`, two `backup` archives with real `pg_dump`,
four `restore` cases (including corrupt-archive safety), two `stop`/`start` cycles, and admin
authentication against the `acme` org.

**Section 2 — upstream compatibility, untouched coordinates.** `ghcr.io/learnhouse/app:1.0.1` healthy in
**44 s**; `update --migrate` exits 0; the compose no longer pins the old image and **the running
container actually moved to 1.3.4** (the LEA-47 surface — retag without pull — still holds); **alembic at
head** after the full migration delta, data intact; `--no-migrate` skips alembic and prints instructions;
`--version` stays swallowed by the global flag; a plain `update` writes a pre-upgrade backup; `doctor`
all green; `stop`/`start` keeps the new image.

### The first-run failure — diagnosed, no code change warranted

The full-suite attempt failed in both live sections, and neither failure reproduced in isolation:

- **Section 1** — `beforeAll` hit its 600 s budget while pulling the 1.89 GB image for the first time.
  With the image cached the same phase takes 36 s.
- **Section 2** — the app was marked `unhealthy` and `docker compose up -d --wait` (`helpers.ts:75`) tore
  the stack down. Run alone, the same image is healthy in 44 s; booted standalone outside vitest, in 25 s.

The healthcheck is **not in either image** (`Config.Healthcheck: null` on both) — it comes from the CLI's
compose template (`src/templates/docker-compose.ts:164`): `curl -f http://localhost/api/v1/health`,
`interval 30s`, `retries 3`, `start_period 60s`. `curl` is present in the old image. A standalone boot
shows four probes returning `502` while nginx is up before uvicorn, then `exit=0` at +25 s — ordinary
warm-up. Under the contention of a concurrent multi-GB pull the API simply did not answer inside
`start_period`.

**Classification: environment/timing in the combined run — not the upstream image, not a LearnOrbit
regression, and not a defect in the test.** Loosening a production healthcheck to suit a loaded CI box
would be the wrong trade, so nothing was changed.

### Verification commands

```
node_modules/.bin/vitest run tests/integration.test.ts -t "live install"
node_modules/.bin/vitest run tests/integration.test.ts -t "upgrade \(old"
```

`-t` is a **regex**: an unescaped `-t "upgrade (old"` fails instantly with
`Invalid regular expression: Unterminated group` before Docker is touched.

### Limitations

- A full `test:integration` on a slow or loaded machine can still exceed `start_period: 60s`. Pre-pull the
  images or run the sections separately; CI budgets 45 minutes for the job.
- ~~`--to with a nonexistent version fails clearly without touching the install` passes locally but
  failed in CI…~~ **RESOLVED (fe24e355).** The cause was as suspected: the assertion matched
  `'not found'`, which comes from *docker's* error text, and that differs by daemon/registry version —
  locally `manifest tagged "..." not found`, in Actions `manifest unknown`. The CLI behaved identically in
  both. The test now asserts only text this project controls (`/refusing to update/i`) plus the guarantee
  its own name makes and previously never checked: the compose file is byte-identical afterwards, does not
  contain the bad tag, and the running container's image is unchanged. Verified green in **CI run
  `32957679321`** — Unit Tests **681/681**, Integration Tests **62/62**, including that test.
- `cli-tests.yaml` has a `paths:` filter but no ref filter, so pushing a `lo-` tag also starts a CLI Tests
  run. It publishes nothing.
- Section 3 was not re-run after the full-suite attempt, where it passed 8/8.

### Git

Committed on `learnorbit-v1` as *docs: record lo-1.0.1 release verification*. Tags `lo-1.0.0` and
`lo-1.0.1` are unchanged locally and on origin; nothing was published manually.

- **Next**: `APP_IMAGE_VERSION` and the published image now agree at 1.0.1, so the deployment path is
  usable end to end. The queued code increment is **CSRF middleware registration**
  (`docs/DEPLOYMENT_PLAN.md` §15.6).

---

## CSRF middleware registration — read-only preflight (2026-08-26)

No code written. This is the analysis that must precede the queued increment
(`docs/DEPLOYMENT_PLAN.md` §15.6). It **corrects two prerequisites in §15 that are factually wrong**, and
finds a breaking path §15 missed that is large enough to change the shape of the increment.

### Confirmed as documented

- **Registration point.** `apps/api/app.py:131-137` — `configure_cors(app)`, `SelectiveGZipMiddleware`,
  `register_ee_middlewares(app)` (a no-op here: `apps/api/ee` does not exist in this checkout).
- **The middleware is complete and unregistered.** `src/security/csrf.py` validates `Origin` (falling back
  to `Referer`) on `POST/PUT/DELETE/PATCH`, 403s otherwise, with a verified-custom-domain DB fallback.
  Exempt: `Bearer lh_*`, `stripe-signature`, `x-internal-key`, `x-platform-key`. Plain `Bearer <jwt>` is
  deliberately **not** exempt, because `extract_jwt_from_request` (`security/auth.py:85`) falls back to the
  `LH_access` cookie — so exempting it would let a junk Bearer header bypass CSRF while the victim's cookie
  did the real authentication.
- **Cookies are genuinely in play**, so CSRF is a real (defence-in-depth) gap: the browser client sends
  `credentials: 'include'` on every request.
- **The catch-all still makes it inert.** `config.yaml:44` ships
  `\b((?:https?://)[^\s/$.?#].[^\s]*)\b`, which `fullmatch`es any well-formed origin;
  `allowed_origins` is empty; `development_mode: false`. Registering without scoping protects nothing.
- **No new dependency** — Starlette `BaseHTTPMiddleware`, already present.

### Correction 1 — the test-suite prerequisite does not exist

§15.3 predicts "near-total suite failure" from 475 mutation calls and §15.6 item 2 makes a `conftest.py`
`Origin` fixture a prerequisite. Both are wrong.

**Zero test files import the real `app.py`**; there is no `TestClient(` anywhere in `apps/api/src/tests`.
64 files build their own bare `FastAPI()` and mount only the routers under test, driven through
`httpx.ASGITransport`. None of the 507 mutation calls traverses `app.py`'s middleware stack, so
registration cannot break them.

The flip side is the real prerequisite: **there is no app-level coverage of the middleware stack at all.**
`src/tests/security/test_csrf.py` has 36 tests, every one against a bare `CSRFProtectionMiddleware(MagicMock())`.
`test_email_origin_and_smtp_tls.py:235` is the ASGITransport pattern to copy.

### Correction 2 — `allowed_regexp` does not scope CORS in V1

§15.5 states that scoping `LEARNHOUSE_ALLOWED_REGEXP` is highest-value because it scopes CORS, email links
*and* CSRF. Under `tenancy: single` — the V1 deployment — it does **not** touch CORS.
`get_cors_origin_regex()` (`core/middleware/cors.py`) builds its regex from `frontend_domain`/`domain` plus
localhost and only reads `allowed_regexp` in `multi` mode. CORS is already scoped; the config change buys
CSRF and email links.

### Correction 3 — four breaking callers, not one

§15.6 item 5 pointed at `app/api/billing/*` and `app/api/loops/*`. Neither issues a non-GET to the API. A
full sweep of `apps/web` (168 files referencing an API base URL, classified by
`getAPIUrl()` browser vs `getServerAPIUrl()` server, following `RequestBodyWithAuthHeader` /
`platformHeaders` to the real request) found:

| Caller | Method(s) | Why it 403s | Severity |
|---|---|---|---|
| **`app/api/auth/[...path]/route.ts`** | POST/PUT/PATCH/DELETE | Builds headers from scratch (`:144`), forwarding only `x-forwarded-for`, `x-real-ip`, `user-agent`, `Content-Type`, `Authorization`, `Cookie`. **Origin/Referer never forwarded** | **Critical — breaks `POST /auth/login` and `/auth/refresh`; authentication stops working** |
| `app/api/auth/[...path]/route.ts:219` | DELETE `/auth/logout` | Only a `Cookie` header | **Silent** — `.catch(() => null)` means logout still "succeeds" while server-side session revocation stops; revoked tokens live to expiry |
| `services/payments/*` (4 files, **19 calls**) | POST/PUT/DELETE | `'use server'` actions; `RequestBodyWithAuthHeader` sets only `Content-Type` + `Authorization: Bearer <jwt>`, which is not exempt | High |
| `app/api/signup/route.ts:130` | POST | Only `Content-Type` | High — account creation |

Safe, verified: every `services/**` module using `getAPIUrl()` (~50 files with non-GET verbs) runs in the
browser via `'use client'` importers and carries a real `Origin`; `services/billing/packs.ts` (×4) is
exempt via `x-platform-key`; `services/billing/orgPlan.ts:31` via `X-Internal-Key`; the
`/api/v1/[...path]` proxy forwards all non-hop-by-hop headers; collab uses `X-Internal-Key`; Stripe uses
`stripe-signature`; `lib/turnstile.ts` targets Cloudflare, not the API.

### Ordering note not in §15

Starlette's `add_middleware` **prepends**, so the last-registered middleware is the **outermost**.
Registering CSRF after `configure_cors` puts it outside CORS, so a rejected cross-origin POST returns 403
**without** CORS headers and the browser reports an opaque CORS error rather than a readable 403. Only
affects error legibility, but it should be a decision, not an accident. Not verified empirically — worth
one assertion in the new tests.

### Revised scope for the increment

1. Register the middleware in `app.py`.
2. **Forward `Origin` in the auth proxy** (`route.ts:171` and the logout path at `:219`) — without this,
   login breaks. This is the item that must not be missed.
3. Fix `app/api/signup/route.ts:130`.
4. Give `services/payments/*` a **server-side-only** header helper. Do *not* add `Origin` to
   `RequestBodyWithAuthHeader` — it is shared with browser code, where `Origin` is a forbidden header name
   that fetch silently drops.
5. Scope `LEARNHOUSE_ALLOWED_REGEXP` / `LEARNHOUSE_ALLOWED_ORIGINS`, and add a startup guard that logs
   `CRITICAL` when `development_mode` is false and the regexp is the catch-all — reuse
   `_is_scoped_origin_regexp` (`services/email/utils.py:48`). The CLI's `env.ts` emits neither variable.
6. App-level tests (ASGITransport): cross-origin POST → 403, same-origin → pass, no-Origin → 403, GET
   unaffected, `Bearer lh_*` exempt, and the CORS/CSRF wrapping order.
7. Name the behaviour change: registering in `app.py` rather than the EE hook applies CSRF under
   `LEARNHOUSE_SAAS=true`, where `register_ee_middlewares` returns early.

### Limitations

- `docs/DEPLOYMENT_PLAN.md` §15 still contains the two superseded claims (test-suite blocker, CORS
  coupling) and the wrong breaking-caller directories. Left unedited — it should be corrected as part of
  the implementation increment, not by a preflight.
- Not traced end to end: the Google OAuth callback and `login/mfa`, to confirm neither reaches the API
  outside the audited proxy. `apps/e2e` was not audited for direct (non-browser) API calls.
- Node's fetch permits setting `Origin` server-side where browsers forbid it; the payments fix depends on
  that distinction and deserves an explicit test rather than trust in the runtime.
- `apps/api`'s own outbound calls were out of scope.

### Git

No code, config, or workflow changed. No commit for this entry yet; no tag, publish or deploy.

- **Next**: implement the increment with items 1-7 above landing together — item 2 is the one that turns a
  one-line registration into a safe change.

---

## CSRF middleware registration — implemented (2026-08-26)

`CSRFProtectionMiddleware` is registered. The four server-side callers the preflight found are fixed in
the same change, because any one of them left unfixed turns registration into an outage.

### API

- **`apps/api/app.py`** — `app.add_middleware(CSRFProtectionMiddleware)` between `configure_cors(app)` and
  `register_ee_middlewares(app)`. Unconditional, so it applies under `LEARNHOUSE_SAAS=true` too, where
  `register_ee_middlewares` returns early.
- **`apps/api/src/security/csrf.py`** — new `warn_if_origins_unscoped(config=None)`. In non-development
  mode it delegates to `_is_scoped_origin_regexp` (`services/email/utils.py`, imported lazily — that
  module pulls in smtplib/resend and imports back from `csrf`) and logs **CRITICAL** when the configured
  `allowed_regexp` still matches arbitrary hosts. It logs rather than raising: a deployment that inherited
  the catch-all must not be bricked by an upgrade, and 403 on every mutation is the worse failure.

  It is a module-level function called from `app.py`, **not** work inside `__init__` — Starlette builds
  the middleware stack lazily, so a check in `__init__` first runs on the first request, not at startup.
  That is also why the app-level tests hold the config patch across the request, not just registration.

### Web — the callers that would have 403'd

- **`app/api/auth/[...path]/route.ts`** — the proxy builds outbound headers from scratch, so Origin and
  Referer never reached the API: `POST /auth/login` and `/auth/refresh` would have 403'd, i.e. no
  authentication at all. New `ORIGIN_CONTEXT_HEADERS` relays both on the main path and on the logout
  `DELETE` (whose failure was worse for being silent — best-effort, so cookies still cleared and
  server-side revocation just stopped). The caller's own value is relayed, never a synthesised one:
  Origin is browser-set and unspoofable cross-site, which is the only thing that makes the check mean
  anything. A request with neither header is passed through unchanged, so the API still refuses it.
- **`app/api/signup/route.ts`** — same relay on its server-side POST.
- **`services/config/serverOrigin.ts`** (new) — `getServerOrigin()` / `withServerOrigin(init)`, derived
  from the existing `NEXT_PUBLIC_LEARNHOUSE_HTTPS`/`_DOMAIN` config. No new env var, no hardcoded domain.
- **`services/payments/{payments,groups,offers,providers/stripe}.ts`** — all **19** non-GET server-action
  calls wrapped in `withServerOrigin(...)`. `RequestBodyWithAuthHeader` is deliberately **unchanged**: it
  is shared with browser code, where `Origin` is a forbidden header name that fetch silently drops, so
  setting it there would be dead code that reads as protection. `import 'server-only'` makes misuse from
  a client bundle a build error.

### CLI

- **`apps/cli/src/templates/env.ts`** — generated `.env` now sets `LEARNHOUSE_ALLOWED_ORIGINS` (the
  deployment base URL) and `LEARNHOUSE_ALLOWED_REGEXP` (anchored, dots escaped, optional subdomain and
  port), both derived from the operator's configured domain. Without this a generated install inherits
  the catch-all and gets CSRF that accepts every origin. No domain is invented.

### Tests

| Suite | Added | Result |
|---|---|---|
| `apps/api/src/tests/security/test_csrf_app_level.py` (new) | 21 | 57 pass with the 36 existing `test_csrf.py` — none of which was modified |
| `apps/web/tests/csrf-origin-forwarding.test.mjs` (new) | 14 | pass |
| `apps/web/tests/auth-proxy-origin.test.mjs` (new) | 7 | pass |
| `apps/web/tests/signup-origin.test.mjs` (new) | 3 | pass |
| `apps/cli/tests/unit.test.ts` (extended) | 6 | 681/681 pass (was 675) |

App-level coverage: same-origin POST passes, cross-origin 403, no-Origin/Referer 403, Referer fallback,
GET unaffected, `Bearer lh_*` / `x-internal-key` / `x-platform-key` exempt, plain `Bearer <jwt>` **not**
exempt, verified vs unverified custom domain, CORS preflight not blocked, and the ordering contract —
CSRF is outermost, so a rejected cross-origin 403 carries no CORS headers while an allowed origin still
gets them. Plus a source contract on `app.py` (registered, positioned, unconditional, guard called) and on
`services/payments/*` (no unwrapped non-GET call can be added later without failing).

RED was proven before each implementation step: the API tests failed on import (`warn_if_origins_unscoped`
absent) and 8 behavioural assertions failed before registration.

### Verification

- API full suite: **5782 passed, 10 failed, 29 skipped**, coverage 96.47%. The 10 are **pre-existing and
  unrelated** — 9 reproduce when run in isolation, and none of the five files
  (`test_core_events*`, `test_custom_domains_service`, `test_org_invites_service`, `test_podcasts_service`)
  references `csrf`, `app.py` or the new guard. A clean-tree baseline of the *full* suite was not run.
- Web `bun test tests`: **281 pass**. The failing set is **byte-identical with and without the three new
  files** (verified by diffing sorted failure lists) — all pre-existing, in the billing internal-key /
  platformApiKey suites, a missing-module import, and a flaky i18n timeout. `bun test tests` is not run by
  CI (§11.2).
- CLI suite: **681/681**, 15 files.
- `ruff` (pinned 0.15.9) on the three changed Python files: **All checks passed**.
- `bun run lint:strict` on the seven changed web files: **0 errors**, 2 pre-existing `no-console` warnings.
- `git diff --check`: exit 0.

### Limitations

- `tsc --noEmit` was not run on `apps/web` — the repo has no typecheck gate there and carries known
  pre-existing type debt (§11.2). The changed files compile under bun/vitest.
- Not exercised end to end against a live stack: no browser login was performed against a registered
  middleware. The behaviour is covered at the middleware and caller level only.
- The Google OAuth callback and `login/mfa` were not traced end to end to confirm they reach the API only
  through the audited proxy.
- The guard logs CRITICAL; it does not fail startup. A deployment that ignores the log still runs with
  CSRF accepting every origin, with `SameSite=Lax` as the active control (§15.4).

### Git

No commit, no push, no tag, nothing published or deployed.

- **Next**: commit this increment, then a live smoke test of login/signup/logout against a deployment
  running the registered middleware.

## CI — Alembic single-head gate on `api-tests.yaml` (2026-08-26)

The §11.3 preflight listed "no Alembic head check" among the CI gaps blocking a deployment gate (§9F
finding 7). This closes that one gap, in the workflow that already installs the API's dependencies.

### CI

- **`.github/workflows/api-tests.yaml`** — new blocking step **"Check for a single Alembic head"**,
  placed after `Install dependencies` (`uv sync`) and before `Run tests with coverage`, so it reuses the
  already-synced environment: no second `uv sync`, no new workflow, no new dependency. It runs
  `uv run alembic heads` in `apps/api`, echoes the full output under an `Alembic heads:` header, counts
  the `(head)` lines, and fails with a `::error::` annotation when the count is anything other than 1.
  `alembic heads` reads the revision files only — no database is required, which is why the step can sit
  ahead of the test run.

  **No revision id is hardcoded.** The gate is a count, so it catches any future branching rather than
  drift away from one known id. `grep -c` is guarded with `|| true` so a zero-head graph reports its own
  error message instead of tripping the runner's `bash -e` first.

- **Trigger** — `push` now covers `learnorbit-v1` alongside `dev`. Without it the gate would never run on
  the active branch, only on PRs. `paths: apps/api/**` and the `pull_request` trigger are unchanged, as
  is the `concurrency` block (pushes still always finish; only PR runs cancel in progress).

### Files

- **Changed:** `.github/workflows/api-tests.yaml`, `docs/PROGRESS.md` (this entry)
- **No migration, application source, test, release workflow, Docker, tag or deployment file was touched.**

### Verification

- **`uv run alembic heads` in `apps/api`, executed in WSL** → `b7e4f1a92c83 (head)` — **exactly one head**,
  confirming live what §9F could only derive by parsing the revision files (that entry's Limitations asked
  for exactly this check). No database connection was needed.
- **Workflow YAML parsed** (`yaml.safe_load`) → valid; triggers resolve to
  `push.branches = [dev, learnorbit-v1]`, and the step order is `… Install dependencies → Check for a
  single Alembic head → Run tests with coverage → …`. `actionlint` is not installed in this environment.
- **Gate shell logic exercised against synthetic `alembic heads` output**: one head → pass; two heads →
  exit 1 with `found 2`; zero heads → exit 1 with `found 0`; a branch-labelled head
  (`<rev> (mybranch) (head)`) → pass. Same snippet as the workflow, run under `bash -e`.
- **`git diff --check`** → clean.
- Full diff reviewed: **two hunks only** — the added `learnorbit-v1` trigger line and the 15-line step.

### Limitations

- **Not observed running on GitHub Actions** — the gate has not yet executed on a real runner; it is
  verified by local execution of the same command plus simulation of the same shell. First live proof
  comes with the next push touching `apps/api/**`.
- **The API test suite and `ruff` were not re-run** — this increment changes no Python file, so the
  previous entry's results stand.
- No browser verification, and none applicable — CI-only change, no UI.
- **`release.yaml` is deliberately not wired to this gate.** §11.3 keeps that a separate increment; a
  release still does not verify the migration graph.

### Git

No commit, no push, no tag.

- **Next**: wire the single-head check (or a migration smoke test) into `release.yaml`, so a release
  cannot ship a branched migration graph.

## CI — Alembic single-head gate proven on a GitHub runner (2026-08-26)

The gate added in `02c90a48` has now executed on GitHub Actions and passed. This **supersedes the
"Not observed running on GitHub Actions" limitation** in the previous entry.

### What it took to run it at all

`api-tests.yaml` filters **both** `push` and `pull_request` on `paths: apps/api/**`, so the commit that
added the gate — a workflow file and a doc — could not trigger the workflow that contains it, and neither
could a PR. `gh api …/api-tests.yaml/runs` returned `total_count: 0`: **API Tests had never run in this
repository**, on any branch.

- **`.github/workflows/api-tests.yaml`** — added `workflow_dispatch:` to `on:` (commit `ca82a845`). Chosen
  over widening `paths` because it leaves both automatic triggers exactly as they were and makes the gate
  re-provable on demand. Dispatch works here because `learnorbit-v1` *is* the repository default branch;
  on a repo whose default branch lacked the trigger, the same dispatch would 422.

### Verification — run 32980506419 (`workflow_dispatch`, head `ca82a845`)

- **`Check for a single Alembic head` → success.** Step log:
  `Alembic heads:` / `b7e4f1a92c83 (head)`. The step ran under `/usr/bin/bash -e {0}` after
  `Install dependencies` and before `Run tests with coverage`, exactly as placed, with **no database
  available** — confirming the step needs only the revision files.
- **`Run tests with coverage` → success**: `5798 passed, 23 skipped, 201 warnings in 473.66s`;
  `TOTAL 29273 837 97%`; `Required test coverage of 25% reached. Total coverage: 97.14%`.
- Every other step succeeded: checkout, Set up Python (3.14.7), Install uv, Install ffmpeg,
  Install dependencies, Upload coverage report.

### Failure found, pre-existing and unrelated

- **`Upload API coverage to Codecov` → failure**, which makes the overall run red:
  `Token length: 0` → `Upload queued for processing failed: {"message":"Token required - not valid
  tokenless upload"}` → `Failed to run upload-coverage`. **No `CODECOV_TOKEN` secret exists in this fork**
  and the step sets `fail_ci_if_error: true`, so the step fails closed.
- This is inherited configuration this increment did not touch, and it means **API Tests will report
  failure on every run until a token is added** (or `fail_ci_if_error` is relaxed) — the gate and the test
  suite both pass underneath it. **Left unfixed deliberately**: out of this increment's scope.

### Files

- **Changed:** `.github/workflows/api-tests.yaml` (`workflow_dispatch`), `docs/PROGRESS.md` (this entry)
- No migration, application source, test, release workflow, Docker, tag or deployment file was touched.
  Nothing was tagged, published or deployed.

### Git

- `02c90a48` — the gate and the `learnorbit-v1` push trigger.
- `ca82a845` — `workflow_dispatch`, pushed; `origin/learnorbit-v1` matches HEAD.

- **Next**: decide the Codecov token question (add the secret, or stop failing CI on upload error), since
  it currently masks the pass/fail signal of every API Tests run. Then wire the single-head check into
  `release.yaml`.

## CI — Alembic single-head gate on `release.yaml` (2026-08-26)

The previous entry's **Next** item. `api-tests.yaml` gated pushes and PRs, but a release still shipped
without checking the migration graph: a branched graph could reach GHCR and only fail later, when a
deployment ran `alembic upgrade head`. This closes that gap with the same gate, on the release path.

### CI

- **`.github/workflows/release.yaml`** — new **`migrations`** job, placed first in `jobs:`, and
  `needs: migrations` added to **`build`**. The job graph is now
  `migrations → build → release → notify`.

  It is a **separate gating job, not steps inside `build`**. `build` is a two-runner matrix
  (`linux/amd64` + `linux/arm64`) whose first meaningful action already pushes to the registry
  (`push-by-digest=true`), so inlining would have run the gate twice — including a Python/uv install on
  the arm64 runner — and placed it alongside the very publish it is meant to precede. As a `needs:`
  dependency it runs once and blocks **both** matrix legs before any GHCR login or push happens.

- **The gate step is byte-identical to the one proven in `api-tests.yaml`** (run `32980506419`) — same
  `run` block, same `working-directory: apps/api`, same count-based semantics: no revision id is
  hardcoded, and `grep -c` stays guarded with `|| true` so a zero-head graph reports its own error rather
  than tripping the runner's `bash -e`. It was copied, not re-derived.

- Setup steps around it are new only because `release.yaml` had no Python job: checkout, `setup-python@v7`
  (3.14), `setup-uv@v9.0.0` cached on `apps/api/uv.lock`, `uv sync` — the same versions `api-tests.yaml`
  uses. **`ffmpeg` is deliberately omitted**: its comment there scopes it to the video transcode tests,
  and `alembic heads` reads the revision files only. The job carries `permissions: contents: read` so the
  gate does not inherit the workflow-level `packages: write`.

- **Triggers, image naming, GHCR configuration and versioning are untouched.** `on:` remains
  `push.tags: ['lo-[0-9]*']` only; `push-by-digest=true`, the absent `:latest`, and
  `IMAGE_NAME: ${{ github.repository }}` are all unchanged — asserted, not assumed (below).

### Files

- **Changed:** `.github/workflows/release.yaml` (+46 lines, 0 deletions — two hunks: the new job and the
  one `needs:` line), `docs/PROGRESS.md` (this entry)
- **No migration, application source, test, `api-tests.yaml`, Codecov, Docker, release-script, tag or
  deployment file was touched.**

### Verification — local/static only

- **YAML parses** (`yaml.safe_load`) → valid.
- **Job graph asserted programmatically**: `migrations` exists and has no `needs` (runs first);
  `build.needs == migrations`; `release.needs == build`; `notify.needs == release`.
- **Gate equivalence asserted**: the `run` block parsed out of `release.yaml` compares **equal** to the
  one parsed out of `api-tests.yaml` — string comparison, not inspection. `working-directory` matches.
- **Gate placement asserted**: the `migrations` job contains no docker, login, build or push step.
- **Publish surface asserted unchanged**: `push-by-digest=true` present, no `:latest` in the tag
  generator, `IMAGE_NAME` still derived from `github.repository`.
- **Gate logic exercised** with the workflow's exact snippet:

  | Input | Result |
  |---|---|
  | Real `uv run alembic heads` in `apps/api` | `b7e4f1a92c83 (head)` → **exit 0** |
  | Synthetic two heads | exit 1, `found 2` |
  | Synthetic zero heads | exit 1, `found 0` |
  | Synthetic `<rev> (mybranch) (head)` | exit 0 |

  The real run reproduces run `32980506419`'s output exactly, with no database available.
- **`git diff --check`** → exit 0.
- `actionlint` is not installed in this environment and **was not installed**; validation is
  `yaml.safe_load` plus the structural assertions above.

### Limitations

- **Not observed running on GitHub Actions — real-runner verification remains pending.** `release.yaml`
  fires **only** on `push: tags: 'lo-[0-9]*'`; it has no `workflow_dispatch`, and adding one would change
  a release trigger. The only way to execute it is to create a real `lo-X.Y.Z` tag, which would build and
  publish a production image — not a legitimate way to test a gate. First live proof therefore comes with
  the next genuine release tag. The untested surface is the surrounding setup steps, not the gate logic,
  which has already passed on a runner in `api-tests.yaml`.
- **Nothing was tagged, built, published or deployed**, and no image reached GHCR during this increment.
- **The Codecov token question is still open and still separate**: `CODECOV_TOKEN` does not exist in this
  fork and `fail_ci_if_error: true` makes every API Tests run report failure over a passing gate and a
  passing suite. Pre-existing, untouched here, and unrelated to `release.yaml`, which has no Codecov step.
- The gate validates the migration graph of the tagged commit's tree. It does **not** run the API test
  suite on release; a release still ships without executing tests.

### Git

Written before the commit. The increment shipped as `6238721a` — `ci(release): gate releases on a single
Alembic head` (`.github/workflows/release.yaml`, `docs/PROGRESS.md`) — pushed to `origin/learnorbit-v1`.
No tag was created; nothing was built, published or deployed.

- **Next**: decide the Codecov token question, which still masks the pass/fail signal of every API Tests
  run. *Resolved 2026-08-27 — see the next entry.*

## CI — Codecov upload made non-blocking on `api-tests.yaml` (2026-08-27)

The **Next** item carried by the previous two entries, and the last CI cleanup before production
deployment. Since run `32980506419`, API Tests reported red on a fully passing job: the gate passed, the
suite passed, coverage passed, and then the Codecov upload failed closed and took the workflow down with
it. The pass/fail signal of every run was masked by a step that reports nothing about the code.

### CI

- **`.github/workflows/api-tests.yaml`** — `Upload API coverage to Codecov`: `fail_ci_if_error: true` →
  **`false`**. One line. `codecov/codecov-action@v7` and every other input (`files`, `flags`, `name`) are
  unchanged.
- **Decision: no `CODECOV_TOKEN` secret.** For LearnOrbit V1, coverage reporting to a third party is
  informational; the enforced coverage signal is `--cov-fail-under=25` inside `Run tests with coverage`,
  which runs on the runner and still fails the job on its own. Adding a token would introduce an external
  service dependency and a secret to rotate in exchange for a dashboard nobody gates on. The upload is
  left in place, still attempted, and now simply warns when it cannot authenticate — so it starts working
  the day a token is added, with no workflow change.
- The `htmlcov/` artifact upload (`if: always()`) is untouched and remains the way to read coverage detail
  off a run.

### Files

- **Changed:** `.github/workflows/api-tests.yaml` (one line), `docs/PROGRESS.md` (this entry)
- No application source, test, coverage threshold, Alembic gate, migration, `release.yaml`, release script
  or Docker file was touched. Nothing was tagged, published or deployed.

### Verification — run 33099952171 (`workflow_dispatch`, head `9d8fbd7e`)

- **Overall conclusion: success.** Job `test` green in 9m37s; every step reports
  `outcome=success;conclusion=success`.
- **`Check for a single Alembic head` → success**: `Alembic heads:` / `b7e4f1a92c83 (head)` — exactly one.
- **`Run tests with coverage` → success**: `5798 passed, 23 skipped, 201 warnings in 521.61s`;
  `TOTAL 29273 837 97%`; `Required test coverage of 25% reached. Total coverage: 97.14%`;
  `Coverage XML written to file coverage.xml`.
- **`Upload API coverage to Codecov` → the upload still fails, the step does not.** Log still shows
  `Token length: 0` and `Upload queued for processing failed: {"message":"Token required - not valid
  tokenless upload"}`, and the step now ends `outcome=success;conclusion=success`. This is exactly the
  intended behaviour: the failure is visible in the log, and it no longer decides the workflow.
- `api-coverage-report` artifact uploaded as before.
- Local: `git diff --stat` = 1 file, 1 insertion, 1 deletion; `git diff --check` and
  `git diff --cached --check` clean; workflow re-parsed with the WSL Python `yaml` module (already
  installed, nothing added) and the step resolves to
  `{files: apps/api/coverage.xml, flags: api, name: api-coverage, fail_ci_if_error: False}`.

### Limitations

- **The push that made this change could not trigger the workflow it changes.** `api-tests.yaml` still
  filters `push`/`pull_request` on `paths: apps/api/**`, and this commit touches only the workflow file,
  so the run above was raised by `workflow_dispatch` — the trigger added in `ca82a845` for exactly this
  reason. Automatic triggers are unchanged.
- **A first dispatch, `32985141381`, sat `queued` for ~26h without ever being assigned a runner** and
  expired without producing a job. Other workflows ran normally throughout (E2E executed on 2026-08-27),
  and the re-dispatch ran immediately, so this reads as transient GitHub-side queueing, not configuration.
  Worth remembering if a dispatched run appears to hang: cancel and re-dispatch rather than debug.
- **Coverage is no longer reported to Codecov at all** while no token exists — the upload is attempted and
  rejected every run. Nothing in CI depends on it, but the Codecov project will show no data.
- `release.yaml` still has no real-runner proof of its `migrations` job; that limitation from the previous
  entry stands, and first live proof still comes with the next genuine `lo-X.Y.Z` tag.

### Git

- `9d8fbd7e` — `ci(api): make Codecov upload non-blocking`, pushed; `origin/learnorbit-v1` matches HEAD,
  working tree clean.

- **Next**: production deployment. CI is now clean end to end — API Tests green on a real runner, the
  single-head gate proven on `api-tests.yaml` and wired into `release.yaml`. Deployment was explicitly
  out of scope for this increment and was not started.
