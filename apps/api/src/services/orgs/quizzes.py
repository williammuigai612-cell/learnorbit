"""
Quiz service — the channel-scoped quiz authoring layer (Phase 6C).

See docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" for the full
decision. A Quiz is a curated, ordered set of this channel's own published
Question bank items (Phase 6B, `services/orgs/questions.py`). `quiz_type`
("standard" | "exam_practice") covers both the "Quizzes" and "Exam practice"
roadmap items as one entity — a `Quiz` in `exam_practice` mode additionally
carries a `time_limit_minutes`.

This module is authoring-only — owner/admin throughout, including the
questions-list endpoint (it returns each Question's full `contents`,
including the answer key, mirroring the Question bank's own
admin-only-everything pattern). Student-facing attempt-taking, with the
is_correct/explanation stripping gate from the 6A decision, is a separate,
later increment (6D) — not implemented here.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.quizzes import Quiz, QuizQuestion
from src.db.questions import Question
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin
from src.services.orgs.questions import QuestionRead

QUIZ_TYPES = {"standard", "exam_practice"}


# ---------------------------------------------------------------------------
# Schemas (request/response only — the table models are db/quizzes.py)
# ---------------------------------------------------------------------------

class QuizCreate(SQLModel):
    title: str
    description: Optional[str] = None
    quiz_type: str = "standard"
    time_limit_minutes: Optional[int] = None
    pass_threshold_percentage: Optional[float] = None
    visibility: str = "public"
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None


class QuizUpdate(SQLModel):
    """Partial update — only fields explicitly set on the request are applied
    (see update_quiz's `exclude_unset` usage); omitted fields are left
    unchanged."""
    title: Optional[str] = None
    description: Optional[str] = None
    quiz_type: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    pass_threshold_percentage: Optional[float] = None
    visibility: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None


class QuizPublish(SQLModel):
    published: bool


class QuizRead(SQLModel):
    id: int
    quiz_uuid: str
    org_id: int
    title: str
    description: Optional[str] = None
    quiz_type: str
    time_limit_minutes: Optional[int] = None
    pass_threshold_percentage: Optional[float] = None
    published: bool
    visibility: str
    creation_date: str
    update_date: str
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    # Populated by the read service from a grouped query, not stored on the
    # row itself — same "populated by the read service" convention as
    # AssignmentRead.course_uuid.
    question_count: int = 0


class QuizQuestionAttach(SQLModel):
    question_id: int


class QuizQuestionReorder(SQLModel):
    # The full, currently-attached question_id set in the desired order —
    # not a partial move. See reorder_quiz_questions for the validation this
    # implies.
    question_ids: list[int]


class QuizQuestionRead(SQLModel):
    id: int
    quiz_id: int
    question_id: int
    order: int
    question: QuestionRead


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


async def _get_quiz_or_404(org_id: int, quiz_id: int, db_session: AsyncSession) -> Quiz:
    # SECURITY: scoped to org_id so a quiz can never be fetched/modified
    # through another organization's id in the path.
    quiz = (await db_session.execute(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.org_id == org_id)
    )).scalars().first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


async def _require_channel_admin(
    current_user: PublicUser | AnonymousUser, org_id: int, db_session: AsyncSession
) -> int:
    """Raise unless the acting user is an owner/admin of this channel.
    Returns the acting user's id on success. Same pattern as
    questions._require_channel_admin."""
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


def _validate_quiz_type(quiz_type: str) -> None:
    if quiz_type not in QUIZ_TYPES:
        raise HTTPException(
            status_code=422, detail=f"quiz_type must be one of {sorted(QUIZ_TYPES)}"
        )


def _validate_time_limit(time_limit_minutes: Optional[int]) -> None:
    if time_limit_minutes is not None and time_limit_minutes <= 0:
        raise HTTPException(status_code=422, detail="time_limit_minutes must be positive")


async def _question_counts(quiz_ids: list[int], db_session: AsyncSession) -> dict[int, int]:
    if not quiz_ids:
        return {}
    rows = (await db_session.execute(
        select(QuizQuestion.quiz_id, QuizQuestion.question_id).where(
            QuizQuestion.quiz_id.in_(quiz_ids)
        )
    )).all()
    counts: dict[int, int] = {}
    for quiz_id, _question_id in rows:
        counts[quiz_id] = counts.get(quiz_id, 0) + 1
    return counts


def _to_quiz_read(quiz: Quiz, question_count: int = 0) -> QuizRead:
    read = QuizRead.model_validate(quiz)
    read.question_count = question_count
    return read


# ---------------------------------------------------------------------------
# Quiz service functions
# ---------------------------------------------------------------------------

async def create_quiz(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuizCreate,
) -> QuizRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    _validate_quiz_type(data.quiz_type)
    _validate_time_limit(data.time_limit_minutes)

    if not data.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")

    now = _now()
    quiz = Quiz(
        quiz_uuid=f"quiz_{uuid4()}",
        org_id=org.id,
        title=data.title,
        description=data.description,
        quiz_type=data.quiz_type,
        time_limit_minutes=data.time_limit_minutes,
        pass_threshold_percentage=data.pass_threshold_percentage,
        visibility=data.visibility or "public",
        subject=data.subject,
        topic=data.topic,
        level=data.level,
        institution_context=data.institution_context,
        creation_date=now,
        update_date=now,
    )
    db_session.add(quiz)
    await db_session.commit()
    await db_session.refresh(quiz)
    return _to_quiz_read(quiz, question_count=0)


async def list_quizzes(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    level: Optional[str] = None,
    institution_context: Optional[str] = None,
    quiz_type: Optional[str] = None,
) -> list[QuizRead]:
    org = await _get_org_or_404(org_id, db_session)

    viewer_is_admin = False
    if not isinstance(current_user, AnonymousUser):
        acting_user_id = resolve_acting_user_id(current_user)
        viewer_is_admin = await is_org_admin(acting_user_id, org.id, db_session)

    statement = select(Quiz).where(Quiz.org_id == org.id)
    if not viewer_is_admin:
        # Public/anonymous viewers and non-admin members only ever see
        # published, publicly-visible quizzes — same predicate as
        # list_channel_resources.
        statement = statement.where(
            Quiz.published == True,  # noqa: E712
            Quiz.visibility == "public",
        )
    if subject is not None:
        statement = statement.where(Quiz.subject == subject)
    if topic is not None:
        statement = statement.where(Quiz.topic == topic)
    if level is not None:
        statement = statement.where(Quiz.level == level)
    if institution_context is not None:
        statement = statement.where(Quiz.institution_context == institution_context)
    if quiz_type is not None:
        statement = statement.where(Quiz.quiz_type == quiz_type)

    statement = statement.order_by(Quiz.creation_date.desc())

    rows = (await db_session.execute(statement)).scalars().all()
    counts = await _question_counts([r.id for r in rows], db_session)
    return [_to_quiz_read(r, question_count=counts.get(r.id, 0)) for r in rows]


async def get_quiz(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> QuizRead:
    org = await _get_org_or_404(org_id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    counts = await _question_counts([quiz.id], db_session)
    question_count = counts.get(quiz.id, 0)

    if quiz.published and quiz.visibility == "public":
        return _to_quiz_read(quiz, question_count=question_count)

    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=403, detail="This quiz is not published")
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(acting_user_id, org.id, db_session):
        raise HTTPException(status_code=403, detail="This quiz is not published")

    return _to_quiz_read(quiz, question_count=question_count)


async def set_quiz_published(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuizPublish,
) -> QuizRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    quiz.published = data.published
    quiz.update_date = _now()
    db_session.add(quiz)
    await db_session.commit()
    await db_session.refresh(quiz)
    counts = await _question_counts([quiz.id], db_session)
    return _to_quiz_read(quiz, question_count=counts.get(quiz.id, 0))


async def update_quiz(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuizUpdate,
) -> QuizRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    updates = data.model_dump(exclude_unset=True)
    if "title" in updates and not (updates["title"] or "").strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    if "quiz_type" in updates:
        _validate_quiz_type(updates["quiz_type"])
    if "time_limit_minutes" in updates:
        _validate_time_limit(updates["time_limit_minutes"])

    for field, value in updates.items():
        setattr(quiz, field, value)
    quiz.update_date = _now()

    db_session.add(quiz)
    await db_session.commit()
    await db_session.refresh(quiz)
    counts = await _question_counts([quiz.id], db_session)
    return _to_quiz_read(quiz, question_count=counts.get(quiz.id, 0))


async def delete_quiz(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    # QuizQuestion rows are removed by the DB's ON DELETE CASCADE
    # (quizquestion.quiz_id → quiz.id, Phase 6C migration) — the underlying
    # Question bank items themselves are never touched.
    await db_session.delete(quiz)
    await db_session.commit()


# ---------------------------------------------------------------------------
# QuizQuestion service functions — attach/reorder/detach
# ---------------------------------------------------------------------------

async def _to_quiz_question_read(qq: QuizQuestion, question: Question) -> QuizQuestionRead:
    return QuizQuestionRead(
        id=qq.id,
        quiz_id=qq.quiz_id,
        question_id=qq.question_id,
        order=qq.order,
        question=QuestionRead.model_validate(question),
    )


async def list_quiz_questions(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> list[QuizQuestionRead]:
    org = await _get_org_or_404(org_id, db_session)
    # Admin-only — this response includes each Question's full contents,
    # i.e. the answer key. See module docstring.
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    rows = (await db_session.execute(
        select(QuizQuestion, Question)
        .join(Question, Question.id == QuizQuestion.question_id)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order.asc())
    )).all()
    return [await _to_quiz_question_read(qq, question) for qq, question in rows]


async def attach_question_to_quiz(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuizQuestionAttach,
) -> QuizQuestionRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    question = (await db_session.execute(
        select(Question).where(Question.id == data.question_id)
    )).scalars().first()
    # SECURITY: the question must already belong to THIS org — otherwise an
    # admin of org A could attach org B's bank item to their own quiz. Not
    # found and wrong-org are reported identically (404), same
    # anti-enumeration pattern as create_channel_resource's activity check.
    if not question or question.org_id != org.id:
        raise HTTPException(status_code=404, detail="Question not found")
    if not question.published:
        raise HTTPException(
            status_code=409, detail="Only published questions can be attached to a quiz"
        )

    existing = (await db_session.execute(
        select(QuizQuestion).where(
            QuizQuestion.quiz_id == quiz.id, QuizQuestion.question_id == question.id
        )
    )).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="This question is already attached to this quiz")

    current_max = (await db_session.execute(
        select(QuizQuestion.order)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order.desc())
    )).scalars().first()
    next_order = (current_max + 1) if current_max is not None else 0

    qq = QuizQuestion(quiz_id=quiz.id, question_id=question.id, order=next_order)
    db_session.add(qq)
    await db_session.commit()
    await db_session.refresh(qq)
    return await _to_quiz_question_read(qq, question)


async def detach_question_from_quiz(
    request: Request,
    org_id: int,
    quiz_id: int,
    question_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    qq = (await db_session.execute(
        select(QuizQuestion).where(
            QuizQuestion.quiz_id == quiz.id, QuizQuestion.question_id == question_id
        )
    )).scalars().first()
    if not qq:
        raise HTTPException(status_code=404, detail="This question is not attached to this quiz")

    # Detaching only removes the quiz's membership row — the underlying
    # Question bank item is untouched, same asymmetry as
    # delete_channel_resource leaving its Activity intact.
    await db_session.delete(qq)
    await db_session.commit()


async def reorder_quiz_questions(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuizQuestionReorder,
) -> list[QuizQuestionRead]:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    if len(data.question_ids) != len(set(data.question_ids)):
        raise HTTPException(status_code=422, detail="question_ids must not contain duplicates")

    rows = (await db_session.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
    )).scalars().all()
    by_question_id = {qq.question_id: qq for qq in rows}

    if set(data.question_ids) != set(by_question_id.keys()):
        raise HTTPException(
            status_code=422,
            detail="question_ids must contain exactly this quiz's currently attached questions",
        )

    for index, question_id in enumerate(data.question_ids):
        by_question_id[question_id].order = index
        db_session.add(by_question_id[question_id])
    await db_session.commit()

    return await list_quiz_questions(request, org_id, quiz_id, current_user, db_session)
