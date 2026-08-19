"""
Service-layer tests for ChannelVideoSave (Phase 4D).

Mirrors test_channel_video_likes_service.py exactly, adapted for saves: a
save is a private per-user bookmark (queried by user_id, not exposed as a
public count) rather than a public like count — see
db/channel_video_saves.py and docs/ARCHITECTURE.md § "Social Engagement
(Phase 4A)".
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.channel_video_saves import ChannelVideoSave
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)
from src.services.orgs.channel_video_saves import (
    get_save_status,
    save_channel_video,
    unsave_channel_video,
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
        activity_uuid="activity_save_1",
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
    """A published, publicly-visible ChannelVideo — saveable by anyone."""
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
# Save / status correctness
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_creates_relationship(db, org, regular_user, published_video):
    status = await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.is_saved is True

    row = (
        await db.execute(
            select(ChannelVideoSave).where(ChannelVideoSave.user_id == regular_user.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.channelvideo_id == published_video.id


@pytest.mark.asyncio
async def test_save_is_idempotent_and_prevents_duplicates(db, org, regular_user, published_video):
    first = await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    second = await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert first.is_saved is True
    assert second.is_saved is True

    rows = (
        await db.execute(
            select(ChannelVideoSave).where(
                ChannelVideoSave.channelvideo_id == published_video.id,
                ChannelVideoSave.user_id == regular_user.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_unsave_removes_relationship(db, org, regular_user, published_video):
    await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    status = await unsave_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.is_saved is False

    row = (
        await db.execute(
            select(ChannelVideoSave).where(ChannelVideoSave.user_id == regular_user.id)
        )
    ).scalars().first()
    assert row is None


@pytest.mark.asyncio
async def test_unsave_when_not_saved_is_a_noop(db, org, regular_user, published_video):
    status = await unsave_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert status.is_saved is False


@pytest.mark.asyncio
async def test_get_save_status_reflects_current_user_only(
    db, org, admin_user, regular_user, published_video
):
    await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )

    status_for_non_saver = await get_save_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status_for_non_saver.is_saved is False


@pytest.mark.asyncio
async def test_save_is_isolated_per_user(db, org, admin_user, regular_user, published_video):
    """Saving as one user must not mark another user as having saved it, and
    must not let one user's save/unsave affect another user's row."""
    await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )

    status_for_other_user = await get_save_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    assert status_for_other_user.is_saved is False

    # regular_user unsaving (having never saved) must not remove admin_user's save.
    await unsave_channel_video(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )
    status_for_admin = await get_save_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=admin_user, db_session=db,
    )
    assert status_for_admin.is_saved is True


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_and_unsave_reject_anonymous_users(db, org, anonymous_user, published_video):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await save_channel_video(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401

    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await unsave_channel_video(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_save_status_supports_anonymous_viewers_of_public_video(
    db, org, anonymous_user, published_video
):
    """Mirrors get_like_status: an anonymous viewer of a public video gets a
    200 with is_saved always False, rather than a 401 — there's simply
    nothing saved for a viewer with no identity."""
    status = await get_save_status(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=anonymous_user, db_session=db,
    )
    assert status.is_saved is False


# ---------------------------------------------------------------------------
# Visibility / ownership (reused from get_channel_video, not duplicated)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_save_unpublished_video_as_non_admin(db, org, regular_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await save_channel_video(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_save_own_unpublished_draft(db, org, admin_user, draft_video):
    """The channel's own admin can preview/save their own draft — same rule
    get_channel_video already grants for viewing it."""
    status = await save_channel_video(
        request=None, org_id=org.id, channelvideo_id=draft_video.id,
        current_user=admin_user, db_session=db,
    )
    assert status.is_saved is True


@pytest.mark.asyncio
async def test_save_rejects_missing_channel_video(db, org, regular_user):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await save_channel_video(
            request=None, org_id=org.id, channelvideo_id=999999,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_save_rejects_video_from_a_different_organization(
    db, other_org, regular_user, published_video
):
    """A video can't be saved by referencing it through another org's id —
    mirrors get_channel_video's own org-scoped lookup."""
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await save_channel_video(
            request=None, org_id=other_org.id, channelvideo_id=published_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404
