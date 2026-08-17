# LearnOrbit — Architecture

## Status
Initial document. This file records confirmed architecture decisions as we discover the existing LearnHouse implementation.

## Base
LearnOrbit is being developed by extending the cloned LearnHouse repository.

## Current Known Environment
- Repository: LearnHouse, customized into LearnOrbit
- Development environment: WSL Ubuntu on Windows
- Containers: Docker
- Git branch: `learnorbit-v1`
- Claude Code: primary AI coding tool

## Architecture Rule
Reuse existing LearnHouse architecture whenever possible.

Do not document guessed architecture as fact. Confirm implementation details from the codebase before recording them here.

## Confirmed Decisions

### Channels (Phase 1A) — extend Organization, do not create a separate Channel table
Investigated: `apps/api/src/db/organizations.py`, `apps/api/src/services/orgs/orgs.py`
(org creation flow), `apps/api/src/db/user_organizations.py`,
`apps/api/src/db/resource_authors.py`, and the public route
`apps/web/app/orgs/[orgslug]`.

Findings:
- `Organization` creation (`create_org` in `services/orgs/orgs.py`) has no
  institution-specific validation — any authenticated user can create one,
  and becomes its owner via a `UserOrganization` row with `role_id=1` (Admin).
  This mechanism is generic and was reused unchanged.
- `Organization` is architecturally a full multi-tenant "site" (own billing
  plan, custom domains, own auth/signup branding, cascading delete of all
  owned content), not a lightweight creator-profile concept. A separate
  `Channel` table would have duplicated slug uniqueness, membership/roles,
  branding fields, public routing, and the `ResourceAuthor`
  content-authorship linkage that `Organization` already provides.
- Decision: **extend `Organization`** with a `channel_type` field
  (`OrganizationChannelType`: `SCHOOL` | `INSTRUCTOR`, default `SCHOOL`)
  instead of creating a new entity. Stored as a plain `VARCHAR` column (not a
  native Postgres `ENUM`), matching the repo's existing convention for
  growable enum-like columns (see
  `migrations/versions/k1f2a3b4c5d6_add_community_page_type.py`) — new
  channel types can be added later without an `ALTER TYPE` migration.
  Migration: `migrations/versions/652b0b59778d_add_channel_type_to_organization.py`.
  Existing rows backfill to `SCHOOL` via `server_default`, so pre-existing
  organizations continue to behave exactly as before.
- `UserOrganization` ownership/membership, `/orgs/[slug]` public routing, and
  `ResourceAuthor` content-authorship are all reused unchanged for both
  channel types — no redesign.
- Feature gating: `channel_type == INSTRUCTOR` blocks **custom domains**
  (`services/orgs/custom_domains.py::add_custom_domain`) with a 403, since
  custom-domain hosting is a multi-tenant/site feature that doesn't apply to
  an individual creator's channel. This is the only gate added in Phase 1A —
  other tenant-grade features (billing plan caps, custom signup fields,
  member invites) were deliberately left ungated for now to keep the change
  small; revisit if/when INSTRUCTOR channels need their own gating pass.
- Not yet built (explicitly out of scope for Phase 1A): follows/subscriptions,
  videos/Shorts, feeds.

### Channels (Phase 1B) — creation UI, profile header, settings gating
Investigated/touched: `app/(hub)/new/page.tsx` (existing SaaS onboarding
wizard — read only, not modified), `app/(hub)/layout.tsx`, `proxy.ts`,
`services/config/config.ts` (`getUriWithOrg`), `dash/org/settings/[subpage]/page.tsx`.

- The existing `/new` flow is LearnHouse's full SaaS onboarding wizard
  (personal/org split, team size, pricing plans, Stripe checkout) — out of
  scope for LearnOrbit V1 (no monetization). Added a separate, minimal
  `app/(hub)/new-channel/page.tsx` instead of modifying `/new` in place:
  name/description/slug + a School/Institution vs Teacher/Creator picker,
  calling the same unmodified `createNewOrganization` service with
  `channel_type` in the body. `home.tsx`'s two entry points now point here;
  `/new` is untouched.
