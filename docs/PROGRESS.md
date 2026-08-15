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
**Phase 1 — Channels**

## Current Task
Phase 1A (Channel Foundation), Phase 1B (Channel Creation & Profile), and
Phase 1C (Channel Following) complete. Next: videos/Shorts (Phase 2/3).

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

## Important Decisions
- Product name: LearnOrbit
- Tagline: Where learning connects.
- Primary coding agent: Claude Code
- Token-saving development workflow: inspect → implement one feature → test → commit
- Reuse existing LearnHouse functionality before creating new systems
- Channels reuse `Organization` directly (extended, not a new entity) — see
  `docs/ARCHITECTURE.md`.
- Following is a dedicated `organizationfollow` table, not `UserOrganization`
  — a follow carries no `Role`/membership, so reusing the membership table
  would have conflated "subscribed to a channel's updates" with "has a role
  in this org." See `docs/ARCHITECTURE.md`.

## Next Actions
1. Consider whether any further tenant-only features need INSTRUCTOR gating
   (signup fields, invites, billing caps) — deliberately left ungated in
   Phase 1A to keep the change small.
2. Educational video/Shorts models (Phase 2/3, not started).
3. Commit Phase 1A + Phase 1B + Phase 1C changes.
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
