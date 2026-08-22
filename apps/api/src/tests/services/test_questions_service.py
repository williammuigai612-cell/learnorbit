"""
Service-layer tests for Question (Phase 6B).

Exercises the service functions directly (matches the style of
test_channel_resources_service.py), covering: authenticated creation,
validation, unauthorized creation, admin-only listing + filtering, get
access rules, publish/unpublish authorization, deletion authorization,
partial update, and cross-org access prevention.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.questions import Question
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.services.orgs.questions import (
    QuestionCreate,
    QuestionPublish,
    QuestionUpdate,
    create_question,
    delete_question,
    get_question,
    list_questions,
    set_question_published,
    update_question,
)

# db, org, other_org, admin_user, regular_user, anonymous_user are provided
# by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def other_org_admin_user(db, other_org):
    """Admin of `other_org` — used to prove admin rights don't cross channels."""
    u = User(
        id=3,
        username="other_admin",
        first_name="Other",
        last_name="Admin",
        email="other_admin@test.com",
        password="hashed_password",
        user_uuid="user_other_admin",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    db.add(UserOrganization(
        user_id=u.id,
        org_id=other_org.id,
        role_id=1,  # ADMIN_ROLE_ID
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    ))
    await db.commit()
    return PublicUser(
        id=u.id, username=u.username, first_name=u.first_name,
        last_name=u.last_name, email=u.email, user_uuid=u.user_uuid,
    )


def _mc_data(**overrides):
    fields = dict(
        question_type="multiple_choice",
        prompt="What is 2 + 2?",
        contents={"options": [
            {"id": "a", "text": "3", "is_correct": False},
            {"id": "b", "text": "4", "is_correct": True},
        ]},
    )
    fields.update(overrides)
    return QuestionCreate(**fields)


# ── Creation ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_create_question(db, org, admin_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_mc_data(subject="Mathematics"),
    )

    assert question.org_id == org.id
    assert question.published is False
    assert question.subject == "Mathematics"
    assert question.contents["options"][1]["is_correct"] is True

    row = (await db.execute(
        select(Question).where(Question.id == question.id)
    )).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_regular_member_cannot_create_question(db, org, regular_user):
    with pytest.raises(HTTPException) as exc:
        await create_question(
            request=None, org_id=org.id, current_user=regular_user, db_session=db,
            data=_mc_data(),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_anonymous_cannot_create_question(db, org, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await create_question(
            request=None, org_id=org.id, current_user=anonymous_user, db_session=db,
            data=_mc_data(),
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_create_rejects_blank_prompt(db, org, admin_user):
    with pytest.raises(HTTPException) as exc:
        await create_question(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=_mc_data(prompt="   "),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_rejects_invalid_question_type(db, org, admin_user):
    with pytest.raises(HTTPException) as exc:
        await create_question(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=_mc_data(question_type="essay"),
        )
    assert exc.value.status_code == 422


# ── Listing: admin-only, filtering ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_requires_admin(db, org, regular_user, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await list_questions(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await list_questions(request=None, org_id=org.id, current_user=anonymous_user, db_session=db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_list_shows_drafts_and_published_to_admin(db, org, admin_user):
    q1 = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )
    await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )
    await set_question_published(
        request=None, org_id=org.id, question_id=q1.id, current_user=admin_user,
        db_session=db, data=QuestionPublish(published=True),
    )

    questions = await list_questions(request=None, org_id=org.id, current_user=admin_user, db_session=db)
    assert len(questions) == 2


@pytest.mark.asyncio
async def test_list_filters_by_published(db, org, admin_user):
    q1 = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )
    await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )
    await set_question_published(
        request=None, org_id=org.id, question_id=q1.id, current_user=admin_user,
        db_session=db, data=QuestionPublish(published=True),
    )

    published_only = await list_questions(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, published=True,
    )
    assert [q.id for q in published_only] == [q1.id]

    drafts_only = await list_questions(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, published=False,
    )
    assert q1.id not in [q.id for q in drafts_only]


@pytest.mark.asyncio
async def test_list_filters_by_educational_metadata(db, org, admin_user):
    await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_mc_data(subject="Mathematics", topic="Algebra", level="Form 2"),
    )
    await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_mc_data(subject="Mathematics", topic="Geometry", level="Form 2"),
    )
    await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_mc_data(subject="Biology", topic="Plants", level="Form 1"),
    )

    math_questions = await list_questions(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, subject="Mathematics",
    )
    assert {q.topic for q in math_questions} == {"Algebra", "Geometry"}

    form1_only = await list_questions(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, level="Form 1",
    )
    assert [q.subject for q in form1_only] == ["Biology"]


