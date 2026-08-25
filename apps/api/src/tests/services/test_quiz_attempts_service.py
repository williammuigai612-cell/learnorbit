"""
Service-layer tests for QuizAttempt/QuizAnswer (Phase 6D).

Exercises the service functions directly (matches the style of
test_quizzes_service.py): starting an attempt (auth + published/preview
visibility + the leak-prevention gate on the returned questions),
fetching an attempt (ownership + in-progress vs. graded shape), and
submitting/auto-grading an attempt (all three V1 question types, missing
answers, resubmission, and question_id validation).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.quiz_attempts import QuizAnswer, QuizAttempt
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


async def _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=None):
    """A published quiz with one of each auto-gradable question type,
    attached in a fixed order: multiple_choice, short_answer, number_answer.

    `time_limit_minutes` defaults to None (untimed), so every existing caller
    is unaffected; the time-limit tests below pass it explicitly."""
    quiz = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuizCreate(title="Mixed Quiz", time_limit_minutes=time_limit_minutes),
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


# ═══════════════════════════════════════════════════════════════════════════
# Phase 9E — exam-integrity regression tests
#
# Everything below covers guards that quiz_attempts.py already implements and
# marks `SECURITY:` in its own source, but that no test exercised before 9E.
# quiz_attempts was the only LearnOrbit module without an explicit cross-org
# case (videos/resources/questions/quizzes/reports/comments/likes/saves/shares
# each have one), and it is the module where a missed predicate leaks an
# answer key rather than a title.
#
# Each assertion below was mutation-checked during 9E: the corresponding
# predicate was removed in a scratch copy of the service and the test watched
# to fail, so none of these pass vacuously.
# ═══════════════════════════════════════════════════════════════════════════


@pytest.fixture
async def other_org_admin_user(db, other_org):
    """Admin of `other_org` — used to populate a second channel whose quizzes
    must stay unreachable through this org's id. Same shape as
    test_quizzes_service.py's fixture of the same name."""
    from src.db.user_organizations import UserOrganization

    u = User(
        id=5,
        username="other_org_admin",
        first_name="Other",
        last_name="OrgAdmin",
        email="other_org_admin@test.com",
        password="hashed_password",
        user_uuid="user_other_org_admin",
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


# ── Cross-organization isolation: _get_quiz_or_404's org_id predicate ───────

@pytest.mark.asyncio
async def test_cannot_start_an_attempt_on_another_orgs_quiz_through_this_org(
    db, org, other_org, other_org_admin_user, regular_user
):
    """SECURITY: the quiz lives in other_org; addressing it through `org`'s
    id must 404, not start an attempt. Without the org_id predicate in
    _get_quiz_or_404 any authenticated user could sit any channel's exam."""
    quiz, *_ = await _published_quiz_with_questions(db, other_org, other_org_admin_user)

    with pytest.raises(HTTPException) as exc:
        await start_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404

    # No attempt row was created as a side effect of the rejected call.
    rows = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id)
    )).scalars().all()
    assert rows == []


@pytest.mark.asyncio
async def test_cannot_read_an_attempt_through_another_orgs_id(
    db, org, other_org, admin_user, regular_user
):
    """SECURITY: an attempt legitimately started in `org` must not be
    readable by re-addressing the same quiz/attempt ids under other_org."""
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await get_quiz_attempt(
            request=None, org_id=other_org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_cannot_submit_an_attempt_through_another_orgs_id(
    db, org, other_org, admin_user, regular_user
):
    """SECURITY: the same org_id predicate must hold on the mutating path —
    a 404 here, and the attempt left ungraded."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=other_org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
            ]),
        )
    assert exc.value.status_code == 404

    still = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt.id)
    )).scalars().first()
    assert still.status == "in_progress"


@pytest.mark.asyncio
async def test_list_attempts_cannot_reach_another_orgs_quiz(
    db, org, other_org, other_org_admin_user, regular_user
):
    """SECURITY: list_quiz_attempts resolves the quiz through the same
    org-scoped helper — attempt history must not be enumerable across
    channels either."""
    quiz, *_ = await _published_quiz_with_questions(db, other_org, other_org_admin_user)
    await start_quiz_attempt(
        request=None, org_id=other_org.id, quiz_id=quiz.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await list_quiz_attempts(
            request=None, org_id=org.id, quiz_id=quiz.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


# ── Cross-quiz isolation: _get_attempt_or_404's quiz_id predicate ───────────

@pytest.mark.asyncio
async def test_cannot_read_an_attempt_through_a_different_quiz_in_the_same_org(
    db, org, admin_user, regular_user
):
    """SECURITY: _get_attempt_or_404 is scoped to quiz_id. Two quizzes in the
    same channel — an attempt on quiz A must 404 when addressed under quiz B,
    even though the caller owns the attempt and belongs to the org.

    This is the guard that stops attempt ids from being probed across a
    channel's whole exam catalogue."""
    quiz_a, *_ = await _published_quiz_with_questions(db, org, admin_user)
    quiz_b = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuizCreate(title="Second Quiz"),
    )
    quiz_b = await set_quiz_published(
        request=None, org_id=org.id, quiz_id=quiz_b.id, current_user=admin_user,
        db_session=db, data=QuizPublish(published=True),
    )

    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz_a.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await get_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz_b.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404

    # The correct addressing still works — the 404 above is the predicate
    # firing, not the attempt being missing.
    ok = await get_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz_a.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
    )
    assert ok.id == attempt.id


