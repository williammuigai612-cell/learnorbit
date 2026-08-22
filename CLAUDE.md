# LearnOrbit — Claude Code Instructions

## Product
LearnOrbit is an education-focused social/video platform. It connects students, teachers, schools, educational creators, and parents around academic learning and examinations.

## V1 Focus
V1 focuses ONLY on:
- Academic learning
- Educational video content
- Short-form educational videos (Shorts)
- Teacher/school/creator channels
- Student discovery and learning
- Academic PDFs, past papers and other resources
- Quizzes and exam preparation
- Basic educational community interaction

Parent participation is planned, but should not expand V1 unnecessarily.

## Core Principle
Reuse and extend existing LearnHouse functionality before creating new systems.

## Automated Development Workflow

This section is the single authoritative process for every implementation session. It supersedes and consolidates the older Development Rules / Token efficiency / Git / Session Completion Protocol / Product Boundaries split — don't look for those headings elsewhere, everything they covered lives here now.

### 1. Session Start
- Read `CLAUDE.md`.
- Read only the relevant current section of `docs/PROGRESS.md`.
- Check `git status` and recent commits.
- Identify the current phase and smallest explicitly scoped increment.
- Inspect only files directly relevant to that increment.
- Before implementing a feature, check whether LearnHouse already supports part of it; prefer existing LearnHouse components, services, models, and APIs over new ones.
- Do not reread the entire repository or unrelated documentation unless required.

### 2. Scope Control & Phase Boundary
The project's phase/increment plan (`docs/PROGRESS.md`, `docs/ROADMAP.md`) is authoritative. Treat the explicitly requested increment as the complete scope.

Before implementation:
- Identify dependencies and existing reusable patterns.
- State the intended files and implementation boundaries when the task is ambiguous.
- Do not silently begin the next phase/increment — not even when its dependencies happen to be available.
- Do not add speculative features, unrelated V1 boundary features (see Product Boundaries below), or fix unrelated bugs unless explicitly requested.
- Do not change the database schema, install packages, or introduce new infrastructure unless clearly necessary for this increment.

When a requirement conflicts with existing architecture, stop and report the conflict before making a broad architectural change.

When an increment is complete: mark it complete in `docs/PROGRESS.md` (§8), preserve the remaining documented sequence, identify the next recommended increment, and stop. Never implement multiple future increments in one pass just because their dependencies are ready.

**Product Boundaries:** Do NOT add features simply because they exist in LearnHouse. Do NOT build an algorithmic recommendation system, monetization, live streaming, or advanced parental controls in V1 unless explicitly added to the roadmap.

### 3. Implementation Workflow
For each implementation increment use:

**PLAN → RED → GREEN → REFACTOR → VERIFY → DOCUMENT**

Where tests are appropriate:
1. Write focused failing tests first.
2. Implement the minimum change required.
3. Make the tests pass.
4. Refactor only when it improves correctness/maintainability without expanding scope.

Reuse established patterns instead of creating parallel abstractions. Keep features modular and easy to test. Do not rewrite unrelated functionality.

### 4. Security
For every backend/client-server change:
- Preserve existing authentication and authorization patterns.
- Enforce authorization server-side; never trust client-provided user identity.
- Reuse existing visibility/RBAC helpers (see `apps/api/src/security/`); check ownership where applicable.
- Do not expose private/draft/unpublished data through new endpoints.
- Include security/authorization tests for new mutation endpoints.
- Do not weaken existing security controls merely to simplify implementation.

### 5. Verification
After implementation, automatically run the smallest relevant verification set. Depending on the files changed:
- focused backend tests, focused frontend tests, relevant regression tests
- Ruff for changed Python files; ESLint/`lint:strict` for changed frontend files
- TypeScript checking when practical
- `git diff --check`

Run broader/full suites when the increment affects shared infrastructure or when the phase definition requires them. Do not spend tokens repeatedly running unrelated failing tests. Never claim a test, migration, browser check, or other verification was performed unless it actually ran. Report known pre-existing failures as such, not as failures caused by the current work.

### 6. Browser Verification
When UI changes are made:
- Attempt live verification when the local environment permits it.
- If a known pre-existing infrastructure/framework blocker prevents verification (e.g. the single-tenancy localhost limitation — see Multi-tenancy note below), do not modify unrelated infrastructure merely to bypass it.
- Clearly record what was and was not verified; distinguish implementation correctness from unverified browser behavior.

