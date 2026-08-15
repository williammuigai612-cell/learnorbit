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