@pytest.mark.asyncio
async def test_cannot_submit_an_attempt_through_a_different_quiz(
    db, org, admin_user, regular_user
):
    """SECURITY: the cross-quiz guard must hold on submit too. Grading an
    attempt against another quiz's question set would both corrupt the score
    and grade questions the student never saw."""
    quiz_a, mc, *_ = await _published_quiz_with_questions(db, org, admin_user)
    quiz_b = await create_quiz(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=QuizCreate(title="Second Quiz"),
    )
    quiz_b = await set_quiz_published(
        request=None, org_id=org.id, quiz_id=quiz_b.id, current_user=admin_user,
        db_session=db, data=QuizPublish(published=True),
    )

    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz_a.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz_b.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
            ]),
        )
    assert exc.value.status_code == 404

    still = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt.id)
    )).scalars().first()
    assert still.status == "in_progress"


# ── Authentication on the two paths that had no anonymous case ─────────────

@pytest.mark.asyncio
async def test_anonymous_cannot_get_an_attempt(db, org, admin_user, regular_user, anonymous_user):
    """start_quiz_attempt and list_quiz_attempts each had an anonymous test;
    get_quiz_attempt did not. All four entry points reject anonymously."""
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await get_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_anonymous_cannot_submit_an_attempt(db, org, admin_user, regular_user, anonymous_user):
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id,
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=anonymous_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
            ]),
        )
    assert exc.value.status_code == 401

    still = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt.id)
    )).scalars().first()
    assert still.status == "in_progress"


# ── Answer-key containment on the *resume* path ─────────────────────────────

@pytest.mark.asyncio
async def test_resuming_an_in_progress_attempt_still_strips_the_answer_key(
    db, org, admin_user, regular_user
):
    """SECURITY: _strip_question has two call sites — start_quiz_attempt and
    get_quiz_attempt (the "reload the exam page" path). Only the first was
    asserted; a regression that stripped on start but not on resume would
    have passed the whole suite while serving every answer key to any student
    who refreshed the page.

    Asserts the same three containment properties as the start-path test: no
    `is_correct` on options, no `accepted_answers`, no `explanation`."""
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id,
        current_user=regular_user, db_session=db,
    )

    resumed = await get_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
    )

    assert resumed.status == "in_progress"
    assert resumed.answers is None
    assert [q.id for q in resumed.questions] == [mc.id, sa.id, na.id]

    mc_view, sa_view, na_view = resumed.questions
    # multiple_choice: option text is meant to be visible, `is_correct` is not.
    assert all("is_correct" not in opt for opt in mc_view.contents["options"])
    assert {opt["text"] for opt in mc_view.contents["options"]} == {"3", "4"}
    # short_answer / number_answer: accepted_answers IS the key.
    assert "accepted_answers" not in sa_view.contents
    assert "accepted_answers" not in na_view.contents
    # explanation is a top-level Question column absent from QuestionForAttempt.
    assert not hasattr(mc_view, "explanation")

    # Nothing anywhere in the serialized payload leaks the key — catches a
    # future field being added to QuestionForAttempt without being stripped.
    payload = resumed.model_dump_json()
    assert "is_correct" not in payload
    assert "accepted_answers" not in payload
    assert "Basic addition." not in payload


# ── Server-side time-limit enforcement ───────────────────────────────────
# SECURITY_REVIEW.md §45 / §2.19 / §54.23. Before this, the time limit lived
# only in apps/web/components/Objects/Channel/QuizTimer.tsx, so a student who
# let the timer run out — or a client that never ran it — could still have a
# late attempt graded normally. Enforcement now happens in
# submit_quiz_attempt via _require_within_time_limit; these tests drive the
# service directly, with no frontend in the loop at all.
#
# Elapsed time is simulated by rewriting `started_at` rather than sleeping,
# so the boundary can be hit exactly.