### 7. Scope Review
Before finishing an increment, review `git diff`, `git status`, changed/new files, security-sensitive paths, tests, and documentation changes. Confirm no unrelated files or features were accidentally included. Use `git diff --stat` and `git diff --check` where useful.

### 8. Automatic Documentation
After a meaningful implementation increment, update `docs/PROGRESS.md` automatically before ending the session. Record concisely:
- phase/increment
- completed work
- important files/features
- tests and exact verification results
- known limitations/blockers, deferred work
- next recommended increment

Update `docs/ARCHITECTURE.md` only when the implementation introduces or changes an architectural decision, API boundary, data model, security pattern, or reusable convention. Update `docs/ROADMAP.md` only when an actual roadmap milestone/status changes. Do not perform unrelated documentation cleanup — documentation is part of the implementation increment, not a separate pass. When updating docs, read only the relevant sections of the existing files.

### 9. Session Completion Checklist
Before declaring an increment complete, automatically verify:
- [ ] Implementation complete, scope respected
- [ ] Security reviewed
- [ ] Relevant tests, lint, and type checks run
- [ ] Browser verification attempted or limitation recorded
- [ ] `git diff --check` clean
- [ ] Documentation updated where required
- [ ] Git status reviewed
- [ ] No commit made unless explicitly requested

If any applicable item cannot be completed, report it explicitly.

### 10. Git Rules
- Work on the `learnorbit-v1` branch unless explicitly instructed otherwise.
- Do not reset, rebase, delete branches, or discard user changes without explicit permission.
- Do not commit or push automatically. Only create a commit when the user explicitly requests it; only push when explicitly requested.

When the user says `commit`, `commit all`, or equivalent:
1. Review `git status` and the staged/unstaged diff.
2. Ensure documentation for the completed increment is included where appropriate.
3. Run `git diff --cached --check`.
4. Create a focused commit with a conventional commit message.
5. Verify the resulting `git status` and recent commit.
6. Do not push unless explicitly requested.

### 11. Token / Context Efficiency
- Do not perform broad repository scans for small tasks; inspect only relevant files.
- Prefer targeted searches over repository-wide searches.
- Reuse known implementation patterns; do not reread files whose relevant contents are already known.
- Do not repeat unchanged explanations or the whole architecture; do not run redundant tests.
- Keep responses, plans, and reports concise: changed files, tests, issues, next step.
- Avoid speculative investigation unrelated to the current increment.

### 12. Final Report
At the end of every meaningful implementation session, report:
- **Completed** — concise implementation summary
- **Files** — changed/created files
- **Verification** — exact tests/checks and results
- **Limitations** — anything not verified or pre-existing
- **Documentation** — docs updated
- **Git** — current status; explicitly state whether a commit was made
- **Next** — the next smallest recommended increment

Do not start the next increment automatically.

## Current Status
See `docs/PROGRESS.md`.

## Product Requirements
See `docs/PRD.md`.

## Architecture
See `docs/ARCHITECTURE.md`.

## Roadmap
See `docs/ROADMAP.md`.

## Commands

### Full dev environment (all services)
```bash
npx learnhouse dev   # spins up Postgres + Redis, installs deps, starts API/Web/Collab with hot reload
```

### Web (`apps/web`) — Next.js, run from `apps/web`
```bash
bun install
bun run dev          # next dev --turbopack
bun run build
bun run lint         # eslint, report-only (CI runs this non-blocking)
bun run lint:strict  # eslint, blocking — CI enforces this on changed files in PRs
bun test tests       # bun test runner over apps/web/tests/*.test.mjs
```

### API (`apps/api`) — FastAPI/Python, run from `apps/api`, dependency-managed with `uv`
```bash
uv sync
TESTING=true uv run pytest src/tests/ -v --tb=short --cov=src --cov-report=term-missing --cov-fail-under=25
TESTING=true uv run pytest src/tests/path/to/test_file.py::test_name -v   # single test
ruff check .                       # lint (CI pins ruff 0.15.9; ignores E501, E712 per pyproject.toml)
uv run alembic upgrade head        # apply migrations
uv run alembic revision -m "..."   # new migration — check migrations/versions/ for naming convention
```

### CLI (`apps/cli`) — Node/TypeScript, tsup + vitest
```bash
bun run build
bun run test              # unit + most suites
bun run test:integration  # separate, heavier suite
bun run test:all
```

