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

## Development Rules
- Inspect relevant existing code before modifying it.
- Make the smallest change that satisfies the requirement.
- Do not rewrite unrelated functionality.
- Do not install packages unless clearly necessary.
- Do not change the database schema without a clear requirement.
- Prefer existing LearnHouse components, services, models and APIs.
- Keep features modular and easy to test.
- Run relevant tests/type checks after meaningful changes.
- Do not make speculative refactors.
- Do not change infrastructure unless required.

## Token/Context Efficiency
- Do not perform broad repository scans for small tasks.
- Read only files relevant to the current task.
- Keep responses concise: changed files, tests, issues, next step.
- Do not repeatedly explain the whole architecture.
- Use docs/PROGRESS.md as the project state.
- Update documentation only when a meaningful decision or feature changes it.
- Before implementing a feature, check whether LearnHouse already supports part of it.

## Git
- Work on the `learnorbit-v1` branch unless explicitly instructed otherwise.
- Make focused commits after meaningful features.
- Do not reset, rebase, delete branches, or discard user changes without explicit permission.

## Product Boundaries
Do NOT add unrelated features simply because they exist in LearnHouse.
Do NOT build an algorithmic recommendation system, monetization, live streaming, or advanced parental controls in V1 unless explicitly added to the roadmap.

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
