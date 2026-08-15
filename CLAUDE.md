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