- `ChannelHeader` (`components/Objects/Channel/ChannelHeader.tsx`) renders at
  the top of `/orgs/[slug]`: name, channel-type badge, description/about,
  logo. Creator name is shown only to authenticated org members (reuses the
  existing `/orgs/{id}/users` endpoint, filtered client-side to `role.id ===
  1`) — there is no public members endpoint, and adding one was out of scope.
- **Important local-dev-only limitation, discovered while testing this**:
  reaching more than one organization by slug requires
  `hosting_config.tenancy: multi` (subdomain routing, e.g.
  `slug.{domain}`). `config.py` hard-rejects `LEARNHOUSE_TENANCY=multi` when
  `LEARNHOUSE_DOMAIN` contains "localhost" (deliberate — subdomains of
  `localhost` aren't routable in browsers), so this cannot be worked around
  for local dev short of a real domain. With `tenancy: single` (the local
  default), every org-scoped URL — including `getUriWithOrg()` and the
  `(hub)` route group itself — collapses onto the single seeded default org;
  `LEARNHOUSE_SAAS=true` (now set in `apps/api/.env`) only lifts the
  org-creation-count cap, it does not change tenancy. Channel creation and
  the profile/settings UI were therefore verified via direct API calls and
  by temporarily toggling the *existing* default org's `channel_type` in the
  dev DB, not by creating-and-visiting a second channel end-to-end. This
  will need a real (or staging) domain to fully exercise multi-channel
  navigation.

### Channels (Phase 1C) — following, a dedicated table rather than reusing UserOrganization
Investigated: `apps/api/src/db/user_organizations.py`,
`apps/api/src/db/playground_reactions.py` and its service/router
(`services/playgrounds/playground_reactions.py`,
`routers/playgrounds/playgrounds.py`), `apps/api/src/security/auth.py`
(`resolve_acting_user_id`, `get_current_user`).

Findings:
- `UserOrganization` (user↔org membership) always carries a `role_id` and
  drives permissions inside the org — it means "has a role here," not
  "subscribed to this channel's public updates." Reusing it for following
  would have forced a synthetic no-permissions role onto every follower and
  conflated two different relationships.
- `PlaygroundReaction` (a per-user, per-target row with a unique constraint
  and an `IntegrityError` rollback guard for a racing duplicate) is the
  closest existing analog to a lightweight, roleless, many-to-many
  relationship in this codebase, so its shape was reused rather than
  reinvented.
- Decision: a new `organizationfollow` table
  (`apps/api/src/db/organization_follows.py`), `UniqueConstraint(org_id,
  user_id)`, `ondelete="CASCADE"` FKs to both `organization.id` and
  `user.id`. Migration: `7c8d9e0f1a2b_add_organization_follows_table.py`
  (`down_revision` = `652b0b59778d`, the Phase 1A migration — still head at
  the time Phase 1C started).
- Endpoints live on the existing `orgs` router rather than a new one:
  `GET/POST/DELETE /orgs/{org_id}/follow`. `POST`/`DELETE` require
  authentication and are idempotent (no error on a repeat
  follow/unfollow); `GET` allows anonymous viewers so the public follower
  count can render without a session. Neither mutating endpoint accepts a
  `user_id` in the body/path — the acting user always comes from
  `resolve_acting_user_id(current_user)` off the authenticated session, so
  there is no way for a caller to modify another user's follow relationship
  (the same class of guard as the existing `/orgs/join` `user_id` check).
- Frontend: `ChannelHeader.tsx` renders the Follow/Following control and
  follower count via new `useOrgFollowStatus`/`useFollowOrg`/`useUnfollowOrg`
  hooks (`hooks/queries/useOrg.ts`), matching the existing `useOrgUsers`
  React Query pattern in `useOrgAdmin.ts`. Not exercised live against a
  second channel locally — same `tenancy: single` local-dev limitation
  documented under Phase 1B.

### Videos (Phase 2A) — `ChannelVideo` as a thin discovery layer over the existing `Activity` video infrastructure
Investigated: `apps/api/src/db/courses/activities.py` (`Activity`, `ActivityTypeEnum.TYPE_VIDEO`),
`apps/api/src/db/courses/courses.py` (`Course.org_id` FK), `apps/api/src/db/courses/chapter_activities.py`
(`ChapterActivity.activity_id` as the existing int-FK-to-Activity convention),
`apps/api/src/db/resource_authors.py` (generic string-keyed authorship), and the full video pipeline surveyed
during the Phase 2 pre-implementation analysis: `services/courses/activities/video.py`, `services/utils/hls_jobs.py`,
`services/utils/caption_jobs.py`, `services/courses/transfer/storage_utils.py`, `routers/stream.py`.

Findings:
- LearnHouse already has a complete, production-grade video pipeline — upload, local/S3 storage, HLS
  transcoding, AI captions, Range-request/HLS streaming, RBAC-gated serving — but every piece of it is wired to
  `Activity.course_id` → `Chapter` → `Course`. `Course` is a heavyweight, SEO-rich curriculum object (versioning,
  SCORM, contributors, drip scheduling). There is no existing concept of a standalone "post a video to my
  channel" object — a video is always a lesson inside a structured course today.
- `docs/PRD.md`'s golden path ("discover a channel → follow → watch a video") is a channel-level content post,
  not "enroll in a course." Reusing `Course` directly for every channel video would drag along curriculum-only
  fields that don't apply to a single discoverable video post.
- Cascade chain confirmed in code (not guessed): `Organization.id` ← `Course.org_id`
  (`ondelete="CASCADE"`, `courses.py:73`) ← `Activity.course_id` (`ondelete="CASCADE"`,
  `activities.py:61`), and `Activity.org_id` also directly `ondelete="CASCADE"` from `Organization.id`
  (`activities.py:57`). So `Activity` rows are always removed automatically when their `Organization` or
  `Course` is deleted — already safe today, before any LearnOrbit change.
- `Activity` is referenced elsewhere in the codebase by integer `id` (see `ChapterActivity.activity_id`), not by
  `activity_uuid` — `activity_uuid` is indexed but **not** DB-unique-constrained, so it isn't a safe FK target.
  The existing convention for a real relational reference to an `Activity` row is the integer PK.
- `ResourceAuthor.resource_uuid` is a bare string, not FK-typed to a specific table — confirms the codebase's
  existing pattern of generic, loosely-coupled authorship links that a new `ChannelVideo` doesn't need to
  duplicate; authorship can be added later the same way if needed, out of scope for this decision.

Decision: **add a new `ChannelVideo` table** — a thin discovery/metadata row per channel-published video —
rather than modifying `Activity` or repurposing `Course`. `Activity` remains the sole owner of upload, storage,
processing, streaming, HLS, and captions, unchanged. `ChannelVideo` only answers "what videos does this channel
have, with what academic metadata, in what publish state" — it is looked up by channel (org) for
discovery/listing, and joined to its `Activity` row to render playback.

```
Organization (channel)
      │  org_id (FK, CASCADE)
      ▼
ChannelVideo  ── activity_id (FK, CASCADE, UNIQUE) ──▶  Activity (TYPE_VIDEO)  →  existing upload/HLS/captions/streaming
```

**Proposed `ChannelVideo` schema** (not yet created — no migration, no model file written):

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `channelvideo_uuid` | `str`, indexed | Public identifier, matching the existing `org_uuid`/`course_uuid`/`activity_uuid`/`resource_uuid` convention |
| `org_id` | `int`, FK → `organization.id`, `ondelete="CASCADE"`, indexed | Channel ownership. Stored directly (not only derived via `Activity.org_id`) so "list this channel's videos" doesn't require a join — same reasoning as `organizationfollow.org_id` in Phase 1C |
| `activity_id` | `int`, FK → `activity.id`, `ondelete="CASCADE"`, **unique**, indexed | The underlying video's storage/streaming/HLS/captions record. One `ChannelVideo` per `Activity` (1:1) — the unique constraint prevents two channel posts pointing at the same video. Referenced by integer `id`, not `activity_uuid` (see Findings) |
| `title` | `str` | |
| `description` | `str \| None` | |
| `thumbnail_image` | `str \| None` | Storage key/filename, mirrors `Course.thumbnail_image` — optional; can later be backfilled from the HLS pipeline's sprite/thumbnail output instead of requiring a manual upload |
| `published` | `bool`, default `False` | Draft vs. live — matches the existing `Activity.published` / `Course.published` convention |
| `visibility` | `str`, default `"public"` | Plain growable string column, not a native enum — same convention as `channel_type` (Phase 1A): e.g. `"public"` \| `"unlisted"`. Controls discovery-listing/search inclusion **only**; actual viewer access control stays on `Activity.lock_type`, unchanged |
| `creation_date` | `str` | Matches the existing `str(datetime.now())` convention used by `Activity`, `ChapterActivity`, `ResourceAuthor` — not a native `datetime` column |
| `update_date` | `str` | |
| `subject` | `str \| None` | Flexible free-text column, not an enum/lookup table — per `docs/PRD.md` §4's explicit "don't hard-code to one examination body" |
| `topic` | `str \| None` | Same |
| `level` | `str \| None` | Class/grade/course level |
| `institution_context` | `str \| None` | Curriculum/institution context |
| `resource_type` | `str \| None` | Exam/resource type |

No manual `order` column: a channel's video list sorts reverse-chronologically by `creation_date` — matches
`docs/PRD.md` §5's explicit non-goal of algorithmic/curated ranking, so nothing beyond a timestamp is needed.

**Deletion/cascade implications**:
- Deleting the `Organization` (channel) already cascades to `Course` → `Activity`; adding `ChannelVideo.org_id`
  with its own `ondelete="CASCADE"` removes the `ChannelVideo` row directly rather than depending on the
  `Activity` cascade path — belt-and-suspenders, matching the diligence already applied in Phase 1A/1C.
  `ChannelVideo.activity_id`'s own `ondelete="CASCADE"` is a second, independent guarantee: no orphaned
  `ChannelVideo` row can ever point at a deleted `Activity`, however the deletion happens (channel delete,
  course delete, or a direct activity delete).
- Deleting the `Course` a video's `Activity` lives in cascades to `Activity`, which cascades to `ChannelVideo` —
  the channel post disappears along with its underlying video, as expected.
- Deleting only the `ChannelVideo` row (unpublishing/removing a channel post) does **not** cascade upward — the
  underlying `Activity`/course lesson is untouched. This asymmetry is intentional: a creator can remove a video
  from channel discovery without deleting a lesson that might still be used inside its course.
- No changes to `Activity`'s own FKs/cascade behavior are needed or proposed.

### Videos / Shorts (Phase 3A) — extend `ChannelVideo` with a `content_format` discriminator; global `/shorts` discovery reuses the org-scoped API with a cross-org aggregation layer

Investigated: `apps/api/src/db/channel_videos.py`, `apps/api/src/services/orgs/channel_videos.py` (Phase 2A-2G,
above), `apps/api/src/services/courses/activities/video.py`, `apps/api/src/services/utils/hls_jobs.py`,
`apps/api/src/services/utils/hls_transcode.py`, `apps/api/src/routers/stream.py`, `apps/web/components/Objects/Menus/OrgMenu.tsx`,
`OrgSidebar.tsx`, `OrgBottomTabBar.tsx`, `OrgMenuLinks.tsx` (`useOrgMenuItems`), and `docs/DESIGN_SYSTEM.md` §14/§16.

**1. `ChannelVideo` extension, not a new `Short` table.** A Short is a `ChannelVideo` row like any other — same
ownership (`org_id`), same underlying `Activity` (upload/storage/HLS/captions), same publish/visibility gate,
same academic metadata shape. Nothing about "vertical, short-duration" content requires a different relational
shape; it only requires a way to filter/query for it. Per the project's established architecture-decision
process (§ "Architecture Decision Process" below), extending is preferred over a new entity unless inspection
proves the existing shape can't support the requirement — it can.

**2. `content_format` discriminator.** Add `ChannelVideo.content_format: str = "long"` (plain growable string
column, same convention as `visibility` and `channel_type` — no native Postgres enum, so new formats don't need
an `ALTER TYPE` migration later). Shorts set `content_format = "short"`. Existing rows backfill to `"long"` via
`server_default`, so every video published before Phase 3 keeps behaving exactly as it does today — this is
purely additive, matching the precedent set by `channel_type`'s backfill in Phase 1A.

**3. Upload/storage/HLS/captions/streaming stay entirely shared and untouched.** Confirmed in code: the HLS
transcode ladder (`hls_transcode.py`) derives rendition width from height via `scale=-2:h`, so it already
preserves source aspect ratio — a 9:16 upload transcodes correctly today with **zero pipeline changes**. The
video-activity upload endpoint's content-type check (`video/mp4`/`video/webm`) is also orientation-agnostic. A
Short is created through the exact same `create_video_activity` → `create_channel_video` flow as a long-form
video (Phase 2F's container-course pattern reused unchanged), with `content_format: "short"` passed at
`ChannelVideo`-create time.

**4. Global `/shorts` discovery.** Per product decision, Shorts discovery is NOT scoped to one channel by
default — `/shorts` is a cross-org, reverse-chronological queue of every publicly discoverable Short. The
existing `list_channel_videos` service function is org-scoped by design (`ChannelVideo.org_id == org.id`) and
stays that way for channel pages. Global discovery needs a **new, separate service function** (e.g.
`list_public_shorts`) that queries `ChannelVideo` **without** an `org_id` filter, reusing the exact same
visibility predicate already proven in `list_channel_videos`'s non-admin branch:
`published == True AND visibility == "public"`, plus `content_format == "short"`. This is a new query shape, not
a new table — same model, same columns, same security predicate, different WHERE clause and no per-org scoping.
Ordering: `ORDER BY creation_date DESC` — identical to the existing per-channel listing, no new sort logic.

**5. Visibility/security rules (unchanged from Phase 2C, restated for Shorts):**
- Draft (`published = False`) and `unlisted` (`visibility != "public"`) Shorts are excluded from both the
  channel listing query and the new global discovery query by the same WHERE predicate — there is no separate
  "hide from global feed" flag to maintain; one predicate governs both surfaces.
- Fetching a single Short by id (e.g. for the swipe viewer's deep-link/share case) reuses `get_channel_video`
  unchanged: published+public is visible to anyone, everything else 403s unless the caller is this channel's
  owner/admin (`is_org_admin` via `resolve_acting_user_id`) — no new authorization code path.
- Creation/publish/delete/update of a Short reuses `_require_channel_admin` unchanged — only a channel's
  owner/admins can create or publish content for that channel, exactly as for long-form videos. No
  frontend-only authorization is introduced; every check remains server-side, as established in Phase 2C/2F.
- The global discovery endpoint is anonymous-readable (like `GET /orgs/{id}/videos`) but the response can only
  ever contain rows that already passed the `published+public` predicate — there is no code path where an
  unpublished or unlisted Short reaches it, mirroring the "not found vs. not visible" non-leaking design already
  used by `get_channel_video`.
- Storage paths are never exposed directly: the global feed endpoint returns `ChannelVideoRead`-shaped rows
  (numeric `activity_id`/`org_id`), and playback continues to resolve through the existing RBAC-gated
  `stream.py`/HLS endpoints exactly as Phase 2D's watch page already does — no new media-serving code, no direct
  storage-key exposure.

**6. Channel-level Shorts remain available alongside global discovery.** `list_channel_videos` gains a
`content_format` filter parameter (same pattern as its existing `subject`/`topic`/`level` filters) so a
channel's own page can show "this channel's Shorts" via the same, already-shipped org-scoped endpoint — no
duplicate listing logic between the channel view and the global feed; both are thin filter variations over one
underlying table and one visibility predicate.

**7. Navigation: a fixed, non-configurable primary destination — not a new nav system, not a blind 7th menu
item.** Investigated `useOrgMenuItems` (`OrgMenuLinks.tsx`): the existing sidebar (`OrgSidebar.tsx`) and mobile
bottom tab bar (`OrgBottomTabBar.tsx`, `MAX_TABS = 4` + a fixed "More" overflow entry) both render from this one
config-driven, **per-org feature-gated** list (`courses`/`library`/`podcasts`/`communities`/`playgrounds`/
`store`, resolved against `org.config.resolved_features`). Shorts is architecturally different from every item
in that list: it's a **global**, always-on destination, not a per-org toggleable feature — so it does not belong
in the `useOrgMenuItems` system at all, and appending it as a 7th config-driven entry would either bump an
existing destination out of the mobile tab bar's `MAX_TABS = 4` cap into "More" (breaking that destination's
existing one-tap access) or itself land past position 4 into "More" (failing the "one-tap access" requirement
for Shorts specifically). Neither is acceptable.
  - **Decision**: Shorts becomes a **fixed, non-configurable entry rendered alongside — not through —
    `useOrgMenuItems`**, on both existing nav surfaces (no third nav surface introduced):
    - **Mobile** (`OrgBottomTabBar.tsx`, < `lg`): render a fixed Shorts tab, and reduce the config-driven slice
      from `MAX_TABS = 4` to `3`. Total visible destinations stays at Shorts + 3 configurable + "More" = 5,
      which still satisfies `docs/DESIGN_SYSTEM.md` §14's documented "4–5 top-level destinations max" — the
      budget is preserved, not exceeded, by trading one configurable slot for the fixed Shorts slot.
    - **Desktop** (`OrgSidebar.tsx`, ≥ `lg`): render the same fixed Shorts entry prepended above the
      config-driven list. The sidebar has no documented hard item-count cap, so this is lower-risk, but the
      fixed-entry pattern is kept identical across both surfaces for consistency (§14: "every nav surface uses
      the same active-state language").
    - Precedent for a fixed, non-config-driven nav element already exists in the same component today: `OrgMenu.tsx`'s
      header icon row (Progress/Trail, Boards, Copilot, Dashboard, Help) is a *third* place primary destinations
      already live outside `useOrgMenuItems`, gated by `resolved_features`/auth state rather than the org-menu
      config — Shorts joins that same "fixed destination outside the configurable list" pattern rather than
      inventing a new one. It is not added there instead of the sidebar/tab-bar, because those header icons are
      `hidden md:flex` (desktop-only) and Shorts explicitly needs one-tap access on mobile too, which only the
      tab bar provides.
  - This keeps exactly two navigation surfaces (sidebar, tab bar), preserves the documented destination cap,
    and gives Shorts guaranteed one-tap access on both breakpoints without a new nav paradigm.

**8. Explicitly deferred to Phase 4 (not part of Phase 3):**
- Likes, comments, saves/bookmarks — no schema, no endpoints, no UI wiring.
- Any ranking or recommendation logic for `/shorts` ordering — V1 is strictly reverse-chronological
  (`creation_date DESC`), matching `docs/PRD.md` §5's explicit non-goal.
- Personalization of the global feed (e.g. "followed channels first") — out of scope until Phase 4/UI-3 revisits
  home-feed behavior.
- Notifications of any kind.
- Broader engagement systems (share tracking, view counts, engagement-based surfacing).

**Deletion/cascade implications**: identical to Phase 2A — `content_format` is a plain column on the existing
`ChannelVideo` row, so no new cascade path is introduced; deleting the channel, its container course, or the
underlying `Activity` cascades exactly as already documented above.

## Areas To Map
- Frontend application
- API/backend
- Database and migrations
- Authentication
- User roles
- Course/content models
- File/document storage
- Video handling
- Search
- Notifications
- Collaboration/community
- Analytics
- Background jobs
- Docker/development services

## Planned LearnOrbit Domains
These are product domains, not yet confirmed implementation details:
- Users
- Channels
- Videos
- Shorts
- Feed
- Follows
- Engagement
- Resources
- Past papers
- Quizzes
- Exams
- Notifications
- Moderation

## Architecture Decision Process
For every major feature:
1. Identify existing LearnHouse capability.
2. Reuse it if suitable.
3. Extend it if necessary.
4. Create a new module only when existing functionality cannot reasonably support the requirement.
