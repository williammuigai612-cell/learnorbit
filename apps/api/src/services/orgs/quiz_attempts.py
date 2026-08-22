"""
QuizAttempt service — attempt-taking + auto-grading (Phase 6D).

See docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" for the full
decision. A QuizAttempt is one row per attempt at taking a published Quiz
(services/orgs/quizzes.py, Phase 6C); every attempt is its own row, so
attempt history is preserved for the later Results (6G) and progress-
tracking (6H) increments.

This module owns the correct-answer/explanation leak-prevention gate: the
question view returned while an attempt is "in_progress" strips
`is_correct` from each `contents.options` entry and omits `explanation`
entirely — and, since a short_answer/number_answer question's
`contents.accepted_answers` *is* its answer key (unlike multiple_choice,
where the option text itself is meant to be visible), that field is
stripped too. Only the graded response — after `submit_quiz_attempt` — ever
reveals them, and only to that attempt's own user.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlalchemy import func
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.quiz_attempts import QuizAttempt, QuizAnswer
from src.db.quizzes import Quiz, QuizQuestion
from src.db.questions import Question
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin
from src.services.orgs.questions import QuestionRead


# ---------------------------------------------------------------------------
# Schemas (request/response only — the table models are db/quiz_attempts.py)
# ---------------------------------------------------------------------------

class QuestionForAttempt(SQLModel):
    """Student-facing view of a bank question while an attempt is in
    progress — the answer key is stripped (see module docstring)."""
    id: int
    question_type: str
    prompt: str
    contents: dict


class QuizAnswerSubmit(SQLModel):
    question_id: int
    answer: dict = {}


class QuizAttemptSubmit(SQLModel):
    answers: list[QuizAnswerSubmit] = []


class QuizAnswerResult(SQLModel):
    question_id: int
    answer: dict
    is_correct: bool
    # Full Question, including explanation/is_correct — only ever included
    # once this attempt is graded.
    question: QuestionRead


class QuizAttemptSummary(SQLModel):
    """One row of a user's own attempt history for a quiz (Results, Phase
    6G) — summary fields only, no per-question detail. Fetch
    GET .../attempts/{attempt_id} for that."""
    id: int
    quizattempt_uuid: str
    quiz_id: int
    status: str
    score_percentage: float
    attempt_number: int
    started_at: str
    submitted_at: Optional[str] = None


class QuizAttemptRead(SQLModel):
    id: int
    quizattempt_uuid: str
    quiz_id: int
    user_id: int
    status: str
    score_percentage: float
    attempt_number: int
    started_at: str
    submitted_at: Optional[str] = None
    # Populated only while status == "in_progress" (student view, stripped).
    questions: Optional[list[QuestionForAttempt]] = None
    # Populated only once status == "graded" (full per-answer results).
    answers: Optional[list[QuizAnswerResult]] = None


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
    # SECURITY: scoped to org_id so a quiz can never be fetched through
    # another organization's id in the path.
    quiz = (await db_session.execute(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.org_id == org_id)
    )).scalars().first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


async def _get_attempt_or_404(quiz_id: int, attempt_id: int, db_session: AsyncSession) -> QuizAttempt:
    # SECURITY: scoped to quiz_id so an attempt can never be fetched through
    # another quiz's id in the path.
    attempt = (await db_session.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.quiz_id == quiz_id)
    )).scalars().first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


def _require_authenticated(current_user: PublicUser | AnonymousUser) -> int:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    return resolve_acting_user_id(current_user)


def _require_own_attempt(acting_user_id: int, attempt: QuizAttempt) -> None:
    if attempt.user_id != acting_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own quiz attempts")


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def _quiz_questions_ordered(quiz_id: int, db_session: AsyncSession) -> list[Question]:
    rows = (await db_session.execute(
        select(QuizQuestion, Question)
        .join(Question, Question.id == QuizQuestion.question_id)
        .where(QuizQuestion.quiz_id == quiz_id)
        .order_by(QuizQuestion.order.asc())
    )).all()
    return [question for _qq, question in rows]


def _strip_question(question: Question) -> QuestionForAttempt:
    contents = dict(question.contents or {})
    if "options" in contents:
        contents["options"] = [
            {k: v for k, v in opt.items() if k != "is_correct"} for opt in contents["options"]
        ]
    # accepted_answers IS the answer key for short_answer/number_answer —
    # unlike an option's text, it must never reach the student pre-grading.
    contents.pop("accepted_answers", None)
    return QuestionForAttempt(
        id=question.id, question_type=question.question_type,
        prompt=question.prompt, contents=contents,
    )


def _normalize_text(value) -> str:
    return str(value).strip().lower()


def _grade_answer(question: Question, answer: dict) -> bool:
    contents = question.contents or {}

    if question.question_type == "multiple_choice":
        selected = answer.get("selected_option_id")
        if selected is None:
            return False
        correct_ids = {opt.get("id") for opt in contents.get("options", []) if opt.get("is_correct")}
        return selected in correct_ids

    if question.question_type == "short_answer":
        submitted = answer.get("text")
        if submitted is None:
            return False
        accepted = {_normalize_text(a) for a in contents.get("accepted_answers", [])}
        return _normalize_text(submitted) in accepted

    if question.question_type == "number_answer":
        submitted = answer.get("value")
        if submitted is None:
            return False
        try:
            submitted_num = float(submitted)
        except (TypeError, ValueError):
            return False
        for accepted in contents.get("accepted_answers", []):
            try:
                if float(accepted) == submitted_num:
                    return True
            except (TypeError, ValueError):
                continue
        return False

    # Unknown/unsupported question_type — never auto-correct.
    return False


async def _graded_answers(attempt_id: int, db_session: AsyncSession) -> list[QuizAnswerResult]:
    rows = (await db_session.execute(
        select(QuizAnswer, Question)
        .join(Question, Question.id == QuizAnswer.question_id)
        .where(QuizAnswer.quizattempt_id == attempt_id)
        .order_by(QuizAnswer.id.asc())
    )).all()
    return [
        QuizAnswerResult(
            question_id=qa.question_id, answer=qa.answer, is_correct=qa.is_correct,
            question=QuestionRead.model_validate(question),
        )
        for qa, question in rows
    ]


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def start_quiz_attempt(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> QuizAttemptRead:
    org = await _get_org_or_404(org_id, db_session)
    acting_user_id = _require_authenticated(current_user)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    if not (quiz.published and quiz.visibility == "public"):
        # The channel's own admin may preview their own draft/unlisted quiz
        # — same "owner-can-attempt-own-draft" precedent as videos/resources.
        if not await is_org_admin(acting_user_id, org.id, db_session):
            raise HTTPException(status_code=403, detail="This quiz is not published")

    existing_count = (await db_session.execute(
        select(func.count()).select_from(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == acting_user_id
        )
    )).scalar_one()

    attempt = QuizAttempt(
        quizattempt_uuid=f"quizattempt_{uuid4()}",
        quiz_id=quiz.id,
        user_id=acting_user_id,
        status="in_progress",
        score_percentage=0.0,
        attempt_number=existing_count + 1,
        started_at=_now(),
    )
    db_session.add(attempt)
    await db_session.commit()
    await db_session.refresh(attempt)

    questions = await _quiz_questions_ordered(quiz.id, db_session)
    read = QuizAttemptRead.model_validate(attempt)
    read.questions = [_strip_question(q) for q in questions]
    return read


async def get_quiz_attempt(
    request: Request,
    org_id: int,
    quiz_id: int,
    attempt_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> QuizAttemptRead:
    org = await _get_org_or_404(org_id, db_session)
    acting_user_id = _require_authenticated(current_user)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)
    attempt = await _get_attempt_or_404(quiz.id, attempt_id, db_session)
    _require_own_attempt(acting_user_id, attempt)

    read = QuizAttemptRead.model_validate(attempt)
    if attempt.status == "graded":
        read.answers = await _graded_answers(attempt.id, db_session)
    else:
        questions = await _quiz_questions_ordered(quiz.id, db_session)
        read.questions = [_strip_question(q) for q in questions]
    return read


async def submit_quiz_attempt(
    request: Request,
    org_id: int,
    quiz_id: int,
    attempt_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: QuizAttemptSubmit,
) -> QuizAttemptRead:
    org = await _get_org_or_404(org_id, db_session)
    acting_user_id = _require_authenticated(current_user)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)
    attempt = await _get_attempt_or_404(quiz.id, attempt_id, db_session)
    _require_own_attempt(acting_user_id, attempt)

    if attempt.status != "in_progress":
        raise HTTPException(status_code=409, detail="This attempt has already been submitted")

    submitted_ids = [a.question_id for a in data.answers]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise HTTPException(status_code=422, detail="answers must not reference the same question_id twice")

    questions = await _quiz_questions_ordered(quiz.id, db_session)
    questions_by_id = {q.id: q for q in questions}

    if not set(submitted_ids) <= set(questions_by_id.keys()):
        raise HTTPException(
            status_code=422, detail="answers reference a question not attached to this quiz"
        )

    submitted_by_id = {a.question_id: a.answer for a in data.answers}

    correct_count = 0
    for question_id, question in questions_by_id.items():
        # A question with no submitted answer is graded incorrect — quizzes
        # have no "not attempted" state distinct from "wrong" in V1.
        answer_payload = submitted_by_id.get(question_id, {})
        is_correct = _grade_answer(question, answer_payload)
        if is_correct:
            correct_count += 1
        db_session.add(QuizAnswer(
            quizattempt_id=attempt.id, question_id=question_id,
            answer=answer_payload, is_correct=is_correct,
        ))

    total = len(questions_by_id)
    attempt.score_percentage = (correct_count / total * 100.0) if total else 0.0
    attempt.status = "graded"
    attempt.submitted_at = _now()
    db_session.add(attempt)
    await db_session.commit()
    await db_session.refresh(attempt)

    read = QuizAttemptRead.model_validate(attempt)
    read.answers = await _graded_answers(attempt.id, db_session)
    return read


async def list_quiz_attempts(
    request: Request,
    org_id: int,
    quiz_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> list[QuizAttemptSummary]:
    """The acting user's own attempt history for this quiz (Results, Phase
    6G) — deliberately deferred out of 6D since it needed this exact query.
    Newest attempt first. No admin/other-user listing here — that's a
    different query, left to 6H's progress-tracking aggregation."""
    org = await _get_org_or_404(org_id, db_session)
    acting_user_id = _require_authenticated(current_user)
    quiz = await _get_quiz_or_404(org.id, quiz_id, db_session)

    rows = (await db_session.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == acting_user_id)
        .order_by(QuizAttempt.attempt_number.desc())
    )).scalars().all()
    return [QuizAttemptSummary.model_validate(a) for a in rows]
