"""
Service-layer tests for Basic Progress Tracking (Phase 6H).

`get_org_quiz_progress` is a read-only aggregation over the existing
`QuizAttempt`/`Quiz` tables — no new table, no new persisted state. Exercises
auth, org scoping (a user's attempts on another org's quiz must never leak
in), own-attempts-only isolation (matches 6G's list_quiz_attempts precedent),
and the aggregation itself (attempts taken, best score, most-recent-graded
score, most-recent-activity ordering across quizzes).
"""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.users import PublicUser, User
from src.db.user_organizations import UserOrganization
from src.services.orgs.questions import QuestionCreate, QuestionPublish, create_question, set_question_published
from src.services.orgs.quizzes import QuizCreate, QuizPublish, QuizQuestionAttach, attach_question_to_quiz, create_quiz, set_quiz_published
from src.services.orgs.quiz_attempts import QuizAnswerSubmit, QuizAttemptSubmit, start_quiz_attempt, submit_quiz_attempt
from src.services.orgs.progress import get_org_quiz_progress

# db, org, other_org, admin_user, regular_user, anonymous_user are provided
# by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def other_user(db, org):
    """A second, unrelated authenticated user — proves progress never mixes
    attempts across users, mirroring 6G's own-attempts-only isolation."""
    u = User(
        id=4, username="other_student", first_name="Other", last_name="Student",
        email="other_student@test.com", password="hashed_password",
        user_uuid="user_other_student",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return PublicUser(
        id=u.id, username=u.username, first_name=u.first_name,
        last_name=u.last_name, email=u.email, user_uuid=u.user_uuid,
    )


@pytest.fixture
async def other_org_admin_user(db, other_org):
    """Admin of `other_org` — used to publish a quiz there for the
    cross-org-isolation test."""
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


@pytest.mark.asyncio
async def test_anonymous_cannot_view_progress(db, org, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await get_org_quiz_progress(request=None, org_id=org.id, current_user=anonymous_user, db_session=db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_progress_nonexistent_org_404s(db, regular_user):
    with pytest.raises(HTTPException) as exc:
        await get_org_quiz_progress(request=None, org_id=999999, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_progress_empty_when_no_attempts(db, org, regular_user):
    progress = await get_org_quiz_progress(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert progress == []


@pytest.mark.asyncio
async def test_progress_aggregates_attempts_best_and_most_recent_score(db, org, admin_user, regular_user):
    quiz, question = await _published_quiz_with_one_question(db, org, admin_user)

    await _take_attempt(db, org, quiz, question, regular_user, correct=True)   # attempt 1: 100%
    await _take_attempt(db, org, quiz, question, regular_user, correct=False)  # attempt 2: 0% (latest graded)
    in_progress = await _take_attempt(db, org, quiz, question, regular_user, correct=False, submit=False)  # attempt 3: in_progress

    progress = await get_org_quiz_progress(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert len(progress) == 1
    summary = progress[0]
    assert summary.quiz_id == quiz.id
    assert summary.quiz_title == quiz.title
    assert summary.attempts_taken == 3
    assert summary.best_score_percentage == pytest.approx(100.0)
    assert summary.most_recent_score_percentage == pytest.approx(0.0)
    assert summary.most_recent_attempt_at == in_progress.started_at


@pytest.mark.asyncio
async def test_progress_none_when_no_graded_attempts_yet(db, org, admin_user, regular_user):
    quiz, question = await _published_quiz_with_one_question(db, org, admin_user)
    await _take_attempt(db, org, quiz, question, regular_user, correct=True, submit=False)

    progress = await get_org_quiz_progress(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert len(progress) == 1
    assert progress[0].attempts_taken == 1
    assert progress[0].best_score_percentage is None
    assert progress[0].most_recent_score_percentage is None


@pytest.mark.asyncio
async def test_progress_only_includes_own_attempts(db, org, admin_user, regular_user, other_user):
    quiz, question = await _published_quiz_with_one_question(db, org, admin_user)

    await _take_attempt(db, org, quiz, question, other_user, correct=True)
    await _take_attempt(db, org, quiz, question, other_user, correct=True)

    progress = await get_org_quiz_progress(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert progress == []


@pytest.mark.asyncio
async def test_progress_scoped_to_org_not_other_orgs_quizzes(
    db, org, other_org, admin_user, other_org_admin_user, regular_user
):
    quiz_a, question_a = await _published_quiz_with_one_question(db, org, admin_user, title="Org quiz")
    quiz_b, question_b = await _published_quiz_with_one_question(db, other_org, other_org_admin_user, title="Other org quiz")

    await _take_attempt(db, org, quiz_a, question_a, regular_user, correct=True)
    await _take_attempt(db, other_org, quiz_b, question_b, regular_user, correct=True)

    progress = await get_org_quiz_progress(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert [p.quiz_id for p in progress] == [quiz_a.id]


@pytest.mark.asyncio
async def test_progress_sorted_by_most_recent_activity_first(db, org, admin_user, regular_user):
    quiz_a, question_a = await _published_quiz_with_one_question(db, org, admin_user, title="First quiz")
    quiz_b, question_b = await _published_quiz_with_one_question(db, org, admin_user, title="Second quiz")

    await _take_attempt(db, org, quiz_a, question_a, regular_user, correct=True)
    await _take_attempt(db, org, quiz_b, question_b, regular_user, correct=True)

    progress = await get_org_quiz_progress(request=None, org_id=org.id, current_user=regular_user, db_session=db)
    assert [p.quiz_id for p in progress] == [quiz_b.id, quiz_a.id]
