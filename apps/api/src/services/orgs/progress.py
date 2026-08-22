"""
Basic Progress Tracking (Phase 6H) — a read-only aggregation over the
existing `QuizAttempt`/`Quiz` tables. No new table: everything here is
already derivable from attempt history, per docs/ARCHITECTURE.md §
"Exams & Practice (Phase 6A)" point 3 (`TrailRun`/`TrailStep` was
investigated there and confirmed unrelated — course completion, not quiz
attempts/scores).

Scoped like every other Phase 6 student surface: one channel (org_id) at a
time, and only the acting user's own attempts — never another user's, never
another org's quizzes. Only quizzes the user has actually attempted appear;
this is an aggregation over existing engagement, not a catalog of every quiz
in the channel.
"""

from typing import Optional

from fastapi import HTTPException, Request
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization
from src.db.quiz_attempts import QuizAttempt
from src.db.quizzes import Quiz
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id


class QuizProgressSummary(SQLModel):
    """One quiz's worth of the acting user's own progress — attempts taken,
    best/most-recent graded score, and the timestamp of their last activity
    on it (used both for display and for sorting this list)."""
    quiz_id: int
    quiz_title: str
    pass_threshold_percentage: Optional[float] = None
    attempts_taken: int
    # None when every attempt on this quiz is still in_progress — there is
    # no graded score yet, distinct from a genuine 0%.
    best_score_percentage: Optional[float] = None
    most_recent_score_percentage: Optional[float] = None
    most_recent_attempt_at: str


def _require_authenticated(current_user: PublicUser | AnonymousUser) -> int:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    return resolve_acting_user_id(current_user)


async def get_org_quiz_progress(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> list[QuizProgressSummary]:
    org = (await db_session.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    acting_user_id = _require_authenticated(current_user)

    # SECURITY: joined on Quiz.org_id so an attempt on another org's quiz can
    # never leak into this org's progress view, and filtered to this user's
    # own attempts so no one else's progress is ever visible here.
    rows = (await db_session.execute(
        select(QuizAttempt, Quiz)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(Quiz.org_id == org.id, QuizAttempt.user_id == acting_user_id)
        .order_by(QuizAttempt.quiz_id.asc(), QuizAttempt.attempt_number.asc())
    )).all()

    by_quiz: dict[int, tuple[Quiz, list[QuizAttempt]]] = {}
    for attempt, quiz in rows:
        by_quiz.setdefault(quiz.id, (quiz, []))[1].append(attempt)

    summaries = []
    for quiz, attempts in by_quiz.values():
        graded = [a for a in attempts if a.status == "graded"]
        most_recent_attempt = max(attempts, key=lambda a: a.attempt_number)
        most_recent_graded = max(graded, key=lambda a: a.attempt_number) if graded else None
        summaries.append(QuizProgressSummary(
            quiz_id=quiz.id,
            quiz_title=quiz.title,
            pass_threshold_percentage=quiz.pass_threshold_percentage,
            attempts_taken=len(attempts),
            best_score_percentage=max((a.score_percentage for a in graded), default=None),
            most_recent_score_percentage=most_recent_graded.score_percentage if most_recent_graded else None,
            most_recent_attempt_at=most_recent_attempt.started_at,
        ))

    summaries.sort(key=lambda s: s.most_recent_attempt_at, reverse=True)
    return summaries
