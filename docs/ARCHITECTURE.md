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

**9. Phase 3G implementation (Channel Shorts Section) — realizes point 6 above.** `ChannelShortsSection.tsx` +
`ChannelShortCard.tsx` (new) render this channel's own Shorts on the channel home page via
`useChannelVideos(orgId, { content_format: 'short' })` — the exact same hook/endpoint/cache-key convention as the
Phase 2E `ChannelVideosSection`, just a different filter value; no new query hook or endpoint. As a corollary,
`ChannelVideosSection` was corrected to pass `content_format: 'long'` — previously it queried with no
`content_format` filter at all, so Shorts were silently included in its 16:9 grid alongside long-form videos.
No tabs were introduced for this — §17's Videos/Shorts/Resources/About tab system remains a future decision; 3G
ships as a page section, consistent with the channel page's existing section-stack layout, and is deliberately
filterless (no subject/topic/level controls, unlike `ChannelVideosSection`). `UploadChannelVideoModal` gained an
optional `defaultContentFormat` prop (upload mode only) so the Shorts section's own upload trigger preselects the
existing Phase 3F Format toggle to "Short" rather than duplicating the upload form.

**Deletion/cascade implications**: identical to Phase 2A — `content_format` is a plain column on the existing
`ChannelVideo` row, so no new cascade path is introduced; deleting the channel, its container course, or the
underlying `Activity` cascades exactly as already documented above.

### Social Engagement (Phase 4A/4B/4C/4E/4F) — direct FKs per relationship, no polymorphism; reuse `get_channel_video` for visibility
Investigated: `OrganizationFollow` (Phase 1C), `DiscussionComment`/`DiscussionReaction`/`DiscussionCommentVote`
(communities), `PlaygroundReaction`, `services/orgs/channel_videos.py`.

**Schema (Phase 4A)**: four new tables — `ChannelVideoLike`, `ChannelVideoSave`, `ChannelVideoComment`,
`ChannelVideoShare` — each with a direct `channelvideo_id` FK (`ondelete="CASCADE"`), matching every existing
precedent (`OrganizationFollow.org_id`, `DiscussionComment.discussion_id`). No polymorphic
`content_type`/`content_id` association: `ChannelVideo` is Phase 4's only content entity (it already covers both
long-form and Shorts per Phase 3A), so a generic association would be speculative generality. Like/Save are
identical toggle shapes (`UniqueConstraint(channelvideo_id, user_id)`, both columns indexed — mirrors
`OrganizationFollow`) but kept as separate tables: saves are a private per-user list, likes are a public count —
different access patterns, not the same relationship with a label. Comment mirrors `DiscussionComment` minus
`parent_comment_id` (no threading) and `upvote_count` (no voting) — both out of scope. Share is an append-only
event log (no uniqueness constraint — repeated shares are valid) with a required, non-nullable `user_id`: no
anonymous-identity infrastructure exists anywhere in this schema to attribute an anonymous share to.

**Service/router pattern (Phase 4B, Likes)**: `services/orgs/channel_video_likes.py` + three endpoints on the
existing `orgs` router (`GET/POST/DELETE /orgs/{org_id}/videos/{channelvideo_id}/like`), returning a combined
`ChannelVideoLikeStatus` (`is_liked` + `like_count`) — same shape as `OrganizationFollowStatus`. Two decisions
worth carrying into 4C–4E (Save/Comment/Share):
- **Visibility/ownership is never re-implemented per feature.** Every like/status function calls the existing
  `get_channel_video` first, which already raises the project's real 404/403 rule (published+public visible to
  anyone, otherwise this channel's owner/admin only). This guarantees a viewer can never like/comment-on/save a
  video they couldn't actually watch, without duplicating that predicate — the same reuse should apply to Save
  and Comment.
- **Counts are always live `func.count()` queries**, never a denormalized counter column on `ChannelVideo` —
  follows the more recent `OrganizationFollow._follower_count` convention over the older, upstream
  `Discussion.upvote_count` cached-counter pattern, since a cached counter has a cache-invalidation failure mode
  (any write path that forgets to update it silently drifts) and current content volumes don't justify the
  trade.
- Concurrent duplicate writes (e.g. a rapid double-click) are handled by catching `IntegrityError` on the unique
  constraint and treating it as idempotent success, not a 500 — same pattern as `follow_organization`.

