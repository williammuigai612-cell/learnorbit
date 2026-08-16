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
**Phase 2 — Educational Video** (Phase 1 — Channels is complete; see below)

## Status Snapshot
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

## Current Task
Phase 2A–2F complete (architecture decision, `ChannelVideo` model/migration,
API endpoints, the standalone video watch page, the channel video listing,
and the creator video upload flow — see entries below and
`docs/ARCHITECTURE.md` § "Videos (Phase 2A)"). Phase 2G-1–2G-3 complete
(metadata update endpoint + edit UI, Subject/Topic/Level filtering — see
entries below). Phase 2G-4 (thumbnail upload) investigated and deferred, not
implemented (see entry below). Next: Phase 2 is functionally complete for V1
scope; move to roadmap Phase 3 (Shorts), or pick up the deferred
thumbnail-upload work in a later creator/UI polish phase.

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
   creator/UI polish phase (see Phase 2G-4 entry above). Consider roadmap
   Phase 3 (Shorts) as the next unit of work.
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
