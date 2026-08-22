"""
Service-layer tests for QuizAttempt/QuizAnswer (Phase 6D).

Exercises the service functions directly (matches the style of
test_quizzes_service.py): starting an attempt (auth + published/preview
visibility + the leak-prevention gate on the returned questions),
fetching an attempt (ownership + in-progress vs. graded shape), and
submitting/auto-grading an attempt (all three V1 question types, missing
answers, resubmission, and question_id validation).
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.quiz_attempts import QuizAttempt
from src.db.users import PublicUser, User
from src.services.orgs.questions import QuestionCreate, QuestionPublish, create_question, set_question_published
from src.services.orgs.quizzes import QuizCreate, QuizPublish, QuizQuestionAttach, attach_question_to_quiz, create_quiz, set_quiz_published
from src.services.orgs.quiz_attempts import (
    QuizAnswerSubmit,
    QuizAttemptSubmit,
    get_quiz_attempt,
    list_quiz_attempts,
    start_quiz_attempt,
    submit_quiz_attempt,
)

# db, org, admin_user, regular_user, anonymous_user are provided by
# conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def other_user(db, org):
    """A second, unrelated authenticated user — no org role — used to prove
    an attempt can only be accessed by the user who started it."""
    u = User(
        id=4,
        username="other_student",
        first_name="Other",
        last_name="Student",
        email="other_student@test.com",
        password="hashed_password",
        user_uuid="user_other_student",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return PublicUser(
        id=u.id, username=u.username, first_name=u.first_name,
        last_name=u.last_name, email=u.email, user_uuid=u.user_uuid,
    )


async def _published_quiz_with_questions(db, org, admin_user):
    """A published quiz with one of each auto-gradable question type,
    attached in a fixed order: multiple_choice, short_answer, number_answer."""
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuizCreate(title="Mixed Quiz"),
    )
    quiz = await set_quiz_published(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user,
        db_session=db, data=QuizPublish(published=True),
    )

    async def _bank(question_type, prompt, contents, explanation=None):
        q = await create_question(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=QuestionCreate(question_type=question_type, prompt=prompt, contents=contents, explanation=explanation),
        )
        return await set_question_published(
            request=None, org_id=org.id, question_id=q.id, current_user=admin_user,
            db_session=db, data=QuestionPublish(published=True),
        )

    mc = await _bank(
        "multiple_choice", "2 + 2?",
        {"options": [{"id": "a", "text": "3", "is_correct": False}, {"id": "b", "text": "4", "is_correct": True}]},
        explanation="Basic addition.",
    )
    sa = await _bank(
        "short_answer", "Capital of Kenya?",
        {"accepted_answers": ["Nairobi"]},
    )
    na = await _bank(
        "number_answer", "5 * 3?",
        {"accepted_answers": [15]},
    )

    for q in (mc, sa, na):
        await attach_question_to_quiz(
            request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db,
            data=QuizQuestionAttach(question_id=q.id),
        )

    return quiz, mc, sa, na


# ── Starting an attempt ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_anonymous_cannot_start_attempt(db, org, admin_user, anonymous_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    with pytest.raises(HTTPException) as exc:
        await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=anonymous_user, db_session=db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_regular_user_cannot_start_attempt_on_unpublished_quiz(db, org, admin_user, regular_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=QuizCreate(title="Draft"),
    )
    with pytest.raises(HTTPException) as exc:
        await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_preview_own_unpublished_quiz(db, org, admin_user):
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, data=QuizCreate(title="Draft"),
    )
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=admin_user, db_session=db)
    assert attempt.status == "in_progress"


@pytest.mark.asyncio
async def test_start_attempt_strips_answer_key_and_increments_attempt_number(db, org, admin_user, regular_user):
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user)

    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert attempt.status == "in_progress"
    assert attempt.attempt_number == 1
    assert attempt.answers is None
    assert [q.id for q in attempt.questions] == [mc.id, sa.id, na.id]

    mc_view = attempt.questions[0]
    assert all("is_correct" not in opt for opt in mc_view.contents["options"])
    sa_view = attempt.questions[1]
    assert "accepted_answers" not in sa_view.contents
    assert not hasattr(mc_view, "explanation")

    second = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert second.attempt_number == 2


# ── Fetching an attempt ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_attempt_requires_ownership(db, org, admin_user, regular_user, other_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    with pytest.raises(HTTPException) as exc:
        await get_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=other_user, db_session=db,
        )
    assert exc.value.status_code == 403

    fetched = await get_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
    )
    assert fetched.id == attempt.id
    assert fetched.questions is not None
    assert fetched.answers is None


@pytest.mark.asyncio
async def test_get_nonexistent_attempt_404s(db, org, admin_user, regular_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    with pytest.raises(HTTPException) as exc:
        await get_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=999999,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


# ── Submitting + auto-grading ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_submit_grades_all_three_question_types_and_computes_score(db, org, admin_user, regular_user):
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    graded = await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[
            QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),   # correct
            QuizAnswerSubmit(question_id=sa.id, answer={"text": " nairobi "}),          # correct, case/space-insensitive
            QuizAnswerSubmit(question_id=na.id, answer={"value": 12}),                  # wrong
        ]),
    )

    assert graded.status == "graded"
    assert graded.submitted_at is not None
    assert graded.score_percentage == pytest.approx(200 / 3)
    assert graded.questions is None

    results = {r.question_id: r for r in graded.answers}
    assert results[mc.id].is_correct is True
    assert results[sa.id].is_correct is True
    assert results[na.id].is_correct is False
    # Full answer key/explanation revealed only after grading.
    assert results[mc.id].question.explanation == "Basic addition."
    assert any(opt["is_correct"] for opt in results[mc.id].question.contents["options"])

    row = (await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt.id))).scalars().first()
    assert row.status == "graded"


@pytest.mark.asyncio
async def test_unanswered_questions_graded_incorrect(db, org, admin_user, regular_user):
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    graded = await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"})]),
    )
    assert graded.score_percentage == pytest.approx(100 / 3)
    results = {r.question_id: r for r in graded.answers}
    assert results[sa.id].is_correct is False
    assert results[na.id].is_correct is False


@pytest.mark.asyncio
async def test_submit_requires_ownership(db, org, admin_user, regular_user, other_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=other_user, db_session=db, data=QuizAttemptSubmit(answers=[]),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_cannot_resubmit_graded_attempt(db, org, admin_user, regular_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db, data=QuizAttemptSubmit(answers=[]),
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db, data=QuizAttemptSubmit(answers=[]),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_submit_rejects_question_not_attached_to_quiz(db, org, admin_user, regular_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[QuizAnswerSubmit(question_id=999999, answer={})]),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_submit_rejects_duplicate_question_ids(db, org, admin_user, regular_user):
    quiz, mc, _sa, _na = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={}),
                QuizAnswerSubmit(question_id=mc.id, answer={}),
            ]),
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_get_attempt_after_grading_returns_full_results_not_stripped(db, org, admin_user, regular_user):
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"})]),
    )

    fetched = await get_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
    )
    assert fetched.status == "graded"
    assert fetched.questions is None
    assert fetched.answers is not None
    assert len(fetched.answers) == 3


# ── Listing a user's attempt history (Phase 6G — Results) ───────────────

@pytest.mark.asyncio
async def test_anonymous_cannot_list_attempts(db, org, admin_user, anonymous_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    with pytest.raises(HTTPException) as exc:
        await list_quiz_attempts(request=None, org_id=org.id, quiz_id=quiz.id, current_user=anonymous_user, db_session=db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_list_attempts_nonexistent_quiz_404s(db, org, regular_user):
    with pytest.raises(HTTPException) as exc:
        await list_quiz_attempts(request=None, org_id=org.id, quiz_id=999999, current_user=regular_user, db_session=db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_attempts_empty_when_none_taken(db, org, admin_user, regular_user):
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempts = await list_quiz_attempts(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert attempts == []


@pytest.mark.asyncio
async def test_list_attempts_returns_only_own_attempts_newest_first(db, org, admin_user, regular_user, other_user):
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user)

    first = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=first.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"})]),
    )
    second = await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)

    # A second, unrelated user's attempt must never leak into this list.
    await start_quiz_attempt(request=None, org_id=org.id, quiz_id=quiz.id, current_user=other_user, db_session=db)

    attempts = await list_quiz_attempts(request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db)
    assert [a.attempt_number for a in attempts] == [2, 1]
    assert [a.id for a in attempts] == [second.id, first.id]
    assert attempts[1].status == "graded"
    assert attempts[1].score_percentage == pytest.approx(100 / 3)
    assert attempts[0].status == "in_progress"