**Service/router pattern (Phase 4C, Comments)**: `services/orgs/channel_video_comments.py` + four endpoints on
the existing `orgs` router (`GET/POST /orgs/{org_id}/videos/{channelvideo_id}/comments`, `PUT/DELETE
.../comments/{comment_uuid}`), returning `ChannelVideoCommentRead` with a nested `UserReadAuthor` — same
author-projection reuse as `DiscussionCommentReadWithAuthor`. Confirms both carry-over decisions from 4B: create/list
call the existing `get_channel_video` first (no re-implemented visibility), and validation is a single hard-coded
`MAX_COMMENT_LENGTH = 2000` constant plus a non-empty-after-strip check — no configurable per-org moderation
(`services/communities/moderation.py`'s `validate_comment_content` is hard-coupled to `Community.moderation_settings`,
confirmed not reusable as-is for `ChannelVideo`, so not used). One new decision Comment introduces beyond the Like
pattern: edit/delete are **author-only**, not owner/admin — deliberately narrower than `DiscussionComment`'s
update/delete (which lets a community admin delete others' comments too), because Phase 4C's scope is explicitly
"edit own / delete own," not moderation; a channel owner cannot yet remove another user's comment on their own
video (noted as a real gap, not built without a separate request). Edit/delete also re-check that the comment's
`channelvideo_id` matches the URL's before touching it (404 on mismatch) — `comment_uuid` alone is enough to find
the row, but that check stops a comment being edited/deleted through the wrong video's URL. List order is
newest-first (`creation_date.desc()`), a deliberate UX choice for a video comments panel, diverging from
`DiscussionComment`'s ascending order without changing anything about that community code path.

**Service/router pattern (Phase 4E, Shares)**: `services/orgs/channel_video_shares.py` + two endpoints on the
existing `orgs` router (`GET/POST /orgs/{org_id}/videos/{channelvideo_id}/share`), returning
`ChannelVideoShareStatus{share_count}` — a public total, same visibility/carry-over as Like's `like_count`. The one
real departure from the Like/Save pattern: Share has **no unshare/DELETE endpoint and no idempotency check**.
`share_channel_video` unconditionally inserts a new `ChannelVideoShare` row and commits every call — the Phase 4A
schema decision (no `UniqueConstraint`) means repeated shares by the same user are all valid, all counted events,
not a toggle to collapse or an `IntegrityError` to guard against.

**Service/router pattern (Phase 4F, Shorts engagement rail)**: no backend/schema changes — Phase 4A–4E already
cover every `ChannelVideo`, Shorts included. Pure frontend wiring: `docs/DESIGN_SYSTEM.md` §16 specifies a
right-side vertical icon+count rail, `--foreground`-on-scrim, overlaid on mobile but placed alongside (not
overlaid on) the player on desktop — visually incompatible with the light `Button variant="ghost"` row already
built for the long-form watch page. Rather than duplicating the like/save/share/comment hooks into a
Shorts-only component, `ChannelVideoEngagementBar` gained a `layout?: 'horizontal' | 'rail'` prop
(default `'horizontal'`, so the watch page is untouched) — same hooks/handlers, branched JSX only.
`ChannelVideoCommentsPanel` gained an optional `trigger` render-prop (`{ commentCount, isLoading } =>
ReactNode`) so the rail can supply its own icon+count trigger for the same Dialog without forking the panel;
the custom trigger is a `React.forwardRef` component (`RailCommentTrigger`) so Radix's `DialogTrigger asChild`
can still attach its ref/onClick, same contract the panel's default Button trigger already relied on.
`short.tsx` mounts the rail twice — absolutely positioned inside `.short-viewer-frame` for mobile (`sm:hidden`,
scrolls with its own slide, same technique as `ShortAttributionOverlay`) and as a `hidden sm:flex` column
beside the frame for desktop — mirroring the file's existing dual-markup convention for breakpoint-specific
controls (the up/down nav buttons use the same pattern).

**Deferred (Phase 4G onward)**: card-level engagement counts (`ChannelVideoCard`/`ChannelShortCard`) — avoided
for now to prevent an N+1 fetch storm across a grid/feed without a batch-counts endpoint; social-platform share
targets (LinkedIn/X/WhatsApp/Reddit — `ActivityShareDropdown.tsx` / `CourseShare.tsx` already have this UI for
other content types, but it wasn't reused for Phase 4E's minimal copy-link-and-record-event action, since
building the full dropdown is UI scope beyond "Shares end-to-end" wiring); notifications; view counts; comment
moderation beyond the hard-coded length cap; threaded comment replies; comment likes/upvotes; channel-admin
moderation-delete of other users' comments.

### Home Feed (Phase 4G) — cross-org query over `OrganizationFollow`, long-form only, reuses `ChannelVideoCard`'s anticipated `channel` prop

Investigated: `apps/api/src/services/orgs/{channel_videos.py,follows.py}`, `apps/api/src/routers/shorts.py`,
`apps/web/components/Objects/Channel/ChannelVideoCard.tsx`, `apps/web/app/orgs/(withmenu)/[orgslug]/{home-client.tsx,shorts/}`,
`OrgSidebar.tsx`/`OrgBottomTabBar.tsx`, `docs/PRD.md` §5, `docs/UI_UX_IMPLEMENTATION_PLAN.md` UI-3/UI-5/UI-6.

**1. New service function, not a new table.** `list_home_feed(current_user, db_session)` joins `ChannelVideo` to
`Organization` filtered by `ChannelVideo.org_id IN (SELECT org_id FROM organizationfollow WHERE user_id = caller)`
— same `published == True AND visibility == "public"` predicate as `list_channel_videos`/`list_public_shorts`,
same `creation_date DESC` ordering, no ranking (`docs/PRD.md` §5 non-goal). A follower list of zero rows short-circuits
to `[]` before the join, matching the "logged in with no follows" state UI-3 calls out.

**2. Long-form only — Shorts are deliberately excluded.** Shorts already have their own global discovery entry
point (`GET /shorts`) and, per UI-6, a distinct swipe interaction model that "should not reuse the long-form video
page layout." Mixing Shorts into this grid would duplicate that surface rather than extend it. This realizes the
video-grid reuse UI-5 anticipated ("video listing/grid components reused across channel and home surfaces") without
also merging in Shorts' different interaction model. Revisiting a unified feed is a future decision, not assumed here.

**3. Requires authentication — 401 for anonymous, not a public/degraded response.** Unlike `list_public_shorts`
(unconditionally public) or `get_follow_status` (anonymous-readable), the feed's entire content depends on
*whose* follows are being read — there is no meaningful anonymous result to degrade to. Mirrors
`follow_organization`/`unfollow_organization`'s existing 401-for-anonymous convention rather than inventing a new one.

**4. `HomeFeedItem` (new schema) extends `ChannelVideoRead` with `org_slug`/`org_name`/`channel_type`.** Every other
`ChannelVideoRead` consumer already has channel context from its surrounding page (a channel's own page has
`ChannelHeader`; a single video's watch page names its channel) — the home feed is the first surface showing a
video card *outside* its own channel's page, so it's the first place that context needs to travel with the row
itself. `ChannelVideoCard.tsx`'s `channel?: {name, channel_type}` prop was already added in Phase 2G-2 in
anticipation of exactly this ("reused on multi-channel surfaces (e.g. a future home feed)") — Phase 4G is the
first caller to actually pass it.

**5. Card links use the page's own `orgslug`, not each item's owning org's slug.** Same convention the global
Shorts queue already established (`short.tsx`'s `goTo`/`useChannelVideo(org?.id, ...)`): the video-watch route
resolves its org context from the URL's `orgslug` param via `useOrg()`, not from the fetched row's real `org_id`.
This only produces correct results because local dev's `tenancy: single` collapses all org-scoped routing onto
one seeded org (`docs/CLAUDE.md` Multi-tenancy note) — a real cross-org click-through is unverified in this
environment, exactly the same accepted, already-documented gap Shorts has, not a new one introduced here. The
`orgId` prop passed to `ChannelVideoCard` for its owner-only edit-action gate is unaffected by this — it's read
from `item.org_id` (each video's *real* owning org), so the edit control's permission check is correct regardless.

**6. Navigation: a second fixed, global nav entry, extending Phase 3A point 7's precedent rather than a new
pattern.** Home is architecturally identical to Shorts — a global, always-on destination, not a per-org
toggleable feature — so it's rendered the same way: fixed, outside `useOrgMenuItems`, on both `OrgSidebar.tsx`
and `OrgBottomTabBar.tsx`. The mobile tab bar's `MAX_TABS` drops from `3` to `2` (Home + Shorts + 2 configurable +
"More" = 5), preserving `docs/DESIGN_SYSTEM.md` §14's "4–5 top-level destinations max" the same way Phase 3A's
`4 → 3` reduction did when Shorts was added.

**7. Empty state is a single generic message, not two.** UI-3 distinguishes "no follows yet" from "follows but no
content published" as separate states; the feed endpoint returns `[]` for both and the frontend does not call a
second endpoint just to tell them apart. A single "follow channels to see their videos, or check back soon"
message covers both without an extra request purely to distinguish copy.

**Deferred (still, per Phase 4E/4F's list)**: card-level engagement counts, notifications, comment moderation.
**Newly deferred by this phase**: Shorts in the feed (see point 2); pagination (mirrors `list_channel_videos`/
`list_public_shorts` — neither paginates yet, so this doesn't add a new inconsistency); a logged-out marketing
view for `/feed` (the existing global `/home` hub's redirect-to-`/login` behavior for anonymous users is
untouched — this page instead shows an inline "sign in to see your feed" prompt when visited directly while
logged out, since it lives inside the org-scoped `(withmenu)` shell rather than replacing `/home`).

### Basic Notifications (Phase 4H) — new `notification` table, channel-admin recipients, best-effort creation on comment

Investigated: `apps/api/src/services/orgs/channel_video_comments.py`, `apps/api/src/services/orgs/orgs.py`
(`_try_record_org_admin_in_loops`), `apps/api/src/db/{channel_video_comments,channel_video_likes}.py`,
`apps/api/src/security/org_auth.py`/`rbac/constants.py`, `apps/web/components/Objects/Menus/OrgMenu.tsx`,
`docs/UI_UX_IMPLEMENTATION_PLAN.md` UI-7.

**1. New single-purpose `notification` table, not a polymorphic one.** Same convention as every Phase 4A
engagement table (`channelvideolike`/`channelvideosave`/`channelvideocomment`/`channelvideoshare`): a direct FK
to `channelvideo`, `recipient_id`/`actor_id` FKs to `user`, no `content_type`/`content_id` association.
`notification_type` is a plain growable string (`"COMMENT"` today) — the same convention `ChannelVideo.visibility`/
`content_format` already established — so a future `LIKE` type needs no migration or enum change, matching the
scope's "support future types ... without implementing them now."

**2. Recipient(s) are the channel's admin/maintainer user(s), not a single `owner_id`.** `ChannelVideo` has no
owner/creator column — channel ownership is expressed the same way `get_channel_video`'s draft-visibility check
already reads it: `UserOrganization` rows in `ADMIN_OR_MAINTAINER_ROLE_IDS` for the video's `org_id`. Reusing
that existing predicate (`_get_org_admin_user_ids`, a thin wrapper around the same query `is_org_admin` performs)
rather than inventing a new "owner" concept keeps this consistent with every other admin-only check on a
`ChannelVideo`, and correctly notifies every admin of a multi-admin channel — the actor is excluded from the
recipient list, which is what makes "no self-notification when the owner comments on their own video" fall out
naturally rather than needing a special case.

**3. Creation is a best-effort call site in `create_channel_video_comment`, mirroring `_try_record_org_admin_in_loops`.**
`services/orgs/orgs.py` already established the pattern for "this side effect must never fail the primary action":
wrap the call in try/except, log via `logging.exception`, swallow. `_try_create_comment_notifications` follows it
exactly, with one addition specific to a DB-backed (not HTTP-backed, unlike Loops) side effect: on failure it also
rolls back `db_session`, since a partial `add()`/failed `commit()` inside `create_comment_notifications` would
otherwise leave the session's transaction unusable for whatever runs next in the same request. That rollback
expires already-loaded ORM instances (SQLAlchemy's default post-rollback behavior), so `create_channel_video_comment`
builds its `ChannelVideoCommentRead` response *before* firing the notification call — the response no longer
depends on `comment`'s ORM attributes by the time a notification failure could expire them.

**4. Minimum endpoint set: list, unread-count, mark-one-read, mark-all-read — no threads, no preferences.**
`GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{uuid}/read`, and
`PATCH /notifications/read-all`, mounted as a global router (no `org_id` in the path) exactly like `routers/feed.py`
— a notification is personal to the caller, not org-scoped. Read/mark-read ownership is enforced by scoping every
query to `recipient_id == caller`; a mismatched or missing `notification_uuid` returns a uniform 404 ("Notification
not found"), the same non-leaking convention `channel_video_comments.py` already uses for a comment editable only
by its author.

**5. Frontend: a bell dropdown in the existing header, not a new page or nav destination.** Per
`docs/UI_UX_IMPLEMENTATION_PLAN.md` UI-7, notifications are "a simple list/indicator, not a full real-time system" —
`NotificationBell` (`apps/web/components/Objects/Menus/NotificationBell.tsx`) reuses `OrgMenu.tsx`'s existing
`CopilotMenuButton` dropdown-trigger pattern (icon button + `DropdownMenu`) rather than adding a nav-bar entry,
a dedicated route, or a new interaction shell. It's rendered both in the desktop header row and inside the
existing mobile hamburger panel (alongside `HeaderProfileBox`), so no new mobile surface was introduced either.
Unread count polls every 60s (`refetchInterval`) rather than a WebSocket/SSE connection — explicitly out of scope
per the task and PRD §3.

**Deferred (unchanged from Phase 4E/4F/4G's list, still not part of this phase)**: LIKE notifications (the type
column supports it; no LIKE call site was added), email notifications/digests, push notifications, notification
preferences/settings, threaded notifications, card-level engagement counts, comment moderation.

### Repo-wide dev-environment blockers (fixed) — `tsconfig.json` `baseUrl` removal, and the Next.js dynamic-segment/route-group 404
Two standing, pre-existing blockers logged since Phase 2G-3/3F (`tsc --noEmit` unusable; live browser verification of every
`/orgs/[orgslug]/*` page blocked) are now fixed. Both were infrastructure, not product work — tracked here because fixing
the second required an app-tree restructure other work will build on top of.

**`tsconfig.json` `baseUrl` (TS5101 deprecation)**: TypeScript 6.0.3 (installed) errors on `"baseUrl": "."` as deprecated
(removed in TS 7.0). Fix: removed `baseUrl` entirely and added an explicit leading `./` to every `paths` pattern (TS
resolves `paths` relative to the tsconfig file's own directory once `baseUrl` is absent — same target directory as
`baseUrl: "."` was, so no behavior change for the `@alias/*` imports). This *did* have one real behavior change: with
`baseUrl` gone, TypeScript no longer falls back to resolving a bare, non-aliased specifier (e.g. `'app/orgs/...'`,
`'public/foo.png'`) relative to the project root — those must go through an existing `@/*`/`@public/*` alias instead. Two
`.tsx` files had bare `'app/orgs/...'` type-only imports (fixed to `@/app/orgs/...`), and 21 files across the codebase had
bare `'public/*.png'` static-image imports (fixed to `@public/*.png` — the Next.js *bundler*, not just `tsc`, reads
`baseUrl` for this too, so these broke `next dev`, not just type-checking, once `baseUrl` was removed). Also surfaced two
real, previously-unchecked type errors (`tsc` had never successfully run to completion before): a `ChannelVideoFilters`
correlated-union write in `channelVideoFilters.ts`'s `normalizeChannelVideoFilters` (cast to `Record<string, string>` — all
per-key value types are independently `string`-compatible, TS just can't verify that across a generic key in a loop), and
the same pattern in `ChannelVideosSection.tsx`'s `setFilter` (fixed by narrowing `FilterField` to exclude `content_format`,
which that component's UI never actually sets — a more precise fix than a cast, since it's genuinely never called that way).

**Next.js `[dynamicSegment]/(routeGroup)/page.tsx` 404**: confirmed (Phase 3F investigation) that Next.js 16.2.9 in this
environment 404s every route shaped dynamic-segment-then-route-group, while route-group-then-dynamic-segment (and a
dynamic segment with no route group at all) both resolve fine. `app/orgs/[orgslug]/(withmenu)/page.tsx` matched the broken
shape; because it sits directly under the `[orgslug]` dynamic segment, the whole `[orgslug]` route tree failed, including
`dash` (a plain folder, not a route group — normally an unaffected shape on its own). Fix: moved the entire `(withmenu)`
sub-tree from `app/orgs/[orgslug]/(withmenu)/*` to `app/orgs/(withmenu)/[orgslug]/*` (`git mv`, 65 files) — route group now
precedes the dynamic segment, matching the confirmed-working shape. URLs are unchanged (route groups never appear in the
URL) and directory depth is unchanged (only the two segments swap order), so no other relative import in the moved tree
needed touching; only two files elsewhere had absolute `@/app/orgs/[orgslug]/(withmenu)/...` imports and were updated
(`lib/dashboard-search/registry.ts`, `components/Copilot/CopilotBubble.tsx`).

The move split `[orgslug]/layout.tsx`'s single `OrgProvider` shell — previously the sole ancestor of both `(withmenu)` and
`dash` — across two physical layout files, since `dash` still needs it at `app/orgs/[orgslug]/layout.tsx` while
`(withmenu)` now needs its own copy at `app/orgs/(withmenu)/[orgslug]/layout.tsx` (a layout inside a route group can't see
`params.orgslug` until the dynamic segment below it, so the shell can't live any higher than that). Rather than duplicate
the JSX, it's extracted into `components/Contexts/OrgRootLayout.tsx` (the provider/toploader/toast/footer shell) and
`lib/seo/orgFaviconMetadata.ts` (the shared `generateMetadata` body), which both layout files import; `(withmenu)`'s
menu/sidebar/banner/podcast-player chrome (previously that tree's `layout.tsx` default export) is similarly extracted into
`components/Objects/Menus/OrgMenuChrome.tsx` so the new `(withmenu)/[orgslug]/layout.tsx` can compose
`OrgRootLayout > OrgMenuChrome > children` in one file without reintroducing a route-group-under-dynamic-segment nesting.
`dash`'s own layout/context/data-fetching is untouched.

Verified: `tsc --noEmit` clean (was blocked repo-wide). Live: started the dev server directly (`bun run dev`, no backend),
curled `/`, and five representative routes across both trees — `/orgs/{slug}/videos`, `/orgs/{slug}/courses`,
`/orgs/{slug}/dash`, `/orgs/{slug}/dash/courses`, `/orgs/{slug}/search` — for a nonexistent org slug; all returned the
app's own `not-found.tsx` content (an application-level 404, i.e. the org lookup ran and failed) rather than Next's bare
framework 404, confirming routing now reaches application code across the whole tree. Data-level rendering against a real
org was not verified this session (backend wasn't started). `bun test tests`: 112 passed, same pre-existing 12
failures/1 error as before (`billing-internal-key.test.mjs`, `catalog-pagination.test.mjs`'s missing fixture, the `ar.json`
timeout) — no regressions from either fix.

### Academic Library (Phase 5A) — `ChannelResource` as a thin discovery layer over the existing `TYPE_DOCUMENT` Activity infrastructure; a dedicated container course, not the video one

Investigated: `apps/api/src/db/channel_videos.py`, `apps/api/src/services/orgs/channel_videos.py` (Phase 2A/3A,
above), `apps/api/src/services/courses/activities/pdf.py` (`create_documentpdf_activity`,
`update_documentpdf_activity`), `apps/api/src/services/courses/activities/uploads/pdfs.py` (`upload_pdf`),
`apps/api/src/security/file_validation.py` (`FILE_TYPES['document']`), `apps/api/src/routers/content_files.py`
(`_check_content_access`), `apps/web/services/organizations/channelVideoUpload.ts`
(`ensureChannelVideosContainer`), `apps/web/components/Objects/Activities/DocumentPdf/DocumentPdf.tsx`, and
`docs/DESIGN_SYSTEM.md` §13 (Resource card).

**1. `ChannelResource`, not a repurposed `ChannelVideo` or a new upload/storage pipeline.** LearnHouse already has
a complete PDF pipeline — `ActivityTypeEnum.TYPE_DOCUMENT` / `ActivitySubTypeEnum.SUBTYPE_DOCUMENT_PDF`,
`create_documentpdf_activity` (validates `content_type == "application/pdf"`, uploads via `upload_pdf` →
`upload_content.upload_file`), and `security/file_validation.py`'s `document` type (500MB cap, `%PDF-` magic-byte
check, SVG-block, server-derived safe extension) — but exactly like Phase 2A's video Activity, every piece of it
is wired to `Activity.course_id` → `Chapter` → `Course` (`create_documentpdf_activity` requires a `chapter_id`
and 404s without one). There is no course-less PDF in LearnHouse today, same finding as Phase 2A, so the same
decision applies: add a thin discovery/metadata table rather than modify `Activity` or point `docs/PRD.md`'s
channel-resource concept at `Course` directly.

```
Organization (channel)
      │  org_id (FK, CASCADE)
      ▼
ChannelResource ── activity_id (FK, CASCADE, UNIQUE) ──▶  Activity (TYPE_DOCUMENT/SUBTYPE_DOCUMENT_PDF)
                                                            →  existing upload/storage/validation (unchanged)
```

**Proposed `ChannelResource` schema** (not yet created — no migration, no model file written):

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `channelresource_uuid` | `str`, indexed | Public identifier, matching `channelvideo_uuid`'s convention |
| `org_id` | `int`, FK → `organization.id`, `ondelete="CASCADE"`, indexed | Channel ownership, stored directly — same reasoning as `ChannelVideo.org_id` |
| `activity_id` | `int`, FK → `activity.id`, `ondelete="CASCADE"`, **unique**, indexed | The underlying PDF's storage/validation record. One `ChannelResource` per `Activity` (1:1), referenced by integer `id` per the existing convention (see Phase 2A Findings — `activity_uuid` is not unique-constrained) |
| `title` | `str` | |
| `description` | `str \| None` | |
| `published` | `bool`, default `False` | Draft vs. live — same convention as `ChannelVideo.published` |
| `visibility` | `str`, default `"public"` | Plain growable string, same convention as `ChannelVideo.visibility` (`"public"` \| `"unlisted"`) |
| `creation_date` | `str` | `str(datetime.now())` convention, matching `ChannelVideo` |
| `update_date` | `str` | |
| `subject` | `str \| None` | Flexible free-text, per `docs/PRD.md` §4 — same convention as `ChannelVideo.subject` |
| `topic` | `str \| None` | Same |
| `level` | `str \| None` | Class/grade/course level |
| `institution_context` | `str \| None` | Curriculum/institution context |
| `resource_type` | `str \| None` | Free-text category — e.g. `"past_paper"`, `"notes"`, `"revision_guide"`, `"marking_scheme"`. Not an enum, same reasoning as `ChannelVideo.resource_type`: a marking scheme is treated as a tagged `ChannelResource` like any other, not a separate linked entity — revisit only if a real "paper ↔ its scheme" relationship is requested |
| `year` | `str \| None` | New field, not present on `ChannelVideo`. A past paper without an exam year/session is close to unusable for exam prep, and `docs/ROADMAP.md` Phase 5 explicitly lists "Past papers" as an increment. Kept as free text (not `int`), matching every other academic-metadata column's non-enum convention, since exam sessions aren't always a bare year (e.g. "2023", "Nov 2023 P1") |

**No `thumbnail_image` column.** `docs/DESIGN_SYSTEM.md` §13's Resource card spec is icon/badge-driven ("file-type
icon/badge (PDF, past paper, etc.) → title → metadata chips"), not thumbnail-driven like the Video/Short card —
the design system itself doesn't call for one, so it isn't added speculatively (compare Phase 2G-4, which
deferred `ChannelVideo.thumbnail_image` upload even though the column already existed).

**No `file_type`/format column.** V1 scope is PDF only (`docs/PRD.md` §3 items 11–12: "PDFs and academic
resources," "Past papers"); the format is already fully carried by the underlying `Activity`'s
`activity_sub_type`. If a second format is added later, the precedent to follow is `ChannelVideo.content_format`
(Phase 3A) — a plain growable string column, added only when a second real format actually ships, not before.

**2. Dedicated "Channel Resources" container course — not a shared container with Channel Videos.** Phase 2F/3A
established a lazily-created, hidden, `public+published` container course per channel (`CONTAINER_COURSE_NAME =
"Channel Videos"`, marked via `extra_metadata.learnorbit_channel_container`) so a channel video isn't forced to
surface course/chapter picking to the creator. The same trick is needed for PDFs (`create_documentpdf_activity`
also requires a `chapter_id`), but resources get their **own** container course rather than reusing the video
one:
- The existing container is named and labeled "Channel Videos" (`CONTAINER_COURSE_NAME`) — if an org admin ever
  encounters it in their dashboard's course list (it's hidden from public browsing but not literally
  unreachable), a shared container mislabels every PDF inside it as a "video" course. A distinct "Channel
  Resources" container avoids that.
- The two content types have independent lifecycles and independent single-marker lookups
  (`ensureChannelVideosContainer` finds "the" container by one boolean marker per org); overloading one marker
  for two unrelated content types would require branching that lookup by content type anyway, which is exactly
  as much code as a second, parallel container helper.
- The existing container-creation code already documents its own race condition (two simultaneous first-uploads
  can create duplicate containers) as an accepted, low-cost V1 limitation — confirming that a second, near-identical
  container helper is consistent with, not a departure from, the level of rigor already accepted here.
- **Decision**: add `ensureChannelResourcesContainer` (mirrors `ensureChannelVideosContainer` exactly) with
  `CONTAINER_COURSE_NAME = "Channel Resources"`, `CONTAINER_CHAPTER_NAME = "Resources"`, marker key
  `learnorbit_resource_container` (distinct from `learnorbit_channel_container`). Same `public: true`,
  `published: true` course settings, for the same reason: `content_files.py`'s course-based access check is what
  ultimately gates the file, and it only branches on `course.public`, not on any content-type distinction.

**3. Creation flow reuses `create_documentpdf_activity` unchanged, mirroring Phase 2F's video flow.**
`ensureChannelResourcesContainer` → `create_documentpdf_activity(chapter_id, pdf_file, ...)` (existing, unmodified;
validates `application/pdf`, uploads via `upload_pdf`) → `updateActivity({ published: true }, ...)` (same
unconditional-publish reasoning as video: `Activity.published` carries no independent meaning once wrapped by a
`ChannelResource`, whose own `published`/`visibility` are the real, single source of truth) → `create_channel_resource`
(new service function, mirrors `create_channel_video`: validates the `Activity` belongs to this org and is
`TYPE_DOCUMENT`, 404s identically for not-found vs. wrong-org per the existing anti-enumeration pattern, 409s if
already posted). No new upload code, no new validation code — only new orchestration, one level up.

**4. File serving needs no `content_files.py` changes.** A `ChannelResource`'s PDF lives at
`orgs/{org_uuid}/courses/{container_course_uuid}/activities/{activity_uuid}/documentpdf/...` — the exact path
shape `_check_content_access` already recognizes and gates via `course.public` (the `courses`/`activities` branch,
`content_files.py:169-200`). No new path pattern, no new access-control branch.

**5. Viewing reuses `DocumentPdf.tsx` unchanged.** The existing PDF-activity viewer is already a generic
`<iframe>` over `getActivityMediaDirectory(orgUuid, courseUuid, activityUuid, filename, 'documentpdf')` — it
takes no course-specific behavior beyond those four identifiers, all of which a `ChannelResource` row (joined to
its `Activity`) already has. A resource detail page needs to pass it the container course's uuid instead of a
curriculum course's — no component change.

**6. Visibility/security rules (unchanged from Phase 2C/3A, restated for resources):**
- Draft (`published = False`) and `unlisted` resources are excluded from listing by the same
  `published == True AND visibility == "public"` predicate as `ChannelVideo`; the channel's own owner/admins see
  everything, reusing `_require_channel_admin`/`is_org_admin` unchanged.
- **Inherited limitation, not new**: because the container course is always `public: true`, `content_files.py`
  permits an anonymous direct fetch of any file inside it by URL, independent of the owning `ChannelResource`'s
  own `published`/`visibility` state — identical to the accepted Phase 2A/3A trade-off for videos.
  `ChannelResourceRead` must not expose the underlying storage path/filename directly (same rule already applied
  to `ChannelVideoRead`), so the only way to reach an unpublished file is guessing/knowing its `activity_uuid` —
  not solved here, carried over as-is.
- Audit logging: no existing precedent found for `ChannelVideo` create/publish/delete going through
  `audit_logs` — confirms this is not yet a project convention for channel content, so Phase 5B should not
  invent one unilaterally for resources; if the user wants audit logging added, it should cover both content
  types together as its own increment, not be introduced asymmetrically here.

**Deletion/cascade implications**: identical reasoning to Phase 2A — `org_id`'s own `ondelete="CASCADE"` removes
the `ChannelResource` row directly when the channel is deleted (belt-and-suspenders alongside the `Course` →
`Activity` cascade path); `activity_id`'s `ondelete="CASCADE"` guarantees no orphaned `ChannelResource` can point
at a deleted `Activity`. Deleting only the `ChannelResource` row (unpublishing/removing a channel post) does not
cascade to the underlying `Activity`/container-course lesson.

**Explicitly deferred (not part of 5A, tracked for 5B onward):** the actual model file, Alembic migration,
service/router layer, frontend upload flow, resource card/listing/detail UI, and subject/topic/level/resource_type/year
filtering endpoint — see `docs/PROGRESS.md` for the increment breakdown. Global cross-channel resource discovery,
full-text search, and resource-level likes/comments/saves are out of scope for Phase 5 entirely (no ROADMAP item,
no PRD signal); Phase 4's engagement tables are direct-FK-per-content-type with no polymorphism, so adding
resource engagement later is a parallel `ChannelResourceLike`/`ChannelResourceSave` pattern, not a schema change
to this table.

### Exams & Practice (Phase 6A) — new `Question`/`Quiz` domain, not a repurposed `Assignment`; a real cross-quiz question bank and a distinct timed Exam Practice mode

Investigated: `apps/api/src/db/courses/assignments.py` (`Assignment`/`AssignmentTask`/`AssignmentTaskSubmission`/
`AssignmentUserSubmission`), `apps/api/src/routers/courses/assignments.py` (full CRUD/grading router already
mounted), `apps/web/app/orgs/[orgslug]/dash/assignments/[assignmentuuid]/**` (existing teacher authoring +
grading UI, including a `QUIZ` task type), `apps/web/components/Objects/Activities/Assignment/
AssignmentStudentActivity.tsx` (existing student-taking UI), `apps/api/src/db/channel_resources.py` +
`apps/api/src/services/orgs/channel_resources.py` (Phase 5B — the closest structural precedent: a channel-scoped
discovery/metadata table with `_require_channel_admin` RBAC and a published+visibility predicate), and
`apps/api/src/db/trail_runs.py` (existing per-user course-completion tracking — `TrailRun`/`TrailStep`, unrelated
to assignments).

**Scope confirmed with the user before this decision** (two roadmap items were ambiguous enough to be
consequential — see `CLAUDE.md`'s "stop and ask" rule): "Question bank" means a **real, reusable pool of
questions** tagged by subject/topic/level that can be pulled into more than one quiz, not just a quiz's own
private question list. "Exam practice" means a **distinct timed practice-session experience** that can mix
questions pulled from across the bank/multiple quizzes into one timed attempt with a single combined score, not
just a relabeled quiz.

**1. `Question`/`Quiz`, not a repurposed `Assignment`.** LearnHouse's `Assignment` stack is a complete, working
quiz engine on paper (`AssignmentTaskTypeEnum.QUIZ`, grading, retries, `show_correct_answers`) with a full
authoring + student-taking UI already shipped — reusing it was the default instinct. It does not fit the
confirmed scope, though, for two structural reasons, not preference:
- **`AssignmentTask` has no cross-assignment identity.** Every task row belongs to exactly one `Assignment`
  (`assignment_id` FK, no other owner), and the entire grading/retry/`AssignmentUserSubmission` pipeline is built
  around "one assignment, graded as a whole." Making a task reusable across assignments — the entire point of
  "Question bank" as scoped — would mean either duplicating each question's row per quiz it's used in (defeats
  "reusable": editing a question wouldn't propagate) or restructuring `AssignmentTask`'s ownership model into a
  many-to-many shape, which risks regressing the existing, already-shipped teacher-facing assignment/grading
  product for a requirement (channel-level exam-prep quizzes) that product was never designed for.
- **`Assignment` is hard-wired to `Course`/`Chapter`/`Activity`** (`org_id`/`course_id`/`chapter_id`/`activity_id`
  all required, non-nullable). Phase 2A/5A already hit this exact wall for videos and PDFs and solved it with a
  lazily-created hidden container course per channel. A third container-course workaround would be reasonable for
  a single "Quiz as Activity," but the Exam Practice requirement — pull questions from multiple quizzes/subjects
  into one timed session — has no `Activity` shape at all; an exam-practice attempt isn't "one Activity," it's a
  cross-cutting query over the question bank. Bending `Assignment` to fit would cost more code than a small,
  purpose-built domain.
- Decision: add a new, purpose-built `Question`/`Quiz` domain, channel-scoped exactly like `ChannelVideo`/
  `ChannelResource` (`org_id` FK, `_require_channel_admin` RBAC, published+visibility predicate for public
  listing) — but **not** a thin wrapper over an existing `Activity`, because there is no existing quiz-taking
  infrastructure this domain can delegate its actual behavior (grading, timing, attempt history) to without the
  restructuring above. This is a deliberate departure from the Phase 2A/5A "thin discovery layer over `Activity`"
  pattern, made explicit here rather than silently copied where it doesn't fit.

```
Organization (channel)
      │  org_id (FK, CASCADE)
      ├──────────────► Question (bank item: prompt, contents, subject/topic/level, published)
      │                     ▲
      │                     │ question_id (FK, CASCADE)
      └──────────────► Quiz ── QuizQuestion (join: quiz_id, question_id, order) ──► Question
                          │  quiz_type: "standard" | "exam_practice", time_limit_minutes
                          │
                          ▼
                    QuizAttempt (user_id, status, score_percentage, started_at, submitted_at)
                          │
                          ▼
                    QuizAnswer (quizattempt_id, question_id, answer, is_correct)
```

**Proposed schema** (not yet created — no migration, no model file written; 6B implements `Question` only, see
below):

`Question` — the bank item, channel-scoped, reusable across quizzes:

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `question_uuid` | `str`, indexed | Public identifier, matching `channelresource_uuid`'s convention |
| `org_id` | `int`, FK → `organization.id`, `ondelete="CASCADE"`, indexed | Channel ownership — bank items are not shared cross-channel, same as every other channel content type |
| `question_type` | `str` | Plain growable string (`"multiple_choice"` \| `"short_answer"` \| `"number_answer"`), same convention as `ChannelVideo.content_format`/`ChannelResource.resource_type` — not a DB enum, so a new auto-gradable type doesn't need a migration |
| `prompt` | `str` | The question text |
| `contents` | `Dict`, JSON column | Type-specific payload: `{"options": [{"id", "text", "is_correct"}, ...]}` for `multiple_choice`, `{"accepted_answers": [...]}` for `short_answer`/`number_answer`. Mirrors `AssignmentTaskBase.contents`'s proven polymorphic-JSON convention rather than inventing per-type columns |
| `explanation` | `str \| None` | Shown only after an attempt is graded (see visibility rules below) |
| `subject` / `topic` / `level` / `institution_context` | `str \| None` | Same free-text convention as `ChannelResource` |
| `published` | `bool`, default `False` | Draft questions are excluded from the quiz-authoring picker and can never be attached to a quiz; same admin-only draft/live convention as every other channel content type |
| `creation_date` / `update_date` | `str` | `str(datetime.now())` convention, matching `ChannelResource` |

No `resource_type`/`year` fields (that vocabulary belongs to Phase 5's document resources, not quiz questions).
No per-question point-weight column — V1 scores every question equally (1 point); a weighting column is a
speculative addition with no current requirement, following the "don't design for hypothetical future
requirements" rule.

`Quiz` — the channel-facing container a student actually opens:

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `quiz_uuid` | `str`, indexed | |
| `org_id` | `int`, FK → `organization.id`, `ondelete="CASCADE"`, indexed | |
| `title` / `description` | `str` / `str \| None` | |
| `quiz_type` | `str`, default `"standard"` | `"standard"` \| `"exam_practice"` — same plain-string discriminator convention as `ChannelVideo.content_format` (Phase 3A). One entity for both roadmap items rather than two near-identical tables: an exam-practice quiz is a `Quiz` whose `QuizQuestion` set was deliberately assembled across subjects/topics from the bank and which carries a `time_limit_minutes` — no separate orchestration entity needed |
| `time_limit_minutes` | `int \| None` | Primarily set for `exam_practice`, but not restricted to it |
| `subject` / `topic` / `level` / `institution_context` | `str \| None` | Quiz-level classification for channel discovery/filtering cards, same convention as `ChannelVideo`/`ChannelResource` — individual questions may vary (especially for `exam_practice`), this is the card-level tag |
| `pass_threshold_percentage` | `float \| None` | Mirrors `Assignment.pass_threshold_percentage`'s nullable-default convention |
| `published` | `bool`, default `False` | |
| `visibility` | `str`, default `"public"` | Same `"public"` \| `"unlisted"` convention as `ChannelVideo`/`ChannelResource` |
| `creation_date` / `update_date` | `str` | |

`QuizQuestion` — ordered join, the only place a `Question`'s bank membership in a given `Quiz` is recorded:

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `quiz_id` | `int`, FK → `quiz.id`, `ondelete="CASCADE"`, indexed | |
| `question_id` | `int`, FK → `question.id`, `ondelete="CASCADE"`, indexed | |
| `order` | `int` | Display order within the quiz |
| — | `UniqueConstraint(quiz_id, question_id)` | A question can't be added to the same quiz twice |

`QuizAttempt` — one row per attempt, **not** reset-in-place like `AssignmentUserSubmission`:

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `quizattempt_uuid` | `str`, indexed | |
| `quiz_id` | `int`, FK → `quiz.id`, `ondelete="CASCADE"`, indexed | |
| `user_id` | `int`, FK → `user.id`, `ondelete="CASCADE"`, indexed | |
| `status` | `str` | `"in_progress"` \| `"submitted"` \| `"graded"` — simplified vs. `AssignmentUserSubmissionStatus` (no `LATE`/`NOT_SUBMITTED`: quizzes have no due date in V1) |
| `score_percentage` | `float`, default `0.0` | |
| `attempt_number` | `int`, default `1` | |
| `started_at` / `submitted_at` | `str` / `str \| None` | |

Deliberate departure from `AssignmentUserSubmission`'s unique-per-`(user, assignment)` reset-in-place pattern:
`QuizAttempt` has **no** unique constraint on `(user_id, quiz_id)` — every attempt is its own row. Roadmap items
"Results" and "Basic progress tracking" both need attempt *history* (score over time, most recent vs. best
attempt), which a reset-in-place row structurally cannot provide. This is the same trade-off Phase 4A already
made explicitly for `ChannelVideoShare` (append-only log, no uniqueness) vs. `ChannelVideoLike` (toggle, unique)
— the shape follows what the data is for, not a blanket copy of one precedent.

`QuizAnswer` — one row per `(attempt, question)`:

| Field | Type | Notes |
|---|---|---|
| `id` | `int`, PK | |
| `quizattempt_id` | `int`, FK → `quizattempt.id`, `ondelete="CASCADE"`, indexed | |
| `question_id` | `int`, FK → `question.id`, `ondelete="CASCADE"`, indexed | |
| `answer` | `Dict`, JSON column | Mirrors `AssignmentTaskSubmission.task_submission`'s convention |
| `is_correct` | `bool`, default `False` | Computed at submit time by auto-grading (all three V1 question types are auto-gradable — no manual grading path, unlike `Assignment`) |
| — | `UniqueConstraint(quizattempt_id, question_id)` | |

**2. RBAC and visibility — reuses the Phase 5B pattern exactly, extended with an attempt-time gate.**
- `Question`/`Quiz` create/update/publish/delete: `_require_channel_admin` (unchanged import from
  `channel_resources.py`'s pattern), scoped to `org_id` — a `Quiz`'s `QuizQuestion` rows may only reference
  `Question`s already belonging to that same `org_id` (404 on cross-org `question_id`, identical anti-enumeration
  shape to Phase 5B's cross-org `activity_id` check).
- `Quiz` listing/get: public/anonymous viewers see `published == True AND visibility == "public"` only; the
  channel's own admins see everything (drafts, unlisted) — identical predicate to `ChannelResource`.
  `Question` bank items are **never** listed to non-admins directly (there is no public "browse the question
  bank" surface in the confirmed scope) — only reachable indirectly through a published `Quiz`'s questions, and
  even then with `contents`'s correct-answer data and `explanation` stripped (see below).
- Taking a quiz (`QuizAttempt` start/submit): any authenticated user, same auth-required-no-role-check convention
  as Like/Save/Comment (Phase 4B/4C/4D) — 401 for anonymous. The channel's own admin may attempt their own draft
  quiz (preview), same "owner-can-X-own-draft" precedent already established for videos/resources.
  `is_org_admin` is still checked once per attempt-start, not cached client-side.
- **Correct-answer/explanation leak prevention (new gate, no existing precedent to reuse — closest analogue is
  `Assignment.show_correct_answers`):** the question-serialization path used while a quiz is in progress
  (fetching questions to render, or any state before that specific `QuizAttempt` is `"graded"`) must strip
  `is_correct` from each `contents.options` entry and omit `explanation` entirely. Only the post-submit grading
  response (per-answer `is_correct`, and the full `Question` including `explanation`) reveals them, and only for
  that user's own attempt. This is stricter than `Assignment`'s opt-in `show_correct_answers` flag — there is no
  "leave it hidden forever" mode needed in the confirmed scope, so no extra toggle is added.

**3. "Basic progress tracking" — aggregation over `QuizAttempt`, not a new table.** LearnHouse's existing
`TrailRun`/`TrailStep` (`apps/api/src/db/trail_runs.py`) tracks *course* completion and has no notion of a quiz
attempt or a score — confirmed unrelated, not reusable here. A per-user progress view (attempts taken, best/most
recent score per quiz, completion over time) is a read-only query over `QuizAttempt`/`QuizAnswer`, deferred to
its own increment (tracked below) rather than a new persisted table — there is nothing here that isn't already
derivable from the attempt history once it exists.

**4. No new container course, no `Activity` involvement at all.** Unlike Phases 2A/5A, nothing in this domain
uploads a file or needs `content_files.py`'s access-control path — a `Question`'s `contents` is plain JSON on the
row itself. This is the reason a from-scratch domain is cheaper here than another `Activity`-wrapping layer would
have been.

**Explicitly deferred (not part of 6A, tracked for 6B onward — see `docs/PROGRESS.md` for the increment
breakdown):** all model files, migrations, service/router layers, and every frontend surface (bank authoring,
quiz authoring/question-picker, student quiz-taking, exam-practice timer UI, results view, progress view). 6B
implements `Question` (the bank) end-to-end first, since `Quiz`/`QuizQuestion` depend on it existing; `Quiz`
authoring, then attempt-taking/grading, then the exam-practice timer mode, then Results, then progress tracking
follow as separate increments in that dependency order. Cross-channel question sharing, AI-assisted question
generation (LearnHouse already has `routers/ai/assignment_gen.py` as a precedent to revisit if this is wanted
later, not evaluated here), and manual/partial-credit grading are out of scope for Phase 6 entirely (no ROADMAP
item, no PRD signal, and the confirmed scope is auto-gradable question types only).

### Exams & Practice (Phase 6D) — QuizAttempt/QuizAnswer, attempt-taking + auto-grading

Implements the `QuizAttempt`/`QuizAnswer` tables exactly as spec'd in the 6A decision above
(`apps/api/src/db/quiz_attempts.py`, `apps/api/src/services/orgs/quiz_attempts.py`), plus the two concrete
decisions the 6A spec left open: the per-question-type answer JSON shape, and one correction to the leak-
prevention gate's stated scope.

**1. Answer JSON contract** (`QuizAnswer.answer`, submitted per question in `QuizAttemptSubmit.answers`):

| `question_type` | Submitted `answer` shape | Grading rule |
|---|---|---|
| `multiple_choice` | `{"selected_option_id": <id>}` | Correct iff `selected_option_id` is in the set of `contents.options` entries with `is_correct: true` — supports questions with more than one correct option without extra schema, since selecting any one of them grades correct |
| `short_answer` | `{"text": <string>}` | Case-insensitive, trimmed match against any entry in `contents.accepted_answers` |
| `number_answer` | `{"value": <number>}` | Float-equality match against any entry in `contents.accepted_answers` (both sides coerced via `float()`) |

A question with no submitted answer, an unparseable value, or an unrecognized `question_type` is graded
`is_correct: false` — there is no partial credit or manual-override path in V1 (see 6A's explicit scope note
above).

**2. Leak-prevention gate, extended:** the 6A decision's stated rule ("strip `is_correct` from each
`contents.options` entry and omit `explanation`") described the `multiple_choice` case, where the option *text*
is meant to stay visible. It under-specified `short_answer`/`number_answer`: for those types, `contents.
accepted_answers` **is** the entire answer key, not just a flag on visible content — so `_strip_question` in
`quiz_attempts.py` removes that key wholesale, in addition to stripping `options[].is_correct` and omitting
`explanation`. Applied identically in the student-view question list on `start_quiz_attempt` and on
`get_quiz_attempt` while `status != "graded"`. The gate lifts only in `submit_quiz_attempt`'s response and a
subsequent `get_quiz_attempt` once `status == "graded"`, and only for that attempt's own user (ownership enforced
by comparing `QuizAttempt.user_id` to the acting user — 403, not 404, on mismatch, since the attempt's existence
isn't itself sensitive to its owner's peers the way cross-org content is).

**3. `attempt_number` and status transitions.** `attempt_number` is computed at `start_quiz_attempt` time as
`count(existing attempts by this user for this quiz) + 1` — no separate counter column, consistent with 6A's
"every attempt is its own row" design for Results (6G)/progress tracking (6H). Because all V1 question types are
auto-gradable (6A), `submit_quiz_attempt` moves `status` directly from `"in_progress"` to `"graded"` in one
transaction — the `"submitted"` status value from 6A's schema is reserved for a manual-grading path that doesn't
exist in V1, so it's never actually written by this increment.

### Parents (Phase 7A) — `is_parent` as a plain boolean column on `User`, not a global `Role`

No global account-type/persona concept existed on `User` before this — `Role`/`RoleTypeEnum` (`db/roles.py`) is
per-organization (ADMIN/INSTRUCTOR/etc.), and `TYPE_GLOBAL` roles are a fixed, admin-managed set seeded in
`services/setup/setup.py`, not something a user can self-assign. "Parent account capability" needs to be
self-service and global (a parent isn't scoped to one channel/org), so it's a new `is_parent: bool = False`
field on `UserBase` (`apps/api/src/db/users.py`) instead — it lands on `User` (table), `UserCreate`, `UserUpdate`,
and `UserRead` automatically, and is deliberately **not** added to `UserReadPublic`, which doesn't inherit
`UserBase` and is what other users see when looking someone up (no reason yet for a parent flag to be visible to
anyone but the account holder).

No new endpoint: the existing `PUT /users/{user_id}` → `update_user()` (`services/users/users.py:523`) already
does a generic `model_dump(exclude_unset=True)` set-attr loop gated by a `_PROTECTED_FIELDS` denylist and existing
RBAC (`rbac_check` — self-update always allowed via the `user_uuid` match, cross-user update requires the existing
roles/authorship check). `is_parent` was deliberately left off `_PROTECTED_FIELDS` since it's meant to be
self-settable, the same way `bio`/`avatar_image` are.

Setting the flag alone grants no new access — it carries no relationship and no cross-user visibility. That's
7B (parent-child relationship, decided as a child-approves-parent's-request flow, modeled on
`OrganizationFollow`'s join-table pattern but consent-gated) and 7C (activity view, likely extending 6H's
per-org `get_org_quiz_progress` with an authorized target-user parameter). 7B's backend is now built (below);
7C is not.

### Parents (Phase 7B, backend) — `parentchildlink` join table with a status enum, not a reused `Notification`

The relationship table (`apps/api/src/db/parent_child_links.py`) follows `OrganizationFollow`'s shape — `id`,
an FK pair (`parent_user_id`/`child_user_id` → `user.id`, CASCADE), a `*_uuid`, dates — with a
`UniqueConstraint(parent_user_id, child_user_id)` so a pair has exactly one row, ever; re-requesting after a
rejection flips that row back to `PENDING` rather than accumulating duplicates. Unlike `OrganizationFollow`
(a bare boolean follow/unfollow), this relationship needs an intermediate consent state, so it takes
`ResourceAuthor`'s status-enum convention instead: `ParentChildLinkStatusEnum` (`PENDING`/`APPROVED`/
`REJECTED`), stored as a native Postgres enum type (`parentchildlinkstatusenum`) to match how
`resourceauthorshipstatusenum` is done, not a plain string column — SQLModel's own `create_all` (used by the
local dev bootstrap and by tests) generates a native enum for a Python `Enum` field by default, so a
hand-written migration using `sa.String()` here would silently diverge from what the ORM actually produces.

**Child identification**: the parent supplies the child's **username**, not email — a decision made explicitly
to reuse the existing enumeration-protection convention (`read_user_by_username`'s generic-404,
auth-required lookup, `routers/users.py`) rather than inventing new email-lookup logic with its own exposure
surface. `request_parent_link` 404s with a generic message ("Resource not found") on an unknown username, the
same wording `read_user_by_username` uses, so the two code paths can't be distinguished by response shape.

**Why not the existing `Notification` table**: `db/notifications.py`'s `Notification` has a hard, non-nullable
FK to `channelvideo_id` — deliberately single-purpose, no polymorphic `content_type`/`content_id` association
(see § "Basic Notifications (Phase 4H)" above). A parent-link request has no `ChannelVideo`, so reusing it would
require either loosening that FK to nullable or adding a second nullable FK — itself an architecture change
bigger than this increment's scope. Instead, discovery is poll-based: `GET /users/parent-links/pending` lists
PENDING requests where the caller is the child. A push notification integration is left as a clearly separate,
optional future addition, not folded into 7B.

**Endpoints live on `/users`, not `/orgs/{org_id}`**: this relationship is user-to-user and global, the same
reason `is_parent` (7A) is a plain `User` column rather than anything org-scoped. Three new endpoints on the
existing `routers/users.py`: `POST /parent-links/request`, `GET /parent-links/pending`, `POST
/parent-links/{link_uuid}/respond`.

**IDOR guard on respond**: `respond_to_parent_link` 404s (not 403) when the caller isn't the link's
`child_user_id` — including when the caller is the *parent* who created the request — so a caller can't use the
status code to distinguish "this link isn't yours" from "this link doesn't exist." Matches the existing
`_get_own_notification_or_404` pattern in `services/notifications/notifications.py`.

**Scope decision**: per-user request (this session), 7B ships backend-only, mirroring 7A — no settings-page UI
yet for either the `is_parent` toggle or the request/approve flow. `docs/PROGRESS.md` item 13 has the full
implementation/verification record, including a dev-environment gotcha: the local `uvicorn --reload` process
calls `SQLModel.metadata.create_all` on every reload (`src/core/events/database.py::_bootstrap_schema`), which
creates missing *tables* but not missing *columns* — worth knowing before running live `alembic
upgrade`/`downgrade` testing against a dev DB that reload process is also touching.

### Two personal-account-settings surfaces exist — the org-scoped one is the live one in this deployment

`apps/web/app` has two separate "manage your own account" implementations, and it matters which one a new
settings UI is added to:

- **`app/(hub)/account/page.tsx`** — a full-screen, non-org-scoped page (`AccountGeneral`/`AccountSecurity`/
  a danger zone). Its `(hub)/layout.tsx` gates it to SaaS: `if (mode === 'oss' || mode === 'ee') notFound()`.
  Inherited from upstream LearnHouse's cloud offering (billing/org-lifecycle hub).
- **`app/orgs/(withmenu)/[orgslug]/account/[subpage]/page.tsx`** — org-scoped, server-rendered, backed by
  `AccountClient`/`AccountSidebar`/`AccountActionsMobile` with subpages `general`/`profile`/`security`/
  `purchases`. This is what actually renders when a browser requests `/account` in this project's local dev
  environment (`hosting_config.tenancy: single`, per the Multi-tenancy note in `CLAUDE.md`): single-tenancy
  collapses bare account-settings paths onto the seeded default org's routing, so the org-scoped page is what a
  self-hosted LearnOrbit instance's users actually see, independent of `mode` (this dev environment in fact runs
  `mode: saas`, so the hub page isn't even 404'd here — it's simply not the route real navigation resolves to).

`AccountGeneral`/`AccountSecurity`/`AccountDangerZone` are shared components mounted by *both* pages, so reuse
decisions made against one still apply to the other. But a **new** settings section only reaches real users if
it's wired into the org-scoped surface's three places: `AccountSidebar.tsx` (`NAV_ITEMS`), `AccountClient.tsx`
(`renderSubpage`/title map), and `account/[subpage]/page.tsx`'s `VALID_SUBPAGES`/title map — `AccountActionsMobile.tsx`
too, for the mobile bottom bar. Phase 7B-frontend (`docs/PROGRESS.md` item 14) initially wired `AccountFamily`
into the hub page based on a grep hit alone; live browser verification caught the mismatch (the page never
rendered) before it shipped. Check which surface a browser actually reaches — don't assume from file discovery —
before adding to either one.

### Parents (Phase 7C) — cross-org child progress, not an extended per-org endpoint

`get_child_quiz_progress` (`apps/api/src/services/users/child_progress.py`) deliberately does **not** extend
6H's `get_org_quiz_progress` with a target-user parameter, despite 7A/7B's own forward note suggesting that
path. Reason: `get_org_quiz_progress` needs an `org_id`, and there is no endpoint anywhere that lets one user
list *another* user's org memberships (`GET /orgs/{page}/{limit}` is hard-wired to `current_user.id`) — building
one just so a parent could pick a channel would be real scope creep for a "basic" view. Instead this is a new,
purpose-built read: `QuizAttempt` joined `Quiz` joined `Organization`, filtered to the child's `user_id` with
**no** org filter, each row tagged with its org's name/slug for context. Authorization is a `ParentChildLink`
check (`APPROVED`, caller as `parent_user_id`), not org scoping — a 404 (not 403) on failure, matching
`respond_to_parent_link`'s existing IDOR convention (`_require_approved_link` in the same file).

Two new endpoints on `/users` (same placement rationale as 7B — user-to-user, global): `GET
/parent-links/mine` (a router endpoint finally added for `list_my_parent_links`, which 7B built and left
completely untested/unwired) and `GET /parent-links/children/{child_user_id}/quiz-progress`.

**Frontend gotcha — a failed query can get stuck "paused" forever if it retries.** `useChildQuizProgress`
originally used the app's default `useQuery` retry (`retry: 1` from `lib/query/client.ts`). Live browser
verification of the unauthorized-child path (a 404) never resolved to an error state — `fetchStatus` cycled
`paused ↔ fetching` indefinitely, `status` stuck at `pending`, and the component's `isLoading`/`isError` guards
both stayed false in between attempts, silently falling through to the "no activity yet" empty state instead of
"can't show this activity." A raw `fetch()` to the same URL (bypassing react-query) returned the 404 cleanly, so
the response itself was never the problem. Root-caused to the query's retry path, not to anything in this
increment's authorization logic. Fix: `retry: false` on `useChildQuizProgress` — a 404 here means "no approved
link," a fixed authorization fact that retrying can never change, so retrying only delays the correct UI state.
Any future query whose error path represents a permanent authorization/existence fact (rather than a transient
failure) should set `retry: false` for the same reason.

**Child identification in the URL**: `child_user_id` (numeric), not username — already known from the "Linked
family" list's own `ParentChildLink.child_user_id`, so using it avoids an extra username-resolution endpoint
purely for cosmetic URLs (decided with the user during 7C's planning pass, alongside the cross-org-vs-per-org
choice above).

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
