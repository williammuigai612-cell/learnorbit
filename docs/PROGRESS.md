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
**Phase 4 — Social Learning** (Phase 1 — Channels, Phase 2 — Educational Video, and Phase 3 — Shorts (3A–3H) are all complete; see below). Phase 4 planning/scoping is complete (see `docs/ARCHITECTURE.md` § "Social Engagement (Phase 4A/4B)"); implementation is underway — Phase 4A (engagement schema), Phase 4B (Likes end-to-end), Phase 4C (Comments end-to-end), and Phase 4D (Saves end-to-end) are complete. **Next up: Phase 4E — Shares.**

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
(Likes end-to-end), Phase 4C (Comments end-to-end), and Phase 4D (Saves
end-to-end) are complete — see the Status Snapshot entries above and
`docs/ARCHITECTURE.md` § "Social Engagement (Phase 4A/4B/4C)". The same
Next.js routing bug above also blocks live browser verification of
4B's/4C's/4D's frontend (verified via backend tests + lint only). **Next
task: Phase 4E — Shares** (append-only event log, not a toggle — see
`docs/ARCHITECTURE.md`'s Phase 4A schema decision for `ChannelVideoShare`'s
shape, which already differs from the Like/Save pattern: no uniqueness
constraint, repeated shares are all valid counted events).

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
6. Phase 4 planning/scoping, Phase 4A (engagement schema), Phase 4B
   (Likes end-to-end), Phase 4C (Comments end-to-end), and Phase 4D (Saves
   end-to-end) are complete — see the Status Snapshot entries above and
   `docs/ARCHITECTURE.md` § "Social Engagement (Phase 4A/4B/4C)". **Next:
   Phase 4E — Shares** (`services/orgs/channel_video_shares.py` + a
   record-share endpoint, but NOT a toggle — `ChannelVideoShare` has no
   uniqueness constraint, so this is an append-only event log, closer in
   shape to a "record this event" POST than 4B/4D's like/unlike pair; see
   the Phase 4A schema decision), per root `CLAUDE.md`'s `PLAN → IMPLEMENT →
   TEST → REVIEW → COMMIT` workflow.
7. **RESOLVED (2026-08-19)** — the Next.js `[dynamicSegment]/(routeGroup)/page.tsx`
   404 (was: every org-scoped page unreachable in the local dev server) and
   the `tsconfig.json` `baseUrl` deprecation blocking `tsc --noEmit` are both
   fixed. See the Status Snapshot entry above and `docs/ARCHITECTURE.md` §
   "Repo-wide dev-environment blockers (fixed)" for the full fix and its
   verification. Live browser verification is available again for future UI
   work; re-verifying prior phases' previously-unverified UI (3F, 3G, 3H,
   UI-1's mobile viewport, 4B, 4C, 4D) live is optional follow-up, not done
   as part of this fix.