### Collab (`apps/collab`) — Hocuspocus/Yjs real-time server
```bash
bun run dev    # tsx watch
bun run build  # tsc
```

### E2E (`apps/e2e`) — Playwright, drives a CLI-installed instance like a real user
```bash
bun run install-browsers
bun run test
bun run typecheck
```

### Lockfiles
After touching any `package.json`, `apps/api/pyproject.toml`, or a version number:
```bash
scripts/lockfiles.sh          # regenerate every lockfile
scripts/lockfiles.sh --check  # what CI runs
```
Every install in CI and Docker is frozen (`--frozen-lockfile` / `uv sync`); a manifest change without a matching lockfile update fails the build.

## Architecture

LearnOrbit is the LearnHouse open-source LMS (AGPL-3.0), forked on `learnorbit-v1` and extended in place rather than rewritten. Four apps under `apps/`:

| App | Path | Stack | Role |
|---|---|---|---|
| Web | `apps/web` | Next.js 16, React 19, Tailwind, Tiptap, Yjs | Dashboard, course player, editor, landing pages |
| API | `apps/api` | FastAPI, SQLModel, Alembic, PostgreSQL | Auth, orgs/channels, courses, payments, AI, analytics — consumed by Web, CLI, Collab |
| Collab | `apps/collab` | Hocuspocus, Yjs, WebSocket | Real-time collaborative editing sync (editor, boards) |
| CLI | `apps/cli` | Commander, Node | Setup wizard, dev environment (`npx learnhouse dev`), self-host ops (backup, update, doctor) |

Enterprise-only code lives under `apps/web/ee/` and is gated via `lib/eeGate.ts`; don't move EE-gated functionality onto the OSS path without checking the gate.

### The "extend, don't replace" pattern
LearnOrbit's product surface (channels, follows, Shorts, quizzes — see `docs/PRD.md`, `docs/ROADMAP.md`) is being built almost entirely by extending LearnHouse's existing `Organization`/course/content model, not by adding parallel tables. `docs/ARCHITECTURE.md` records each such decision with its investigation trail — read it before designing any new domain model; the answer is often "extend an existing table," not "create a new one." Already implemented this way: channels are `Organization` rows with an added `channel_type` column (`SCHOOL`|`INSTRUCTOR`), not a new `Channel` entity; channel following is a new, deliberately lightweight `organizationfollow` join table (modeled on the existing `PlaygroundReaction` pattern) rather than reusing `UserOrganization`, which carries a `Role` and would conflate membership with following.

### Backend layout (`apps/api/src`)
- `db/` — SQLModel table definitions
- `services/` — business logic, organized by domain (`orgs/`, `courses/`, `auth/`, etc.)
- `routers/` — FastAPI route handlers, mounted via `src/router.py`
- `security/` — auth, RBAC, CSRF, file validation, superadmin
- `tests/` — pytest suite, structure mirrors `services/`/`routers/`
- Migrations: `apps/api/migrations/versions/` (Alembic); runtime config in `apps/api/config/config.yaml`

### Multi-tenancy note (relevant to any org/channel work)
`Organization` is a full multi-tenant "site" — own billing plan, custom domains, branding, auth/signup config — not a lightweight profile. Local dev runs `hosting_config.tenancy: single`, which collapses all org-scoped routing onto one seeded default org; `tenancy: multi` (subdomain routing) is hard-rejected by `config.py` whenever the domain contains "localhost". Practical effect: multi-channel navigation (create a channel, then visit it by slug) can't be exercised end-to-end locally — verify via direct API calls or by toggling the default org's fields instead, and call out the gap rather than silently skipping verification.

## Project-specific docs (read before non-trivial work)
- `docs/PRD.md` — V1 product scope and explicit non-goals
- `docs/ROADMAP.md` — phased plan (Channels → Video → Shorts → Social → Library → Exams → Parents)
- `docs/ARCHITECTURE.md` — confirmed architecture decisions with rationale; append new decisions here, don't guess
- `docs/PROGRESS.md` — current phase/task and what's actually done
- `docs/DESIGN_SYSTEM.md` — visual source of truth (color tokens, typography, spacing, component usage); any UI work must follow it, extending it first if a screen needs something it doesn't define
- `docs/UI_UX_IMPLEMENTATION_PLAN.md` — phase-by-phase UI/UX build order, sequenced against `docs/ROADMAP.md`; implements the design system into the codebase, doesn't redefine it
