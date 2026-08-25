"""
Cross-feature integration tests: moderation → discovery (Phase 9E).

Every phase that touches a ChannelVideo's visibility is unit-tested on its
own, and each of those suites passes. What none of them covers is the seam
between them: Phase 8B/8D's moderation action is a channel admin flipping
`published` to False, and the *point* of that action is that the video then
disappears from every surface a viewer could reach it through — surfaces
owned by Phases 2C (channel listing), 3C (global Shorts discovery), 4G (home
feed) and 4B–4C (likes/comments on a video the viewer already engaged with).

Those surfaces each re-derive visibility from `published`/`visibility`
independently — five separate query predicates in three modules, plus
`get_channel_video`'s branch — so "moderation worked" is a property of the
whole set, not of any one of them. The existing per-surface tests all build a
video that was *never* published; nothing exercised the
published → engaged-with → unpublished sequence that moderation actually
produces.

What is new here vs. what is composition (measured during 9E by mutation,
recorded so nobody re-derives it): removing the `get_channel_video`
delegation from likes/comments is caught by their own unit suites too, so
those assertions are a composed re-check, not the only guard. The three
assertions with no other coverage anywhere are the ones about the *shape* of
a moderation action rather than one predicate — that unpublishing one video
leaves its neighbours up, that a resolved report cannot be re-filed against
content already taken down, and that a takedown is reversible (admin still
resolves it, and re-publishing restores it to public listings). Nothing else
in the suite performs a publish → unpublish → publish round trip.

Deliberately NOT covered here:
  - Report submission/queue/resolve authorization — fully covered by
    test_channel_video_reports_service.py; not duplicated.
  - Row cascade on hard delete. The FK ondelete="CASCADE" clauses in
    db/channel_video_*.py are enforced by Postgres, but this suite runs on
    SQLite with PRAGMA foreign_keys off by default, so a test here would
    assert the test harness's behavior rather than production's. Left to a
    real-database integration pass; see docs/PROGRESS.md Phase 9E.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.services.orgs.channel_video_comments import (
    create_channel_video_comment,
    list_channel_video_comments,
)
from src.services.orgs.channel_video_likes import like_channel_video, get_like_status
from src.services.orgs.channel_video_reports import (
    ChannelVideoReportCreate,
    ChannelVideoReportStatusUpdate,
    create_channel_video_report,
    resolve_channel_video_report,
)
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    get_channel_video,
    list_channel_videos,
    list_home_feed,
    list_public_shorts,
    set_channel_video_published,
)
from src.services.orgs.follows import follow_organization

# db, org, admin_user, regular_user, anonymous_user, course are provided by
# conftest.py as async fixtures backed by an async SQLite engine.


async def _activity(db, org, course, key):
    a = Activity(
        name=f"Activity {key}",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid=f"activity_moderation_{key}",
        org_id=org.id,
        course_id=course.id,
        content={"filename": f"{key}.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


async def _published(db, org, admin_user, course, key, **fields):
    activity = await _activity(db, org, course, key)
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title=f"Video {key}", **fields),
    )
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )


async def _unpublish(db, org, admin_user, video):
    """The Phase 8D moderation quick action — the admin unpublishes the
    reported video straight from /dash/moderation, reusing the Phase 2A
    endpoint. Exactly what that button calls."""
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=False),
    )


# ── The long-form surfaces: channel listing + home feed ─────────────────────

@pytest.mark.asyncio
async def test_moderating_a_long_video_removes_it_from_every_viewer_surface(
    db, org, admin_user, regular_user, anonymous_user, course
):
    """A video that a viewer could see, engage with and reach directly must
    become unreachable through all three of those paths once moderated —
    channel listing (2C), home feed (4G), and direct fetch (2C)."""
    video = await _published(db, org, admin_user, course, "long1", content_format="long")
    await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    # Baseline: visible everywhere before moderation. Asserting this first is
    # what stops the post-moderation assertions from passing vacuously.
    assert [v.id for v in await list_channel_videos(
        request=None, org_id=org.id, current_user=anonymous_user, db_session=db
    )] == [video.id]
    assert [v.id for v in await list_home_feed(regular_user, db)] == [video.id]
    assert (await get_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id,
        current_user=regular_user, db_session=db,
    )).id == video.id

    await _unpublish(db, org, admin_user, video)

    assert await list_channel_videos(
        request=None, org_id=org.id, current_user=anonymous_user, db_session=db
    ) == []
    assert await list_home_feed(regular_user, db) == []
    with pytest.raises(HTTPException) as exc:
        await get_channel_video(
            request=None, org_id=org.id, channelvideo_id=video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_moderation_does_not_take_down_the_rest_of_the_channel(
    db, org, admin_user, regular_user, anonymous_user, course
):
    """The other half of the contract: unpublishing one video must not
    collateral-damage its neighbours. A moderation action that emptied the
    whole channel would satisfy every assertion in the test above."""
    bad = await _published(db, org, admin_user, course, "bad", content_format="long")
    good = await _published(db, org, admin_user, course, "good", content_format="long")
    await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    await _unpublish(db, org, admin_user, bad)

    assert [v.id for v in await list_channel_videos(
        request=None, org_id=org.id, current_user=anonymous_user, db_session=db
    )] == [good.id]
    assert [v.id for v in await list_home_feed(regular_user, db)] == [good.id]
    assert (await get_channel_video(
        request=None, org_id=org.id, channelvideo_id=good.id,
        current_user=anonymous_user, db_session=db,
    )).id == good.id


# ── The Shorts surface: global, cross-org discovery ─────────────────────────

@pytest.mark.asyncio
async def test_moderating_a_short_removes_it_from_global_shorts_discovery(
    db, org, admin_user, course
):
    """`list_public_shorts` is the one discovery surface that is neither
    org-scoped nor user-aware — it takes no `current_user` and has no
    admin-preview branch, so its published predicate is the *only* thing
    keeping a moderated short off every user's Shorts feed platform-wide."""
    short = await _published(db, org, admin_user, course, "short1", content_format="short")

    assert [v.id for v in await list_public_shorts(db)] == [short.id]

    await _unpublish(db, org, admin_user, short)

    assert await list_public_shorts(db) == []


