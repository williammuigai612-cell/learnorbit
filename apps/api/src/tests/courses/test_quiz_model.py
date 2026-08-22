"""
Model/constraint tests for Quiz/QuizQuestion (Phase 6C).

Quiz is a curated, ordered set of Question bank items (Phase 6B) via the
QuizQuestion join. See docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)".
These tests cover the models in isolation (no service/router layer
exercised here): creation + defaults, the quiz_id/question_id CASCADE
configuration, and the (quiz_id, question_id) uniqueness constraint.
Mirrors test_question_model.py / test_channel_resource_model.py.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from src.db.questions import Question
from src.db.quizzes import Quiz, QuizQuestion

# engine, db, org are provided by conftest.py as async fixtures backed by an
# async SQLite engine.


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
async def test_quiz_creates_with_defaults(db, org):
    quiz = Quiz(
        quiz_uuid="quiz_1",
        org_id=org.id,
        title="Form 2 Algebra Quiz",
        subject="Mathematics",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    assert quiz.id is not None
    assert quiz.published is False
    assert quiz.visibility == "public"
    assert quiz.quiz_type == "standard"
    assert quiz.time_limit_minutes is None

    row = (await db.execute(select(Quiz).where(Quiz.id == quiz.id))).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_quiz_question_creates_with_order(db, org, question):
    quiz = Quiz(
        quiz_uuid="quiz_1", org_id=org.id, title="Quiz",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    qq = QuizQuestion(quiz_id=quiz.id, question_id=question.id, order=0)
    db.add(qq)
    await db.commit()
    await db.refresh(qq)

    assert qq.id is not None
    assert qq.order == 0


@pytest.mark.asyncio
async def test_quiz_question_unique_constraint_prevents_duplicate_attach(db, org, question):
    quiz = Quiz(
        quiz_uuid="quiz_1", org_id=org.id, title="Quiz",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    db.add(QuizQuestion(quiz_id=quiz.id, question_id=question.id, order=0))
    await db.commit()

    db.add(QuizQuestion(quiz_id=quiz.id, question_id=question.id, order=1))
    with pytest.raises(IntegrityError):
        await db.commit()


def test_quiz_org_foreign_key_configured_for_cascade_delete():
    table = Quiz.__table__
    org_fks = list(table.columns["org_id"].foreign_keys)
    assert len(org_fks) == 1
    assert org_fks[0].column.table.name == "organization"
    assert org_fks[0].ondelete == "CASCADE"


def test_quizquestion_foreign_keys_configured_for_cascade_delete():
    table = QuizQuestion.__table__

    quiz_fks = list(table.columns["quiz_id"].foreign_keys)
    assert len(quiz_fks) == 1
    assert quiz_fks[0].column.table.name == "quiz"
    assert quiz_fks[0].ondelete == "CASCADE"

    question_fks = list(table.columns["question_id"].foreign_keys)
    assert len(question_fks) == 1
    assert question_fks[0].column.table.name == "question"
    assert question_fks[0].ondelete == "CASCADE"


@pytest.mark.asyncio
async def test_deleting_quiz_cascades_to_quizquestion(db, org, question):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    quiz = Quiz(
        quiz_uuid="quiz_1", org_id=org.id, title="Quiz",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    qq = QuizQuestion(quiz_id=quiz.id, question_id=question.id, order=0)
    db.add(qq)
    await db.commit()

    await db.delete(quiz)
    await db.commit()

    remaining = (
        await db.execute(select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))
    ).scalars().first()
    assert remaining is None


@pytest.mark.asyncio
async def test_deleting_question_cascades_to_quizquestion_but_not_quiz(db, org, question):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    quiz = Quiz(
        quiz_uuid="quiz_1", org_id=org.id, title="Quiz",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    db.add(QuizQuestion(quiz_id=quiz.id, question_id=question.id, order=0))
    await db.commit()

    await db.delete(question)
    await db.commit()

    remaining_qq = (
        await db.execute(select(QuizQuestion).where(QuizQuestion.question_id == question.id))
    ).scalars().first()
    assert remaining_qq is None

    remaining_quiz = (await db.execute(select(Quiz).where(Quiz.id == quiz.id))).scalars().first()
    assert remaining_quiz is not None
