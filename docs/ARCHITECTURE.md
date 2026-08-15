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