async def _rewind_started_at(db, attempt_id, value):
    """Set an attempt's `started_at` to `value` (the on-disk form is a naive
    string in UTC, exactly what `_now()` writes)."""
    row = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id)
    )).scalars().first()
    row.started_at = value
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def _naive_utc(dt):
    return str(dt.astimezone(timezone.utc).replace(tzinfo=None))


async def _assert_not_graded(db, attempt_id):
    """A rejected submission must leave no trace: the attempt stays
    in_progress and not one answer row was written."""
    row = (await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id)
    )).scalars().first()
    assert row.status == "in_progress"
    assert row.submitted_at is None
    assert row.score_percentage == 0.0
    answers = (await db.execute(
        select(QuizAnswer).where(QuizAnswer.quizattempt_id == attempt_id)
    )).scalars().all()
    assert answers == []


@pytest.mark.asyncio
async def test_expired_attempt_cannot_be_submitted(db, org, admin_user, regular_user):
    """The core finding: a submission past the deadline is rejected, not graded."""
    quiz, mc, sa, na = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    # Started 31 minutes ago on a 30-minute quiz.
    await _rewind_started_at(
        db, attempt.id, _naive_utc(datetime.now(timezone.utc) - timedelta(minutes=31)),
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
                QuizAnswerSubmit(question_id=sa.id, answer={"text": "Nairobi"}),
                QuizAnswerSubmit(question_id=na.id, answer={"value": 15}),
            ]),
        )
    assert exc.value.status_code == 409
    assert "expired" in exc.value.detail.lower()
    # All-correct answers, and still no score — the grader was never reached.
    await _assert_not_graded(db, attempt.id)


@pytest.mark.asyncio
async def test_submission_one_second_before_deadline_is_accepted(db, org, admin_user, regular_user):
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await _rewind_started_at(
        db, attempt.id,
        _naive_utc(datetime.now(timezone.utc) - timedelta(minutes=30) + timedelta(seconds=1)),
    )

    graded = await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[
            QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
        ]),
    )
    assert graded.status == "graded"


class _ClockAt:
    """Stands in for the service module's `datetime`, with `now()` frozen to a
    chosen instant so the deadline comparison can be hit *exactly*. Wall-clock
    time can never land on `started_at + limit` to the microsecond, so without
    this the difference between `>` and `>=` is untestable. Everything except
    `now` delegates to the real class."""

    def __init__(self, frozen):
        self._frozen = frozen

    def now(self, tz=None):
        return self._frozen

    @staticmethod
    def fromisoformat(value):
        return datetime.fromisoformat(value)


async def _submit_with_clock_at(db, org, quiz, attempt_id, mc, regular_user, frozen_now):
    with patch("src.services.orgs.quiz_attempts.datetime", _ClockAt(frozen_now)):
        return await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt_id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
            ]),
        )


@pytest.mark.asyncio
async def test_submission_exactly_at_deadline_is_accepted(db, org, admin_user, regular_user):
    """Boundary, exact: the deadline is inclusive — a 30-minute quiz means 30
    minutes, so `now == deadline` still grades. Only `now > deadline` expires.
    The clock is frozen precisely on the deadline; with a `>=` comparison this
    test fails."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    started = datetime(2026, 8, 24, 10, 0, 0, tzinfo=timezone.utc)
    await _rewind_started_at(db, attempt.id, _naive_utc(started))

    graded = await _submit_with_clock_at(
        db, org, quiz, attempt.id, mc, regular_user, started + timedelta(minutes=30),
    )
    assert graded.status == "graded"


@pytest.mark.asyncio
async def test_submission_one_microsecond_past_deadline_is_rejected(db, org, admin_user, regular_user):
    """The tightest possible failing case — one microsecond over the same
    frozen deadline as the test above."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    started = datetime(2026, 8, 24, 10, 0, 0, tzinfo=timezone.utc)
    await _rewind_started_at(db, attempt.id, _naive_utc(started))

    with pytest.raises(HTTPException) as exc:
        await _submit_with_clock_at(
            db, org, quiz, attempt.id, mc, regular_user,
            started + timedelta(minutes=30, microseconds=1),
        )
    assert exc.value.status_code == 409
    await _assert_not_graded(db, attempt.id)


