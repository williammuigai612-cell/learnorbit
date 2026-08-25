"""
Question service — the channel-scoped exam-prep question bank (Phase 6B).

See docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" for the full
decision. This is a purpose-built domain, not a thin wrapper over an
existing Activity: a Question is reusable across many Quizzes (a later
increment), so it is not published/served as its own standalone piece of
content the way ChannelVideo/ChannelResource are — only channel owner/admins
can ever list or read bank items directly; non-admins only ever encounter a
Question indirectly, through a published Quiz's (sanitized) question set.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.questions import Question
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin

QUESTION_TYPES = {"multiple_choice", "short_answer", "number_answer"}


# ---------------------------------------------------------------------------
# Schemas (request/response only — the table model is db/questions.py)
# ---------------------------------------------------------------------------

class QuestionCreate(SQLModel):
    question_type: str
    prompt: str
    contents: dict = {}
    explanation: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None


class QuestionUpdate(SQLModel):
    """Partial update — only fields explicitly set on the request are applied
    (see update_question's `exclude_unset` usage); omitted fields are left
    unchanged."""
    question_type: Optional[str] = None
    prompt: Optional[str] = None
    contents: Optional[dict] = None
    explanation: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None


class QuestionPublish(SQLModel):
    published: bool


class QuestionRead(SQLModel):
    id: int
    question_uuid: str
    org_id: int
    question_type: str
    prompt: str
    contents: dict
    explanation: Optional[str] = None
    published: bool
    creation_date: str
    update_date: str
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (await db_session.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _get_question_or_404(
    org_id: int, question_id: int, db_session: AsyncSession
) -> Question:
    # SECURITY: scoped to org_id so a question can never be fetched/modified
    # through another organization's id in the path.
    question = (await db_session.execute(
        select(Question).where(
            Question.id == question_id,
            Question.org_id == org_id,
        )
    )).scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


async def _require_channel_admin(
    current_user: PublicUser | AnonymousUser, org_id: int, db_session: AsyncSession
) -> int:
    """Raise unless the acting user is an owner/admin of this channel.
    Returns the acting user's id on success. Same pattern as
    channel_resources._require_channel_admin."""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(acting_user_id, org_id, db_session):
        raise HTTPException(
            status_code=403, detail="Only this channel's owner/admins can do this"
        )
    return acting_user_id


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


def _validate_question_type(question_type: str) -> None:
    if question_type not in QUESTION_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"question_type must be one of {sorted(QUESTION_TYPES)}",
        )


# ---------------------------------------------------------------------------
# Service functions
#
# NOTE: every function here requires channel-admin auth — unlike
# ChannelVideo/ChannelResource, a Question bank item is never listed or read
# by a non-admin directly (see module docstring). Public/student access to
# quiz content happens only through a later Quiz-serving layer that strips
# is_correct/explanation, not through this service.
# ---------------------------------------------------------------------------

async def create_question(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuestionCreate,
) -> QuestionRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    _validate_question_type(data.question_type)

    if not data.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt cannot be empty")

    now = _now()
    question = Question(
        question_uuid=f"question_{uuid4()}",
        org_id=org.id,
        question_type=data.question_type,
        prompt=data.prompt,
        contents=data.contents or {},
        explanation=data.explanation,
        subject=data.subject,
        topic=data.topic,
        level=data.level,
        institution_context=data.institution_context,
        creation_date=now,
        update_date=now,
    )
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return QuestionRead.model_validate(question)


async def list_questions(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    level: Optional[str] = None,
    institution_context: Optional[str] = None,
    published: Optional[bool] = None,
    page: int = 1,
    limit: int = 50,
) -> list[QuestionRead]:
    org = await _get_org_or_404(org_id, db_session)
    # Admin-only listing — see module docstring for why this differs from
    # ChannelVideo/ChannelResource's public+admin split.
    await _require_channel_admin(current_user, org.id, db_session)

    statement = select(Question).where(Question.org_id == org.id)
    if subject is not None:
        statement = statement.where(Question.subject == subject)
    if topic is not None:
        statement = statement.where(Question.topic == topic)
    if level is not None:
        statement = statement.where(Question.level == level)
    if institution_context is not None:
        statement = statement.where(Question.institution_context == institution_context)
    if published is not None:
        statement = statement.where(Question.published == published)

    # Newest-first — same convention as list_channel_resources.
    statement = statement.order_by(Question.creation_date.desc())

    # Paginated in Phase 9B. Applied last, so the window always slices the
    # *filtered* set — filters narrow first, then the page is taken. The
    # admin gate above runs before any of this.
    statement = statement.offset((page - 1) * limit).limit(limit)

    rows = (await db_session.execute(statement)).scalars().all()
    return [QuestionRead.model_validate(r) for r in rows]


async def get_question(
    request: Request,
    org_id: int,
    question_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> QuestionRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    question = await _get_question_or_404(org.id, question_id, db_session)
    return QuestionRead.model_validate(question)


async def set_question_published(
    request: Request,
    org_id: int,
    question_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuestionPublish,
) -> QuestionRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    question = await _get_question_or_404(org.id, question_id, db_session)

    question.published = data.published
    question.update_date = _now()
    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return QuestionRead.model_validate(question)


async def update_question(
    request: Request,
    org_id: int,
    question_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuestionUpdate,
) -> QuestionRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    question = await _get_question_or_404(org.id, question_id, db_session)

    updates = data.model_dump(exclude_unset=True)
    if "prompt" in updates and not (updates["prompt"] or "").strip():
        raise HTTPException(status_code=422, detail="Prompt cannot be empty")
    if "question_type" in updates:
        _validate_question_type(updates["question_type"])

    for field, value in updates.items():
        setattr(question, field, value)
    question.update_date = _now()

    db_session.add(question)
    await db_session.commit()
    await db_session.refresh(question)
    return QuestionRead.model_validate(question)


async def delete_question(
    request: Request,
    org_id: int,
    question_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    question = await _get_question_or_404(org.id, question_id, db_session)

    # A Question that's already in use by a Quiz's QuizQuestion join will
    # cascade-delete from that join (FK ondelete="CASCADE", Phase 6A) when a
    # later increment adds Quiz — silently removing a live quiz's question is
    # an accepted V1 trade-off, same rigor already accepted for the
    # container-course race condition in Phase 2F/5A, not solved here.
    await db_session.delete(question)
    await db_session.commit()
