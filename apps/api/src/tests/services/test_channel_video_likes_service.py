"""
Service-layer tests for ChannelVideoLike (Phase 4B).

Exercises the service functions directly (matches the style of
test_organization_follows_service.py / test_channel_videos_service.py):
authenticated like/unlike, idempotency, live count correctness, per-user
isolation, and reuse of the existing ChannelVideo visibility rule (a video
can only be liked/seen-liked by a viewer who could actually watch it).
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.channel_video_likes import ChannelVideoLike
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)
from src.services.orgs.channel_video_likes import (
    get_like_status,
    like_channel_video,
    unlike_channel_video,
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
        activity_uuid="activity_like_1",
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
    """A published, publicly-visible ChannelVideo — likeable by anyone."""
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
# Like / count correctness
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_like_creates_relationship_and_increments_count(db, org, regular_user, published_video):
    status = await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.is_liked is True
    assert status.like_count == 1

    row = (
        await db.execute(
            select(ChannelVideoLike).where(ChannelVideoLike.user_id == regular_user.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.channelvideo_id == published_video.id


@pytest.mark.asyncio
async def test_like_is_idempotent_and_prevents_duplicates(db, org, regular_user, published_video):
    first = await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    second = await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert first.like_count == 1
    assert second.like_count == 1

    rows = (
        await db.execute(
            select(ChannelVideoLike).where(
                ChannelVideoLike.channelvideo_id == published_video.id,
                ChannelVideoLike.user_id == regular_user.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_unlike_removes_relationship(db, org, regular_user, published_video):
    await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    status = await unlike_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.is_liked is False
    assert status.like_count == 0

    row = (
        await db.execute(
            select(ChannelVideoLike).where(ChannelVideoLike.user_id == regular_user.id)
        )
    ).scalars().first()
    assert row is None


@pytest.mark.asyncio
async def test_unlike_when_not_liked_is_a_noop(db, org, regular_user, published_video):
    status = await unlike_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.is_liked is False
    assert status.like_count == 0


@pytest.mark.asyncio
async def test_get_like_status_reflects_current_user_and_total_count(
    db, org, admin_user, regular_user, published_video
):
    await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )
    await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    status_for_liker = await get_like_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status_for_liker.is_liked is True
    assert status_for_liker.like_count == 2


@pytest.mark.asyncio
async def test_like_count_reflects_live_database_state(db, org, regular_user, admin_user, published_video):
    """The count must be a live query, not a cached/denormalized value — insert
    a like directly at the DB layer (bypassing the service) and confirm the
    very next status call reflects it."""
    direct_like = ChannelVideoLike(
        channelvideo_id=published_video.id,
        user_id=admin_user.id,
        like_uuid="direct_insert_like",
        creation_date=str(datetime.now()),
    )
    db.add(direct_like)
    await db.commit()

    status = await get_like_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status.like_count == 1

    await db.delete(direct_like)
    await db.commit()

    status_after_delete = await get_like_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status_after_delete.like_count == 0


@pytest.mark.asyncio
async def test_like_is_isolated_per_user(db, org, admin_user, regular_user, published_video):
    """Liking as one user must not mark another user as having liked it, and
    must not let one user's like/unlike affect another user's row."""
    await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )

    status_for_other_user = await get_like_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status_for_other_user.is_liked is False
    assert status_for_other_user.like_count == 1

    # regular_user unliking (having never liked) must not remove admin_user's like.
    await unlike_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    status_for_admin = await get_like_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )
    assert status_for_admin.is_liked is True
    assert status_for_admin.like_count == 1


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_like_and_unlike_reject_anonymous_users(db, org, anonymous_user, published_video):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await like_channel_video(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401

    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await unlike_channel_video(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_like_status_supports_anonymous_viewers_of_public_video(
    db, org, regular_user, anonymous_user, published_video
):
    await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    status = await get_like_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=anonymous_user, db_session=db,
    )
    assert status.is_liked is False
    assert status.like_count == 1


# ---------------------------------------------------------------------------
# Visibility / ownership (reused from get_channel_video, not duplicated)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_like_unpublished_video_as_non_admin(db, org, regular_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await like_channel_video(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_anonymous_cannot_see_like_status_of_unpublished_video(db, org, anonymous_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await get_like_status(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_like_own_unpublished_draft(db, org, admin_user, draft_video):
    """The channel's own admin can preview/like their own draft — same rule
    get_channel_video already grants for viewing it."""
    status = await like_channel_video(
        request=None, org_id=org.id, channelvideo_id=draft_video.id,
        current_user=admin_user, db_session=db,
    )
    assert status.is_liked is True
    assert status.like_count == 1


@pytest.mark.asyncio
async def test_like_rejects_missing_channel_video(db, org, regular_user):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await like_channel_video(
            request=None, org_id=org.id, channelvideo_id=999999,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_like_rejects_video_from_a_different_organization(
    db, other_org, regular_user, published_video
):
    """A video can't be liked by referencing it through another org's id —
    mirrors get_channel_video's own org-scoped lookup."""
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await like_channel_video(
            request=None, org_id=other_org.id, channelvideo_id=published_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404
