"""
Service-layer tests for Quiz/QuizQuestion (Phase 6C).

Exercises the service functions directly (matches the style of
test_questions_service.py), covering: authenticated creation + validation,
listing (visibility + filtering + question_count), get access rules,
publish/unpublish authorization, deletion authorization, partial update,
attach/detach/reorder of bank questions (including cross-org and
unpublished-question rejection), and cross-org access prevention.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import select

from src.db.questions import Question
from src.db.quizzes import Quiz, QuizQuestion
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.services.orgs.questions import QuestionCreate, QuestionPublish, create_question, set_question_published
from src.services.orgs.quizzes import (
    QuizCreate,
    QuizPublish,
    QuizQuestionAttach,
    QuizQuestionReorder,
    QuizUpdate,
    attach_question_to_quiz,
    create_quiz,
    delete_quiz,
    detach_question_from_quiz,
    get_quiz,
    list_quiz_questions,
    list_quizzes,
    reorder_quiz_questions,
    set_quiz_published,
    update_quiz,
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


async def _make_published_question(db, org, admin_user, **overrides):
    fields = dict(
        question_type="multiple_choice",
        prompt="What is 2 + 2?",
        contents={"options": [{"id": "a", "text": "4", "is_correct": True}]},
    )
    fields.update(overrides)
    q = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuestionCreate(**fields),
    )
    return await set_question_published(
        request=None, org_id=org.id, question_id=q.id, current_user=admin_user,
        db_session=db, data=QuestionPublish(published=True),
    )


def _quiz_data(**overrides):
    fields = dict(title="Form 2 Algebra Quiz")
    fields.update(overrides)
    return QuizCreate(**fields)


# ── Creation ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_create_quiz(db, org, admin_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(subject="Mathematics", quiz_type="standard"),
    )

    assert quiz.org_id == org.id
    assert quiz.published is False
    assert quiz.visibility == "public"
    assert quiz.question_count == 0

    row = (await db.execute(select(Quiz).where(Quiz.id == quiz.id))).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_regular_member_cannot_create_quiz(db, org, regular_user):
    with pytest.raises(HTTPException) as exc:
        await create_quiz(
            request=None, org_id=org.id, current_user=regular_user, db_session=db,
            data=_quiz_data(),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_anonymous_cannot_create_quiz(db, org, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await create_quiz(
            request=None, org_id=org.id, current_user=anonymous_user, db_session=db,
            data=_quiz_data(),
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_create_rejects_blank_title(db, org, admin_user):
    with pytest.raises(HTTPException) as exc:
        await create_quiz(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=_quiz_data(title="   "),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_rejects_invalid_quiz_type(db, org, admin_user):
    with pytest.raises(HTTPException) as exc:
        await create_quiz(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=_quiz_data(quiz_type="mock_exam"),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_rejects_non_positive_time_limit(db, org, admin_user):
    with pytest.raises(HTTPException) as exc:
        await create_quiz(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=_quiz_data(quiz_type="exam_practice", time_limit_minutes=0),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_exam_practice_quiz_with_time_limit(db, org, admin_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(quiz_type="exam_practice", time_limit_minutes=60),
    )
    assert quiz.quiz_type == "exam_practice"
    assert quiz.time_limit_minutes == 60


# ── Listing: visibility, filtering, question_count ──────────────────────────

@pytest.mark.asyncio
async def test_list_hides_unpublished_from_anonymous(db, org, admin_user, anonymous_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data(),
    )
    assert await list_quizzes(request=None, org_id=org.id, current_user=anonymous_user, db_session=db) == []

    await set_quiz_published(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user,
        db_session=db, data=QuizPublish(published=True),
    )
    quizzes = await list_quizzes(request=None, org_id=org.id, current_user=anonymous_user, db_session=db)
    assert [q.id for q in quizzes] == [quiz.id]


@pytest.mark.asyncio
async def test_list_shows_drafts_to_admin(db, org, admin_user):
    await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    quizzes = await list_quizzes(request=None, org_id=org.id, current_user=admin_user, db_session=db)
    assert len(quizzes) == 1


@pytest.mark.asyncio
async def test_list_filters_by_metadata_and_quiz_type(db, org, admin_user):
    await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(subject="Mathematics", topic="Algebra", quiz_type="standard"),
    )
    await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(subject="Mathematics", topic="Geometry", quiz_type="exam_practice", time_limit_minutes=30),
    )
    await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(subject="Biology", topic="Plants", quiz_type="standard"),
    )

    math_quizzes = await list_quizzes(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, subject="Mathematics",
    )
    assert {q.topic for q in math_quizzes} == {"Algebra", "Geometry"}

    exam_practice_only = await list_quizzes(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, quiz_type="exam_practice",
    )
    assert [q.topic for q in exam_practice_only] == ["Geometry"]


@pytest.mark.asyncio
async def test_list_and_get_report_question_count(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    q1 = await _make_published_question(db, org, admin_user)
    q2 = await _make_published_question(db, org, admin_user)
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q1.id),
    )
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q2.id),
    )

    listed = await list_quizzes(request=None, org_id=org.id, current_user=admin_user, db_session=db)
    assert listed[0].question_count == 2

    fetched = await get_quiz(request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db)
    assert fetched.question_count == 2


# ── Get: visibility rules ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_unpublished_quiz_requires_admin(db, org, admin_user, regular_user, anonymous_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())

    for viewer in (anonymous_user, regular_user):
        with pytest.raises(HTTPException) as exc:
            await get_quiz(request=None, org_id=org.id, quiz_id=quiz.id, current_user=viewer, db_session=db)
        assert exc.value.status_code == 403

    result = await get_quiz(request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db)
    assert result.id == quiz.id


# ── Publish/unpublish authorization ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_unpublish_requires_admin(db, org, admin_user, regular_user, anonymous_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())

    with pytest.raises(HTTPException) as exc:
        await set_quiz_published(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user,
            db_session=db, data=QuizPublish(published=True),
        )
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await set_quiz_published(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=anonymous_user,
            db_session=db, data=QuizPublish(published=True),
        )
    assert exc.value.status_code == 401

    updated = await set_quiz_published(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user,
        db_session=db, data=QuizPublish(published=True),
    )
    assert updated.published is True


# ── Deletion authorization + cascade ─────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_requires_admin_and_cascades_quizquestion(db, org, admin_user, regular_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    question = await _make_published_question(db, org, admin_user)
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=question.id),
    )

    # SQLite doesn't enforce FK constraints by default; opt in for this test
    # so the migration's ON DELETE CASCADE actually runs (matches
    # test_channel_resource_model.py's convention for cascade assertions).
    # Real Postgres enforces this unconditionally.
    await db.execute(text("PRAGMA foreign_keys=ON"))

    with pytest.raises(HTTPException) as exc:
        await delete_quiz(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 403

    await delete_quiz(request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db)

    remaining_quiz = (await db.execute(select(Quiz).where(Quiz.id == quiz.id))).scalars().first()
    assert remaining_quiz is None
    remaining_qq = (await db.execute(select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id))).scalars().first()
    assert remaining_qq is None

    # The underlying Question bank item is untouched.
    still_there = (await db.execute(select(Question).where(Question.id == question.id))).scalars().first()
    assert still_there is not None


# ── Metadata update ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_update_quiz_metadata(db, org, admin_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(subject="Mathematics"),
    )

    updated = await update_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizUpdate(title="Updated Title", subject="Biology", quiz_type="exam_practice", time_limit_minutes=45),
    )

    assert updated.title == "Updated Title"
    assert updated.subject == "Biology"
    assert updated.quiz_type == "exam_practice"
    assert updated.time_limit_minutes == 45


@pytest.mark.asyncio
async def test_partial_update_leaves_unspecified_fields_unchanged(db, org, admin_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(subject="Mathematics", topic="Algebra"),
    )

    updated = await update_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizUpdate(subject="Physics"),
    )

    assert updated.subject == "Physics"
    assert updated.topic == "Algebra"
    assert updated.title == "Form 2 Algebra Quiz"


@pytest.mark.asyncio
async def test_update_rejects_blank_title_and_invalid_quiz_type(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())

    with pytest.raises(HTTPException) as exc:
        await update_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizUpdate(title="   "),
        )
    assert exc.value.status_code == 422

    with pytest.raises(HTTPException) as exc:
        await update_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizUpdate(quiz_type="mock_exam"),
        )
    assert exc.value.status_code == 422


# ── Attach/detach/reorder ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_attach_requires_admin(db, org, admin_user, regular_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    question = await _make_published_question(db, org, admin_user)

    with pytest.raises(HTTPException) as exc:
        await attach_question_to_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
            data=QuizQuestionAttach(question_id=question.id),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_attach_rejects_unpublished_question(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    draft_question = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuestionCreate(question_type="multiple_choice", prompt="Draft?"),
    )

    with pytest.raises(HTTPException) as exc:
        await attach_question_to_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionAttach(question_id=draft_question.id),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_attach_rejects_cross_org_question(db, org, other_org, admin_user, other_org_admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    other_question = await _make_published_question(db, other_org, other_org_admin_user)

    with pytest.raises(HTTPException) as exc:
        await attach_question_to_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionAttach(question_id=other_question.id),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_attach_rejects_duplicate(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    question = await _make_published_question(db, org, admin_user)

    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=question.id),
    )
    with pytest.raises(HTTPException) as exc:
        await attach_question_to_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionAttach(question_id=question.id),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_attach_appends_to_end_of_order(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    q1 = await _make_published_question(db, org, admin_user)
    q2 = await _make_published_question(db, org, admin_user)

    qq1 = await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q1.id),
    )
    qq2 = await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q2.id),
    )

    assert qq1.order == 0
    assert qq2.order == 1


@pytest.mark.asyncio
async def test_list_quiz_questions_requires_admin_and_returns_ordered(db, org, admin_user, regular_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    q1 = await _make_published_question(db, org, admin_user)
    q2 = await _make_published_question(db, org, admin_user)
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q1.id),
    )
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q2.id),
    )

    with pytest.raises(HTTPException) as exc:
        await list_quiz_questions(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 403

    listed = await list_quiz_questions(request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db)
    assert [item.question_id for item in listed] == [q1.id, q2.id]
    # Full contents (answer key) included — admin-only view.
    assert listed[0].question.contents["options"][0]["is_correct"] is True


@pytest.mark.asyncio
async def test_detach_requires_admin_and_leaves_question_intact(db, org, admin_user, regular_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    question = await _make_published_question(db, org, admin_user)
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=question.id),
    )

    with pytest.raises(HTTPException) as exc:
        await detach_question_from_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, question_id=question.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403

    await detach_question_from_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, question_id=question.id,
        current_user=admin_user, db_session=db,
    )

    remaining = (await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id, QuizQuestion.question_id == question.id)
    )).scalars().first()
    assert remaining is None

    still_there = (await db.execute(select(Question).where(Question.id == question.id))).scalars().first()
    assert still_there is not None


@pytest.mark.asyncio
async def test_detach_nonexistent_attachment_404s(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    question = await _make_published_question(db, org, admin_user)

    with pytest.raises(HTTPException) as exc:
        await detach_question_from_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, question_id=question.id,
            current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_reorder_requires_admin_and_applies_new_order(db, org, admin_user, regular_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    q1 = await _make_published_question(db, org, admin_user)
    q2 = await _make_published_question(db, org, admin_user)
    q3 = await _make_published_question(db, org, admin_user)
    for q in (q1, q2, q3):
        await attach_question_to_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionAttach(question_id=q.id),
        )

    with pytest.raises(HTTPException) as exc:
        await reorder_quiz_questions(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
            data=QuizQuestionReorder(question_ids=[q3.id, q2.id, q1.id]),
        )
    assert exc.value.status_code == 403

    reordered = await reorder_quiz_questions(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionReorder(question_ids=[q3.id, q1.id, q2.id]),
    )
    assert [item.question_id for item in reordered] == [q3.id, q1.id, q2.id]
    assert [item.order for item in reordered] == [0, 1, 2]


@pytest.mark.asyncio
async def test_reorder_rejects_mismatched_question_set(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    q1 = await _make_published_question(db, org, admin_user)
    q2 = await _make_published_question(db, org, admin_user)
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q1.id),
    )

    # Missing an attached question.
    with pytest.raises(HTTPException) as exc:
        await reorder_quiz_questions(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionReorder(question_ids=[]),
        )
    assert exc.value.status_code == 422

    # References a question that was never attached.
    with pytest.raises(HTTPException) as exc:
        await reorder_quiz_questions(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionReorder(question_ids=[q1.id, q2.id]),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_reorder_rejects_duplicate_ids(db, org, admin_user):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())
    q1 = await _make_published_question(db, org, admin_user)
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q1.id),
    )

    with pytest.raises(HTTPException) as exc:
        await reorder_quiz_questions(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionReorder(question_ids=[q1.id, q1.id]),
        )
    assert exc.value.status_code == 422


# ── Cross-organization access prevention ────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_of_another_org_cannot_manage_this_channels_quiz(
    db, org, other_org, admin_user, other_org_admin_user
):
    quiz = await create_quiz(request=None, org_id=org.id, current_user=admin_user, db_session=db, data=_quiz_data())

    with pytest.raises(HTTPException) as exc:
        await get_quiz(
            request=None, org_id=other_org.id, quiz_id=quiz.id,
            current_user=other_org_admin_user, db_session=db,
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await update_quiz(
            request=None, org_id=other_org.id, quiz_id=quiz.id,
            current_user=other_org_admin_user, db_session=db,
            data=QuizUpdate(title="Stolen"),
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await set_quiz_published(
            request=None, org_id=other_org.id, quiz_id=quiz.id,
            current_user=other_org_admin_user, db_session=db,
            data=QuizPublish(published=True),
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await delete_quiz(
            request=None, org_id=other_org.id, quiz_id=quiz.id,
            current_user=other_org_admin_user, db_session=db,
        )
    assert exc.value.status_code == 404

    row = (await db.execute(select(Quiz).where(Quiz.id == quiz.id))).scalars().first()
    assert row is not None
    assert row.title == "Form 2 Algebra Quiz"


# ── 9B-3: _question_counts as a GROUP BY aggregate ──────────────────────────
# Guards the specific risk of that refactor: a GROUP BY returns no row for a
# quiz with zero questions, so the empty quiz must still report 0 rather than
# dropping out of the map.

@pytest.mark.asyncio
async def test_list_reports_correct_question_count_per_quiz(db, org, admin_user):
    empty_quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(title="Empty"),
    )
    one_quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(title="One"),
    )
    two_quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=_quiz_data(title="Two"),
    )

    q1 = await _make_published_question(db, org, admin_user)
    q2 = await _make_published_question(db, org, admin_user)
    q3 = await _make_published_question(db, org, admin_user)

    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=one_quiz.id, current_user=admin_user,
        db_session=db, data=QuizQuestionAttach(question_id=q1.id),
    )
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=two_quiz.id, current_user=admin_user,
        db_session=db, data=QuizQuestionAttach(question_id=q2.id),
    )
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=two_quiz.id, current_user=admin_user,
        db_session=db, data=QuizQuestionAttach(question_id=q3.id),
    )

    listed = await list_quizzes(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
    )
    counts = {q.id: q.question_count for q in listed}

    assert counts[empty_quiz.id] == 0
    assert counts[one_quiz.id] == 1
    assert counts[two_quiz.id] == 2
