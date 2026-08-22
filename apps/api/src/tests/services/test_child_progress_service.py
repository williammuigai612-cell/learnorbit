"""Service-layer tests for the parent-facing child quiz-progress view (Phase 7C).

`get_child_quiz_progress` is a read-only, cross-org aggregation over the
existing `QuizAttempt`/`Quiz`/`Organization` tables, gated by an APPROVED
`ParentChildLink` rather than org scoping (see services/users/child_progress.py's
own docstring for why). Exercises the authorization gate (no link / pending /
rejected / wrong-direction all 404) and the cross-org aggregation itself.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.users import PublicUser, User
from src.db.user_organizations import UserOrganization
from src.services.orgs.questions import QuestionCreate, QuestionPublish, create_question, set_question_published
from src.services.orgs.quizzes import QuizCreate, QuizPublish, QuizQuestionAttach, attach_question_to_quiz, create_quiz, set_quiz_published
from src.services.orgs.quiz_attempts import QuizAnswerSubmit, QuizAttemptSubmit, start_quiz_attempt, submit_quiz_attempt
from src.services.users.parent_links import request_parent_link, respond_to_parent_link
from src.services.users.child_progress import get_child_quiz_progress

# db, org, other_org, admin_user, regular_user, anonymous_user are provided
# by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def other_org_admin_user(db, other_org):
    """Admin of `other_org` — used to publish a quiz there for the
    cross-org-aggregation test."""
    u = User(
        id=3, username="other_admin", first_name="Other", last_name="Admin",
        email="other_admin@test.com", password="hashed_password",
        user_uuid="user_other_admin",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    db.add(UserOrganization(
        user_id=u.id, org_id=other_org.id, role_id=1,  # ADMIN_ROLE_ID
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    await db.commit()
    return PublicUser(
        id=u.id, username=u.username, first_name=u.first_name,
        last_name=u.last_name, email=u.email, user_uuid=u.user_uuid,
    )


@pytest.fixture
async def parent_user(db, org):
    """A second parent-capable account, unrelated to admin_user/regular_user
    — used for the wrong-direction/unrelated-caller isolation tests."""
    u = User(
        id=5, username="parent2", first_name="Parent", last_name="Two",
        email="parent2@test.com", password="hashed_password",
        user_uuid="user_parent2", is_parent=True,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return PublicUser(
        id=u.id, username=u.username, first_name=u.first_name,
        last_name=u.last_name, email=u.email, user_uuid=u.user_uuid,
        is_parent=True,
    )


async def _make_parent(db, public_user: PublicUser) -> PublicUser:
    row = await db.get(User, public_user.id)
    row.is_parent = True
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PublicUser(**{**public_user.model_dump(), "is_parent": True})


async def _published_quiz_with_one_question(db, org, admin_user, title="Quiz"):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuizCreate(title=title),
    )
    quiz = await set_quiz_published(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user,
        db_session=db, data=QuizPublish(published=True),
    )
    q = await create_question(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuestionCreate(
            question_type="multiple_choice", prompt="2 + 2?",
            contents={"options": [{"id": "a", "text": "3", "is_correct": False}, {"id": "b", "text": "4", "is_correct": True}]},
        ),
    )
    q = await set_question_published(
        request=None, org_id=org.id, question_id=q.id, current_user=admin_user,
        db_session=db, data=QuestionPublish(published=True),
    )
    await attach_question_to_quiz(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
        data=QuizQuestionAttach(question_id=q.id),
    )
    return quiz, q


async def _take_attempt(db, org, quiz, question, user, *, correct: bool, submit: bool = True):
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=user, db_session=db)
    if not submit:
        return attempt
    selected = "b" if correct else "a"
    return await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=user, db_session=db,
        data=QuizAttemptSubmit(answers=[QuizAnswerSubmit(question_id=question.id, answer={"selected_option_id": selected})]),
    )


async def _link_and_approve(db, parent, child):
    link = await request_parent_link(current_user=parent, child_username=child.username, db_session=db)
    return await respond_to_parent_link(current_user=child, link_uuid=link.link_uuid, approve=True, db_session=db)


@pytest.mark.asyncio
async def test_anonymous_cannot_view_child_progress(db, regular_user, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await get_child_quiz_progress(
            request=None, child_user_id=regular_user.id, current_user=anonymous_user, db_session=db
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_no_link_at_all_404s(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)
    with pytest.raises(HTTPException) as exc:
        await get_child_quiz_progress(
            request=None, child_user_id=regular_user.id, current_user=parent, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_pending_link_not_yet_approved_404s(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)
    await request_parent_link(current_user=parent, child_username=regular_user.username, db_session=db)

    with pytest.raises(HTTPException) as exc:
        await get_child_quiz_progress(
            request=None, child_user_id=regular_user.id, current_user=parent, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_rejected_link_404s(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)
    link = await request_parent_link(current_user=parent, child_username=regular_user.username, db_session=db)
    await respond_to_parent_link(current_user=regular_user, link_uuid=link.link_uuid, approve=False, db_session=db)

    with pytest.raises(HTTPException) as exc:
        await get_child_quiz_progress(
            request=None, child_user_id=regular_user.id, current_user=parent, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_wrong_direction_404s(db, admin_user, regular_user):
    """An APPROVED link exists, but the caller is the *child* side trying to
    view "their child's" progress on themselves — must still 404."""
    parent = await _make_parent(db, admin_user)
    await _link_and_approve(db, parent, regular_user)

    with pytest.raises(HTTPException) as exc:
        await get_child_quiz_progress(
            request=None, child_user_id=parent.id, current_user=regular_user, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_unrelated_parent_cannot_view_someone_elses_child(db, admin_user, regular_user, parent_user):
    parent = await _make_parent(db, admin_user)
    await _link_and_approve(db, parent, regular_user)

    with pytest.raises(HTTPException) as exc:
        await get_child_quiz_progress(
            request=None, child_user_id=regular_user.id, current_user=parent_user, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_empty_when_child_has_no_attempts(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)
    await _link_and_approve(db, parent, regular_user)

    progress = await get_child_quiz_progress(
        request=None, child_user_id=regular_user.id, current_user=parent, db_session=db
    )
    assert progress == []


@pytest.mark.asyncio
async def test_aggregates_across_multiple_orgs(
    db, org, other_org, admin_user, other_org_admin_user, regular_user
):
    parent = await _make_parent(db, admin_user)
    await _link_and_approve(db, parent, regular_user)

    quiz_a, question_a = await _published_quiz_with_one_question(db, org, admin_user, title="Org quiz")
    quiz_b, question_b = await _published_quiz_with_one_question(db, other_org, other_org_admin_user, title="Other org quiz")

    await _take_attempt(db, org, quiz_a, question_a, regular_user, correct=True)
    await _take_attempt(db, other_org, quiz_b, question_b, regular_user, correct=False)

    progress = await get_child_quiz_progress(
        request=None, child_user_id=regular_user.id, current_user=parent, db_session=db
    )
    by_quiz_id = {p.quiz_id: p for p in progress}
    assert set(by_quiz_id.keys()) == {quiz_a.id, quiz_b.id}
    assert by_quiz_id[quiz_a.id].org_id == org.id
    assert by_quiz_id[quiz_a.id].org_name == org.name
    assert by_quiz_id[quiz_a.id].best_score_percentage == pytest.approx(100.0)
    assert by_quiz_id[quiz_b.id].org_id == other_org.id
    assert by_quiz_id[quiz_b.id].best_score_percentage == pytest.approx(0.0)


@pytest.mark.asyncio
async def test_only_includes_the_linked_childs_attempts(
    db, org, admin_user, regular_user, parent_user
):
    """A different user's attempts on the same quiz must never leak into the
    linked child's progress view."""
    parent = await _make_parent(db, admin_user)
    await _link_and_approve(db, parent, regular_user)

    quiz, question = await _published_quiz_with_one_question(db, org, admin_user)
    await _take_attempt(db, org, quiz, question, parent_user, correct=True)

    progress = await get_child_quiz_progress(
        request=None, child_user_id=regular_user.id, current_user=parent, db_session=db
    )
    assert progress == []