@pytest.mark.asyncio
async def test_submission_just_past_deadline_is_rejected(db, org, admin_user, regular_user):
    """The other side of the same boundary — one second over is over."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await _rewind_started_at(
        db, attempt.id,
        _naive_utc(datetime.now(timezone.utc) - timedelta(minutes=30) - timedelta(seconds=1)),
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
            ]),
        )
    assert exc.value.status_code == 409
    await _assert_not_graded(db, attempt.id)


@pytest.mark.asyncio
async def test_untimed_quiz_is_unaffected_by_the_time_limit_check(db, org, admin_user, regular_user):
    """Regression guard: `time_limit_minutes is None` must short-circuit, so a
    quiz with no limit can still be submitted however long it has been open."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await _rewind_started_at(
        db, attempt.id, _naive_utc(datetime.now(timezone.utc) - timedelta(days=400)),
    )

    graded = await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[
            QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
        ]),
    )
    assert graded.status == "graded"


@pytest.mark.asyncio
async def test_started_at_is_read_as_utc_not_local_time(db, org, admin_user, regular_user):
    """Timezone correctness. `started_at` is stored naive but *means* UTC. If
    it were re-read as local time on a server east of UTC, a fresh attempt
    would look hours old and be wrongly expired; west of UTC, a stale one
    would look fresh. Here the attempt started 5 minutes ago in real UTC
    terms on a 30-minute quiz, so it must grade regardless of the offset."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await _rewind_started_at(
        db, attempt.id, _naive_utc(datetime.now(timezone.utc) - timedelta(minutes=5)),
    )

    graded = await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[
            QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
        ]),
    )
    assert graded.status == "graded"


@pytest.mark.asyncio
async def test_offset_aware_started_at_is_honoured_not_clobbered(db, org, admin_user, regular_user):
    """If a `started_at` ever carries an explicit offset, it must be respected
    rather than overwritten with UTC. 20 minutes ago expressed as -05:00 is
    still 20 minutes ago, so a 30-minute window has not closed. A negative
    offset is used deliberately: discarding it and stamping the wall-clock
    digits as UTC would make the attempt look 5h20m old and wrongly expire it,
    so this test fails if the `tzinfo is None` guard is dropped."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    aware_start = (datetime.now(timezone.utc) - timedelta(minutes=20)).astimezone(
        timezone(timedelta(hours=-5))
    )
    await _rewind_started_at(db, attempt.id, aware_start.isoformat())

    graded = await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[
            QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
        ]),
    )
    assert graded.status == "graded"


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_started_at", ["", "not-a-timestamp"])
async def test_timed_attempt_with_unusable_started_at_fails_closed(
    db, org, admin_user, regular_user, bad_started_at
):
    """Fail closed: if a timed attempt's start cannot be established, it
    cannot be shown to be inside its window, so it is refused rather than
    graded. An untimed quiz is untouched by this path (covered above)."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await _rewind_started_at(db, attempt.id, bad_started_at)

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
            ]),
        )
    assert exc.value.status_code == 409
    await _assert_not_graded(db, attempt.id)


@pytest.mark.asyncio
async def test_expiry_is_checked_before_answer_shape_validation(db, org, admin_user, regular_user):
    """An expired attempt must not leak which question ids belong to the quiz:
    a payload that would otherwise draw a 422 gets the 409 instead."""
    quiz, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await _rewind_started_at(
        db, attempt.id, _naive_utc(datetime.now(timezone.utc) - timedelta(minutes=31)),
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db,
            data=QuizAttemptSubmit(answers=[
                QuizAnswerSubmit(question_id=999999, answer={}),
            ]),
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_already_graded_attempt_still_reports_resubmission_not_expiry(
    db, org, admin_user, regular_user
):
    """Ordering guard: the existing resubmission 409 keeps its own message —
    the expiry check sits after it, not in front of it."""
    quiz, mc, *_ = await _published_quiz_with_questions(db, org, admin_user, time_limit_minutes=30)
    attempt = await start_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, current_user=regular_user, db_session=db,
    )
    await submit_quiz_attempt(
        request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
        current_user=regular_user, db_session=db,
        data=QuizAttemptSubmit(answers=[
            QuizAnswerSubmit(question_id=mc.id, answer={"selected_option_id": "b"}),
        ]),
    )
    await _rewind_started_at(
        db, attempt.id, _naive_utc(datetime.now(timezone.utc) - timedelta(minutes=31)),
    )

    with pytest.raises(HTTPException) as exc:
        await submit_quiz_attempt(
            request=None, org_id=org.id, quiz_id=quiz.id, attempt_id=attempt.id,
            current_user=regular_user, db_session=db, data=QuizAttemptSubmit(answers=[]),
        )
    assert exc.value.status_code == 409
    assert "already been submitted" in exc.value.detail
