"""A parent's read-only view of a linked child's quiz activity (Phase 7C).

Unlike `services/orgs/progress.py`'s `get_org_quiz_progress` (self-only, one
channel at a time), this is deliberately cross-org: a parent doesn't know —
and shouldn't need to pick — which channel a child's quizzes live in, and no
"list a user's org memberships" endpoint exists for anyone but yourself. So
this aggregates `QuizAttempt`/`Quiz` across every org at once, tagging each
row with its org's name/slug for context, gated by an APPROVED
`ParentChildLink` rather than org scoping. See docs/ARCHITECTURE.md §
"Parents (Phase 7C)" for the decision trail.
"""

from typing import Optional, Union

from fastapi import HTTPException, Request
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.parent_child_links import ParentChildLink, ParentChildLinkStatusEnum
from src.db.quiz_attempts import QuizAttempt
from src.db.quizzes import Quiz
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id


class ChildQuizProgressSummary(SQLModel):
    """One quiz's worth of a linked child's progress — same shape as
    `QuizProgressSummary` (6H) plus the org it belongs to, since this view
    isn't scoped to a single channel."""
    quiz_id: int
    quiz_title: str
    pass_threshold_percentage: Optional[float] = None
    attempts_taken: int
    best_score_percentage: Optional[float] = None
    most_recent_score_percentage: Optional[float] = None
    most_recent_attempt_at: str
    org_id: int
    org_name: str
    org_slug: str


async def _require_approved_link(
    current_user: Union[PublicUser, AnonymousUser],
    child_user_id: int,
    db_session: AsyncSession,
) -> int:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    parent_id = resolve_acting_user_id(current_user)

    link = (
        await db_session.execute(
            select(ParentChildLink).where(
                ParentChildLink.parent_user_id == parent_id,
                ParentChildLink.child_user_id == child_user_id,
                ParentChildLink.status == ParentChildLinkStatusEnum.APPROVED,
            )
        )
    ).scalars().first()
    if not link:
        # SECURITY: 404, not 403 — matches respond_to_parent_link's IDOR
        # guard. A caller can't distinguish "not your child" from "no such
        # link exists at all."
        raise HTTPException(status_code=404, detail="Resource not found")
    return parent_id


async def get_child_quiz_progress(
    request: Request,
    child_user_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> list[ChildQuizProgressSummary]:
    await _require_approved_link(current_user, child_user_id, db_session)

    rows = (await db_session.execute(
        select(QuizAttempt, Quiz, Organization)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .join(Organization, Organization.id == Quiz.org_id)
        .where(QuizAttempt.user_id == child_user_id)
        .order_by(QuizAttempt.quiz_id.asc(), QuizAttempt.attempt_number.asc())
    )).all()

    by_quiz: dict[int, tuple[Quiz, Organization, list[QuizAttempt]]] = {}
    for attempt, quiz, org in rows:
        by_quiz.setdefault(quiz.id, (quiz, org, []))[2].append(attempt)

    summaries = []
    for quiz, org, attempts in by_quiz.values():
        graded = [a for a in attempts if a.status == "graded"]
        most_recent_attempt = max(attempts, key=lambda a: a.attempt_number)
        most_recent_graded = max(graded, key=lambda a: a.attempt_number) if graded else None
        summaries.append(ChildQuizProgressSummary(
            quiz_id=quiz.id,
            quiz_title=quiz.title,
            pass_threshold_percentage=quiz.pass_threshold_percentage,
            attempts_taken=len(attempts),
            best_score_percentage=max((a.score_percentage for a in graded), default=None),
            most_recent_score_percentage=most_recent_graded.score_percentage if most_recent_graded else None,
            most_recent_attempt_at=most_recent_attempt.started_at,
            org_id=org.id,
            org_name=org.name,
            org_slug=org.slug,
        ))

    summaries.sort(key=lambda s: s.most_recent_attempt_at, reverse=True)
    return summaries
