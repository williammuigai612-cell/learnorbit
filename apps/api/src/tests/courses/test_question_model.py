"""
Model/constraint tests for Question (Phase 6B).

Question is a purpose-built, channel-scoped exam-prep question bank item —
not a thin wrapper over an existing Activity. See docs/ARCHITECTURE.md §
"Exams & Practice (Phase 6A)". These tests cover the model in isolation (no
service/router layer exercised here): creation + defaults and the org_id
CASCADE configuration. Mirrors test_channel_resource_model.py.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlmodel import select

from src.db.questions import Question

# engine, db, org are provided by conftest.py as async fixtures backed by an
# async SQLite engine.


@pytest.mark.asyncio
async def test_creates_with_defaults_and_educational_metadata(db, org):
    question = Question(
        question_uuid="question_1",
        org_id=org.id,
        question_type="multiple_choice",
        prompt="What is 2 + 2?",
        contents={"options": [
            {"id": "a", "text": "3", "is_correct": False},
            {"id": "b", "text": "4", "is_correct": True},
        ]},
        explanation="2 + 2 = 4",
        subject="Mathematics",
        topic="Arithmetic",
        level="Form 1",
        institution_context="KCSE",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)

    assert question.id is not None
    assert question.published is False
    assert question.contents["options"][1]["is_correct"] is True
    assert question.subject == "Mathematics"

    row = (
        await db.execute(select(Question).where(Question.id == question.id))
    ).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_contents_defaults_to_empty_dict(db, org):
    question = Question(
        question_uuid="question_2",
        org_id=org.id,
        question_type="short_answer",
        prompt="Name the capital of Kenya.",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)

    assert question.contents == {}
    assert question.explanation is None


def test_org_foreign_key_configured_for_cascade_delete():
    """Dialect-independent check that org_id is wired to CASCADE, per the
    Phase 6A decision (a Question can never outlive its channel)."""
    table = Question.__table__

    org_fks = list(table.columns["org_id"].foreign_keys)
    assert len(org_fks) == 1
    assert org_fks[0].column.table.name == "organization"
    assert org_fks[0].ondelete == "CASCADE"


@pytest.mark.asyncio
async def test_deleting_organization_cascades_to_question(db, org):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    question = Question(
        question_uuid="question_1",
        org_id=org.id,
        question_type="multiple_choice",
        prompt="What is 2 + 2?",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(question)
    await db.commit()
    question_id = question.id

    await db.delete(org)
    await db.commit()

    remaining = (
        await db.execute(select(Question).where(Question.id == question_id))
    ).scalars().first()
    assert remaining is None
