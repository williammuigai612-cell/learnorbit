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
**Phase 7 — Parents: IN PROGRESS** (Phases 1–6 are all complete; see below). Phase 7A (`is_parent` self-service
boolean flag on `User`) and Phase 7B backend (the `parentchildlink` child-approves-parent's-request relationship
— data model, migration, service, and `/users/parent-links/*` endpoints) are both complete — see
`docs/ARCHITECTURE.md` § "Parents (Phase 7A)" and this file's item 13. No `docs/ROADMAP.md` Phase 7 box is
checked yet — both increments are backend-only by design (no UI has consumed either the `is_parent` flag or the
relationship endpoints yet), the same "backend-only, no frontend" convention several Phase 6 letters used. Next:
7B-frontend — the settings-page UI (is_parent toggle + request/approve screens).

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
    **Next per `docs/ROADMAP.md`: Phase 8 — Trust & Moderation** (reporting, content moderation
    workflow, teacher/organization verification, basic admin tools). Not started; do not begin
    automatically.