# ── The engagement surfaces: an already-engaged viewer loses access ─────────

@pytest.mark.asyncio
async def test_moderating_a_video_cuts_off_engagement_by_a_viewer_who_already_engaged(
    db, org, admin_user, regular_user, course
):
    """Likes and comments route their visibility decision through
    `get_channel_video` rather than re-deriving it (see each module's
    docstring). This is the test that proves that indirection actually holds
    end to end: a viewer who liked and commented while the video was public
    must lose read *and* write access the moment it is moderated — including
    to the comment they wrote themselves."""
    video = await _published(db, org, admin_user, course, "eng1", content_format="long")

    await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id,
        current_user=regular_user, db_session=db,
    )
    await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=video.id,
        content="Great explanation, thanks!", current_user=regular_user, db_session=db,
    )

    # Baseline: the viewer can read both surfaces while the video is public.
    assert (await get_like_status(
        request=None, org_id=org.id, channelvideo_id=video.id,
        current_user=regular_user, db_session=db,
    )).is_liked is True
    assert len(await list_channel_video_comments(
        request=None, org_id=org.id, channelvideo_id=video.id,
        current_user=regular_user, db_session=db,
    )) == 1

    await _unpublish(db, org, admin_user, video)

    for call in (
        get_like_status(
            request=None, org_id=org.id, channelvideo_id=video.id,
            current_user=regular_user, db_session=db,
        ),
        list_channel_video_comments(
            request=None, org_id=org.id, channelvideo_id=video.id,
            current_user=regular_user, db_session=db,
        ),
        create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=video.id,
            content="Another comment", current_user=regular_user, db_session=db,
        ),
        like_channel_video(
            request=None, org_id=org.id, channelvideo_id=video.id,
            current_user=regular_user, db_session=db,
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await call
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_the_reporter_cannot_re_report_a_video_after_it_is_moderated(
    db, org, admin_user, regular_user, course
):
    """Reporting also delegates to `get_channel_video`. Once the report has
    been acted on and the video pulled, the reporter has no visibility left
    to report through — which is what keeps a resolved queue from being
    re-filled against content that is already down."""
    video = await _published(db, org, admin_user, course, "rep1", content_format="long")

    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )
    assert report.status == "OPEN"

    await _unpublish(db, org, admin_user, video)
    resolved = await resolve_channel_video_report(
        request=None, org_id=org.id, report_uuid=report.report_uuid,
        data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
        current_user=admin_user, db_session=db,
    )
    assert resolved.status == "RESOLVED"

    with pytest.raises(HTTPException) as exc:
        await create_channel_video_report(
            request=None, org_id=org.id, channelvideo_id=video.id,
            data=ChannelVideoReportCreate(reason="SPAM"),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


# ── The admin side: moderation must stay reversible ─────────────────────────

@pytest.mark.asyncio
async def test_the_channel_admin_still_sees_the_moderated_video_and_can_restore_it(
    db, org, admin_user, anonymous_user, course
):
    """Unpublishing is a takedown, not a deletion — the owner/admin preview
    branch must still resolve the video so the moderation decision can be
    reviewed and reversed. Without this, "unpublish" would be a one-way door
    with no UI path back."""
    video = await _published(db, org, admin_user, course, "rev1", content_format="long")
    await _unpublish(db, org, admin_user, video)

    # Still there for the admin, on both the listing and the direct fetch.
    assert [v.id for v in await list_channel_videos(
        request=None, org_id=org.id, current_user=admin_user, db_session=db
    )] == [video.id]
    assert (await get_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id,
        current_user=admin_user, db_session=db,
    )).published is False

    restored = await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )
    assert restored.published is True
    assert [v.id for v in await list_channel_videos(
        request=None, org_id=org.id, current_user=anonymous_user, db_session=db
    )] == [video.id]
