"""
Service-layer tests for the Notification system (Phase 4H).

Covers: notification creation on comment (owner notified, self-comment
excluded), recipient-only list scoping, unread count, and mark-read/
mark-all-read ownership enforcement. Comment-creation integration (the
best-effort call site + its failure isolation) is covered in
test_channel_video_comments_service.py alongside the rest of comment
creation's behavior.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.notifications import Notification
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)
from src.services.notifications.notifications import (
    create_comment_notifications,
    get_unread_notification_count,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)

# db, org, admin_user, regular_user, anonymous_user, course are provided by
# conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def activity(db, org, course):
    a = Activity(
        name="Intro Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_notification_1",
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
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Intro Video"),
    )
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )


# ---------------------------------------------------------------------------
# create_comment_notifications
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_comment_notifications_notifies_video_owner(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    rows = (
        await db.execute(select(Notification).where(Notification.channelvideo_id == published_video.id))
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].recipient_id == admin_user.id
    assert rows[0].actor_id == regular_user.id
    assert rows[0].notification_type == "COMMENT"
    assert rows[0].is_read is False


@pytest.mark.asyncio
async def test_create_comment_notifications_skips_owner_commenting_on_own_video(
    db, org, admin_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, admin_user.id, db)

    rows = (
        await db.execute(select(Notification).where(Notification.channelvideo_id == published_video.id))
    ).scalars().all()
    assert rows == []


# ---------------------------------------------------------------------------
# list_notifications
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_notifications_returns_only_the_caller_s_own(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    admin_notifications = await list_notifications(admin_user, db)
    regular_notifications = await list_notifications(regular_user, db)

    assert len(admin_notifications) == 1
    assert admin_notifications[0].recipient_id == admin_user.id
    assert admin_notifications[0].actor is not None
    assert admin_notifications[0].actor.id == regular_user.id
    assert regular_notifications == []


@pytest.mark.asyncio
async def test_list_notifications_rejects_anonymous(db, anonymous_user):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await list_notifications(anonymous_user, db)
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# get_unread_notification_count
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unread_count_reflects_read_state(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)
    assert await get_unread_notification_count(admin_user, db) == 1

    notifications = await list_notifications(admin_user, db)
    await mark_notification_read(admin_user, notifications[0].notification_uuid, db)

    assert await get_unread_notification_count(admin_user, db) == 0


@pytest.mark.asyncio
async def test_unread_count_rejects_anonymous(db, anonymous_user):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await get_unread_notification_count(anonymous_user, db)
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# mark_notification_read
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mark_notification_read_updates_state(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)
    notifications = await list_notifications(admin_user, db)

    updated = await mark_notification_read(admin_user, notifications[0].notification_uuid, db)
    assert updated.is_read is True

    row = (
        await db.execute(select(Notification).where(Notification.notification_uuid == notifications[0].notification_uuid))
    ).scalars().first()
    assert row.is_read is True


@pytest.mark.asyncio
async def test_mark_notification_read_rejects_non_recipient(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)
    notifications = await list_notifications(admin_user, db)

    with pytest.raises(HTTPException, match="Notification not found") as exc:
        await mark_notification_read(regular_user, notifications[0].notification_uuid, db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_mark_notification_read_rejects_anonymous(db, anonymous_user):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await mark_notification_read(anonymous_user, "does_not_exist", db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_mark_notification_read_rejects_missing_notification(db, admin_user):
    with pytest.raises(HTTPException, match="Notification not found") as exc:
        await mark_notification_read(admin_user, "does_not_exist", db)
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# mark_all_notifications_read
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mark_all_notifications_read(
    db, org, course, admin_user, regular_user, activity, published_video
):
    other_activity = Activity(
        name="Second Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_notification_2",
        org_id=org.id,
        course_id=course.id,
        content={"filename": "video2.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(other_activity)
    await db.commit()
    await db.refresh(other_activity)
    other_video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=other_activity.id, title="Second Video"),
    )

    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)
    await create_comment_notifications(org.id, other_video.id, regular_user.id, db)
    assert await get_unread_notification_count(admin_user, db) == 2

    marked = await mark_all_notifications_read(admin_user, db)
    assert marked == 2
    assert await get_unread_notification_count(admin_user, db) == 0


@pytest.mark.asyncio
async def test_mark_all_notifications_read_rejects_anonymous(db, anonymous_user):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await mark_all_notifications_read(anonymous_user, db)
    assert exc.value.status_code == 401


# ── 9B-3: mark_all_notifications_read as a single bulk UPDATE ───────────────
# Guards the specific risk of that refactor: an UPDATE whose WHERE clause is
# scoped too widely would clear other users' notifications, and one scoped
# too narrowly would miscount.

@pytest.mark.asyncio
async def test_mark_all_only_touches_the_acting_users_notifications(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)
    assert await get_unread_notification_count(admin_user, db) == 1

    db.add(Notification(
        notification_uuid="notification_other_recipient",
        recipient_id=regular_user.id,
        actor_id=admin_user.id,
        channelvideo_id=published_video.id,
        notification_type="COMMENT",
        is_read=False,
        creation_date=str(datetime.now()),
    ))
    await db.commit()
    assert await get_unread_notification_count(regular_user, db) == 1

    marked = await mark_all_notifications_read(admin_user, db)

    assert marked == 1
    assert await get_unread_notification_count(admin_user, db) == 0
    # The other user's notification is untouched.
    assert await get_unread_notification_count(regular_user, db) == 1


@pytest.mark.asyncio
async def test_mark_all_does_not_recount_already_read_notifications(
    db, org, admin_user, regular_user, published_video
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)
    assert await mark_all_notifications_read(admin_user, db) == 1
    # Nothing unread left — a second call marks zero, it does not re-report
    # the rows it already marked.
    assert await mark_all_notifications_read(admin_user, db) == 0
