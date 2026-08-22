"""
Model/constraint tests for QuizAttempt/QuizAnswer (Phase 6D).

QuizAttempt is one row per attempt at taking a Quiz (Phase 6C); QuizAnswer is
one row per (attempt, question). See docs/ARCHITECTURE.md § "Exams &
Practice (Phase 6A)". These tests cover the models in isolation (no
service/router layer exercised here): creation + defaults, FK CASCADE
configuration, and the (quizattempt_id, question_id) uniqueness constraint.
Mirrors test_quiz_model.py.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from src.db.questions import Question
from src.db.quizzes import Quiz
from src.db.quiz_attempts import QuizAttempt, QuizAnswer

# engine, db, org, admin_user are provided by conftest.py as async fixtures
# backed by an async SQLite engine.


@pytest.fixture
async def quiz(db, org):
    q = Quiz(
        quiz_uuid="quiz_1", org_id=org.id, title="Quiz",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return q


@pytest.fixture
async def question(db, org):
    q = Question(
        question_uuid="question_1",
        org_id=org.id,
        question_type="multiple_choice",
        prompt="What is 2 + 2?",
        contents={"options": [{"id": "a", "text": "4", "is_correct": True}]},
        published=True,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return q


@pytest.mark.asyncio
async def test_quiz_attempt_creates_with_defaults(db, quiz, admin_user):
    attempt = QuizAttempt(
        quizattempt_uuid="quizattempt_1",
        quiz_id=quiz.id,
        user_id=admin_user.id,
        started_at=str(datetime.now()),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    assert attempt.id is not None
    assert attempt.status == "in_progress"
    assert attempt.score_percentage == 0.0
    assert attempt.attempt_number == 1
    assert attempt.submitted_at is None

    row = (await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt.id))).scalars().first()
    assert row is not None
    assert row.quiz_id == quiz.id


@pytest.mark.asyncio
async def test_quiz_answer_creates_with_defaults(db, quiz, question, admin_user):
    attempt = QuizAttempt(
        quizattempt_uuid="quizattempt_1", quiz_id=quiz.id, user_id=admin_user.id,
        started_at=str(datetime.now()),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    answer = QuizAnswer(
        quizattempt_id=attempt.id, question_id=question.id,
        answer={"selected_option_id": "a"},
    )
    db.add(answer)
    await db.commit()
    await db.refresh(answer)

    assert answer.id is not None
    assert answer.is_correct is False


@pytest.mark.asyncio
async def test_quiz_answer_unique_constraint_prevents_duplicate_per_question(db, quiz, question, admin_user):
    attempt = QuizAttempt(
        quizattempt_uuid="quizattempt_1", quiz_id=quiz.id, user_id=admin_user.id,
        started_at=str(datetime.now()),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    db.add(QuizAnswer(quizattempt_id=attempt.id, question_id=question.id, answer={}))
    await db.commit()

    db.add(QuizAnswer(quizattempt_id=attempt.id, question_id=question.id, answer={}))
    with pytest.raises(IntegrityError):
        await db.commit()


def test_quizattempt_foreign_keys_configured_for_cascade_delete():
    table = QuizAttempt.__table__

    quiz_fks = list(table.columns["quiz_id"].foreign_keys)
    assert len(quiz_fks) == 1
    assert quiz_fks[0].column.table.name == "quiz"
    assert quiz_fks[0].ondelete == "CASCADE"

    user_fks = list(table.columns["user_id"].foreign_keys)
    assert len(user_fks) == 1
    assert user_fks[0].column.table.name == "user"
    assert user_fks[0].ondelete == "CASCADE"


def test_quizanswer_foreign_keys_configured_for_cascade_delete():
    table = QuizAnswer.__table__

    attempt_fks = list(table.columns["quizattempt_id"].foreign_keys)
    assert len(attempt_fks) == 1
    assert attempt_fks[0].column.table.name == "quizattempt"
    assert attempt_fks[0].ondelete == "CASCADE"

    question_fks = list(table.columns["question_id"].foreign_keys)
    assert len(question_fks) == 1
    assert question_fks[0].column.table.name == "question"
    assert question_fks[0].ondelete == "CASCADE"


@pytest.mark.asyncio
async def test_deleting_quiz_attempt_cascades_to_quiz_answer(db, quiz, question, admin_user):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    attempt = QuizAttempt(
        quizattempt_uuid="quizattempt_1", quiz_id=quiz.id, user_id=admin_user.id,
        started_at=str(datetime.now()),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    db.add(QuizAnswer(quizattempt_id=attempt.id, question_id=question.id, answer={}))
    await db.commit()

    await db.delete(attempt)
    await db.commit()

    remaining = (
        await db.execute(select(QuizAnswer).where(QuizAnswer.quizattempt_id == attempt.id))
    ).scalars().first()
    assert remaining is None


@pytest.mark.asyncio
async def test_deleting_quiz_cascades_to_quiz_attempt(db, quiz, admin_user):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    attempt = QuizAttempt(
        quizattempt_uuid="quizattempt_1", quiz_id=quiz.id, user_id=admin_user.id,
        started_at=str(datetime.now()),
    )
    db.add(attempt)
    await db.commit()

    await db.delete(quiz)
    await db.commit()

    remaining = (
        await db.execute(select(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id))
    ).scalars().first()
    assert remaining is None
