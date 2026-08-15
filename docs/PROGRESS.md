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
Phase 1A (Channel Foundation) complete. Next: channel profile UI / gating follow-ups, then Phase 1's remaining items (channel page, follow/subscribe).

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

## Important Decisions
- Product name: LearnOrbit
- Tagline: Where learning connects.
- Primary coding agent: Claude Code
- Token-saving development workflow: inspect → implement one feature → test → commit
- Reuse existing LearnHouse functionality before creating new systems
- Channels reuse `Organization` directly (extended, not a new entity) — see
  `docs/ARCHITECTURE.md`.

## Next Actions
1. Design the channel profile page/UI on top of `channel_type`.
2. Consider whether any further tenant-only features need INSTRUCTOR gating
   (signup fields, invites, billing caps) — deliberately left ungated in
   Phase 1A to keep the change small.
3. Follow/subscribe system (not yet started).
4. Educational video/Shorts models (Phase 2/3, not started).
5. Commit Phase 1A changes.
