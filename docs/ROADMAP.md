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
- [x] Security review (LearnOrbit-added API surface, Phases 1–8; rate limiting and the inherited CSRF middleware gap identified but deferred — see docs/PROGRESS.md Phase 9A)
- [x] Performance review (LearnOrbit-added surface, Phases 1–8; pagination on the four unbounded list endpoints, four frontend fetch fixes, two query cleanups. The combined-engagement-endpoint and Shorts composite-index candidates were deliberately deferred pending measurement, and `videos`/`resources`/`quizzes` pagination is blocked on the filter-dropdown coupling — see docs/PROGRESS.md Phase 9B)
- [x] Accessibility review (LearnOrbit-added frontend, Phases 1–8, WCAG 2.1 AA; 6 High + 10 Medium findings
      fixed across 19 files. Static analysis only — no browser or screen-reader run, and two keyboard findings
      remain unconfirmed at runtime. Reduced-motion support and 7 Low findings deliberately deferred — see
      docs/PROGRESS.md Phase 9C)
- [x] Mobile-responsive polish (LearnOrbit-added frontend, Phases 1–8; 8 of 9 findings fixed across
      three batches — navigation reachability below lg, tablet-width "More" panel, full-viewport
      Shorts, engagement-bar wrapping, exam-timer positioning, per-dialog mobile sizing, safe-area
      padding, and DialogFooter button spacing. All live-verified at 360×640/390×844/768×1024/1024×768
      via headless Chrome. M9 — touch targets under the 44px §7 guidance (WCAG 2.5.5 is AAA) —
      intentionally deferred under 9C's Low-findings decision; see docs/PROGRESS.md Phase 9D)
- [x] Testing (gap-driven, not coverage-driven: 18 backend + 48 frontend tests across four increments —
      quiz-attempt cross-org/cross-quiz IDOR and the answer-key strip on the *resume* path, per-channel
      follow isolation, a cross-feature moderation→discovery integration file, and a query-key
      cache-isolation guard. Every security assertion mutation-checked; **no implementation code changed**,
      since every guard audited was already correct. Router-level HTTP tests for the 53 orgs-router
      endpoints and tests for thin frontend fetch wrappers are deliberately excluded as existing
      convention, and one pre-existing inherited-LearnHouse test-isolation defect was recorded but not
      fixed — see docs/PROGRESS.md Phase 9E)
- [ ] Deployment plan

## Rule
Complete and test one meaningful feature before moving to the next.
