"""
Service-layer tests for ChannelVideoShare (Phase 4E).

Adapted from test_channel_video_likes_service.py, but Share is an
append-only event log rather than a toggle (see db/channel_video_shares.py
and docs/ARCHITECTURE.md § "Social Engagement (Phase 4A)"): there is no
unshare, no per-user uniqueness, and repeated shares by the same user are
all valid and all counted — so the tests here cover event creation +
cumulative count rather than idempotency/toggle-off.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.channel_video_shares import ChannelVideoShare
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)
from src.services.orgs.channel_video_shares import (
    get_share_status,
    share_channel_video,
)

# db, org, other_org, admin_user, regular_user, anonymous_user, course are
# provided by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def activity(db, org, course):
    """A hosted-video Activity in the test org, ready to post to the channel."""
    a = Activity(
        name="Intro Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_share_1",
        org_id=org.id,
        course_id=course.id,
        content={"filename": "video.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest.fixture
async def published_video(db, org, admin_user, activity):
    """A published, publicly-visible ChannelVideo — shareable by anyone."""
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Intro Video"),
    )
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )


@pytest.fixture
async def draft_video(db, org, admin_user, activity):
    """An unpublished ChannelVideo — only visible to this channel's admin."""
    return await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Unpublished Draft"),
    )


# ---------------------------------------------------------------------------
# Share / count correctness
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_share_creates_event_and_increments_count(db, org, regular_user, published_video):
    status = await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.share_count == 1

    row = (
        await db.execute(
            select(ChannelVideoShare).where(ChannelVideoShare.user_id == regular_user.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.channelvideo_id == published_video.id


@pytest.mark.asyncio
async def test_repeated_shares_by_the_same_user_all_count(db, org, regular_user, published_video):
    """Unlike Like/Save, Share has no uniqueness constraint — every share
    call inserts a new row and the count keeps climbing."""
    first = await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    second = await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    third = await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert (first.share_count, second.share_count, third.share_count) == (1, 2, 3)

    rows = (
        await db.execute(
            select(ChannelVideoShare).where(
                ChannelVideoShare.channelvideo_id == published_video.id,
                ChannelVideoShare.user_id == regular_user.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 3


@pytest.mark.asyncio
async def test_share_count_is_shared_across_all_users(db, org, admin_user, regular_user, published_video):
    """Unlike Save's per-user status, share_count is a public total across
    every user, same as like_count."""
    await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )
    status = await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.share_count == 2

    status_check = await get_share_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status_check.share_count == 2


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_share_rejects_anonymous_users(db, org, anonymous_user, published_video):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await share_channel_video(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_share_status_supports_anonymous_viewers_of_public_video(
    db, org, anonymous_user, published_video
):
    """Mirrors get_like_status: an anonymous viewer of a public video gets a
    200 with the live share_count, same as a logged-in viewer would see."""
    status = await get_share_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=anonymous_user, db_session=db,
    )
    assert status.share_count == 0


# ---------------------------------------------------------------------------
# Visibility / ownership (reused from get_channel_video, not duplicated)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_share_unpublished_video_as_non_admin(db, org, regular_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await share_channel_video(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_share_own_unpublished_draft(db, org, admin_user, draft_video):
    """The channel's own admin can preview/share their own draft — same rule
    get_channel_video already grants for viewing it."""
    status = await share_channel_video(
        request=None, org_id=org.id, channelvideo_id=draft_video.id,
        current_user=admin_user, db_session=db,
    )
    assert status.share_count == 1


@pytest.mark.asyncio
async def test_share_rejects_missing_channel_video(db, org, regular_user):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await share_channel_video(
            request=None, org_id=org.id, channelvideo_id=999999,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_share_rejects_video_from_a_different_organization(
    db, other_org, regular_user, published_video
):
    """A video can't be shared by referencing it through another org's id —
    mirrors get_channel_video's own org-scoped lookup."""
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await share_channel_video(
            request=None, org_id=other_org.id, channelvideo_id=published_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404
