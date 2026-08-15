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
