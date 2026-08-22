# LearnOrbit V1 Roadmap

## Phase 0 — Foundation
- [x] Clone LearnHouse
- [x] Create `learnorbit-v1` branch
- [x] Install Docker
- [x] Install Bun
- [x] Get development environment running
- [x] Map relevant existing architecture
- [x] Establish LearnOrbit branding

## Phase 1 — Channels
- [x] Define channel model
- [x] Teacher/creator channel creation
- [x] School/institution channel creation
- [x] Channel profile/page
- [x] Follow/subscribe
- [x] Channel content listing

## Phase 2 — Educational Video
- [x] Video metadata
- [x] Video upload/storage
- [x] Video processing strategy
- [x] Video player
- [x] Video page
- [x] Subject/topic metadata

## Phase 3 — Shorts
- [x] Short video upload
- [x] Vertical video viewer
- [x] Swipe/discovery experience
- [ ] Short engagement (deferred to Phase 4 — likes/comments/saves/shares/view counts; see `docs/ARCHITECTURE.md` §8)
- [x] Creator/channel attribution
- [x] Shorts channel section
- [x] Shorts navigation entry

## Phase 4 — Social Learning
- [x] Home feed
- [x] Likes
- [x] Comments
- [x] Saves
- [x] Sharing
- [x] Basic notifications

## Phase 5 — Academic Library
- [x] PDF resources
- [x] Past papers
- [x] Resource metadata
- [x] Resource search/filtering
- [x] Resource viewer/download flow

## Phase 6 — Exams & Practice
- [x] Quizzes
- [x] Question bank
- [x] Exam practice
- [x] Results
- [x] Basic progress tracking

## Phase 7 — Parents
- [x] Parent account capability
- [x] Parent-child relationship
- [x] Basic learning activity view

## Phase 8 — Trust & Moderation
- [x] Reporting (ChannelVideo/Shorts only; ChannelResource and comment reporting deferred — see docs/PROGRESS.md Phase 8A)
- [x] Content moderation workflow (admin review/resolve queue for ChannelVideo/Shorts reports only — see docs/PROGRESS.md Phase 8B)
- [x] Teacher/organization verification (superadmin-grantable `is_verified` flag + public badge only — no application/request flow, no audit trail; see docs/PROGRESS.md Phase 8C)
- [x] Basic admin tools (moderation-queue quick actions — unpublish/delete the reported video directly from `/dash/moderation`, reusing the existing Phase 2A endpoints; no new backend, no suspend/ban, no platform-wide admin surface; see docs/PROGRESS.md Phase 8D)

## Phase 9 — V1 Hardening
- [ ] Security review
- [ ] Performance review
- [ ] Accessibility review
- [ ] Mobile-responsive polish
- [ ] Testing
- [ ] Deployment plan

## Rule
Complete and test one meaningful feature before moving to the next.