# ── Get: admin-only ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_requires_admin(db, org, admin_user, regular_user, anonymous_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    with pytest.raises(HTTPException) as exc:
        await get_question(request=None, org_id=org.id, question_id=question.id, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await get_question(request=None, org_id=org.id, question_id=question.id, current_user=anonymous_user, db_session=db)
    assert exc.value.status_code == 401

    result = await get_question(request=None, org_id=org.id, question_id=question.id, current_user=admin_user, db_session=db)
    assert result.id == question.id


# ── Publish/unpublish authorization ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_unpublish_requires_admin(db, org, admin_user, regular_user, anonymous_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    with pytest.raises(HTTPException) as exc:
        await set_question_published(
            request=None, org_id=org.id, question_id=question.id, current_user=regular_user,
            db_session=db, data=QuestionPublish(published=True),
        )
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await set_question_published(
            request=None, org_id=org.id, question_id=question.id, current_user=anonymous_user,
            db_session=db, data=QuestionPublish(published=True),
        )
    assert exc.value.status_code == 401

    updated = await set_question_published(
        request=None, org_id=org.id, question_id=question.id, current_user=admin_user,
        db_session=db, data=QuestionPublish(published=True),
    )
    assert updated.published is True

    updated = await set_question_published(
        request=None, org_id=org.id, question_id=question.id, current_user=admin_user,
        db_session=db, data=QuestionPublish(published=False),
    )
    assert updated.published is False


# ── Deletion authorization ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_requires_admin(db, org, admin_user, regular_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    with pytest.raises(HTTPException) as exc:
        await delete_question(request=None, org_id=org.id, question_id=question.id, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 403

    await delete_question(request=None, org_id=org.id, question_id=question.id, current_user=admin_user, db_session=db)

    remaining = (await db.execute(
        select(Question).where(Question.id == question.id)
    )).scalars().first()
    assert remaining is None


# ── Metadata update authorization + behavior ────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_update_question(db, org, admin_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_mc_data(subject="Mathematics"),
    )

    updated = await update_question(
        request=None, org_id=org.id, question_id=question.id, current_user=admin_user,
        db_session=db,
        data=QuestionUpdate(
            prompt="What is 3 + 3?",
            subject="Biology",
            topic="Cells",
            level="Form 3",
            institution_context="KCSE",
            explanation="3 + 3 = 6",
        ),
    )

    assert updated.prompt == "What is 3 + 3?"
    assert updated.subject == "Biology"
    assert updated.topic == "Cells"
    assert updated.level == "Form 3"
    assert updated.institution_context == "KCSE"
    assert updated.explanation == "3 + 3 = 6"

    row = (await db.execute(
        select(Question).where(Question.id == question.id)
    )).scalars().first()
    assert row.prompt == "What is 3 + 3?"
    assert row.update_date != row.creation_date


@pytest.mark.asyncio
async def test_partial_update_leaves_unspecified_fields_unchanged(db, org, admin_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_mc_data(subject="Mathematics", topic="Algebra"),
    )

    updated = await update_question(
        request=None, org_id=org.id, question_id=question.id, current_user=admin_user,
        db_session=db, data=QuestionUpdate(subject="Physics"),
    )

    assert updated.subject == "Physics"
    assert updated.topic == "Algebra"
    assert updated.prompt == "What is 2 + 2?"


@pytest.mark.asyncio
async def test_update_rejects_blank_prompt(db, org, admin_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    with pytest.raises(HTTPException) as exc:
        await update_question(
            request=None, org_id=org.id, question_id=question.id, current_user=admin_user,
            db_session=db, data=QuestionUpdate(prompt="   "),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_update_rejects_invalid_question_type(db, org, admin_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    with pytest.raises(HTTPException) as exc:
        await update_question(
            request=None, org_id=org.id, question_id=question.id, current_user=admin_user,
            db_session=db, data=QuestionUpdate(question_type="essay"),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_regular_member_cannot_update_question(db, org, admin_user, regular_user):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    with pytest.raises(HTTPException) as exc:
        await update_question(
            request=None, org_id=org.id, question_id=question.id, current_user=regular_user,
            db_session=db, data=QuestionUpdate(prompt="Hijacked"),
        )
    assert exc.value.status_code == 403


# ── Cross-organization access prevention ────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_of_another_org_cannot_manage_this_channels_question(
    db, org, other_org, admin_user, other_org_admin_user
):
    question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_mc_data(),
    )

    # Being an admin of a DIFFERENT org must not grant access — the wrong
    # org_id in the path 404s rather than leaking existence via a 403.
    with pytest.raises(HTTPException) as exc:
        await get_question(
            request=None, org_id=other_org.id, question_id=question.id,
            current_user=other_org_admin_user, db_session=db,
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await update_question(
            request=None, org_id=other_org.id, question_id=question.id,
            current_user=other_org_admin_user, db_session=db,
            data=QuestionUpdate(prompt="Stolen"),
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await set_question_published(
            request=None, org_id=other_org.id, question_id=question.id,
            current_user=other_org_admin_user, db_session=db,
            data=QuestionPublish(published=True),
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await delete_question(
            request=None, org_id=other_org.id, question_id=question.id,
            current_user=other_org_admin_user, db_session=db,
        )
    assert exc.value.status_code == 404

    row = (await db.execute(
        select(Question).where(Question.id == question.id)
    )).scalars().first()
    assert row is not None
    assert row.prompt == "What is 2 + 2?"
