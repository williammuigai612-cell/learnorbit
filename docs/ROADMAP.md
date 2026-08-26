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
- [x] Deployment plan (`docs/DEPLOYMENT_PLAN.md` — production architecture, environment/secrets inventory,
      migrations, Redis, storage, HTTPS, monitoring, backups, deployment/rollback procedures, CI/CD gaps and
      the final checklist. Planning pass only: no deployment infrastructure built and no production
      configuration changed. Resolves 9A's **F3 CSRF** decision **config-first** — scoping
      `LEARNHOUSE_ALLOWED_REGEXP`/`ALLOWED_ORIGINS` becomes a mandatory pre-deployment step and
      `CSRFProtectionMiddleware` registration is queued as its own increment, because the shipped
      catch-all regexp would make registration inert while 403-ing 475 mutation calls across 53 test files.
      Two deployment decisions were raised there. The `ghcr.io/learnhouse/app` registry pin in the CLI
      update path is now **resolved**: releases publish to `ghcr.io/williammuigai612-cell/learnorbit` from
      `lo-X.Y.Z` tags only, `:latest` is not published, the inherited upstream publish triggers are
      disarmed, and the CLI treats the application image as a per-deployment `appImage` setting rather than
      a hardcoded upstream path. The content-volume backup gap remains **open**. See docs/PROGRESS.md
      Phase 9F and the three Deployment entries that follow it)
- [x] First GHCR publish (`learnorbit-v1` is pushed; release tags `lo-1.0.0` (its build failed and
      published nothing), `lo-1.0.1` and `lo-1.0.2` exist. Run `32959234326` published
      `ghcr.io/williammuigai612-cell/learnorbit:1.0.2` as an OCI multi-arch manifest list — linux/amd64 +
      linux/arm64, digest `sha256:ea2200f4…`. Verified independently of the workflow: an anonymous pull
      token resolves the manifest, so package visibility is public, while `:latest` and `:1.0.0` correctly
      404. A live smoke test booted a throwaway stack from the published digest — all containers healthy in
      26s, legitimate origins reaching the application, cross-origin and origin-less mutations refused
      403, and the Next.js auth-proxy origin forwarding working end to end. The pipeline is no longer
      verified by inspection alone. See docs/PROGRESS.md, the Deployment entries)
- [ ] Production deployment (still outstanding: **nothing has been deployed anywhere**. It needs a host,
      DNS, TLS and a production environment — in particular `LEARNHOUSE_ALLOWED_REGEXP` /
      `LEARNHOUSE_ALLOWED_ORIGINS` scoped to the real domain, which the CLI now generates from the
      configured domain at install time rather than leaving on the shipped catch-all. The content-volume
      backup gap (`docs/DEPLOYMENT_PLAN.md` §9.2) and the deployment decisions recorded there remain open)

## Rule
Complete and test one meaningful feature before moving to the next.
