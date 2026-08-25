"""Router tests for /notifications (Phase 4H).

Mirrors test_feed_router.py's pattern (real `db` fixture + real app, no
service mocking) for the HTTP-boundary concern: authentication is enforced,
and a caller can never read or mark-read another user's notifications.
"""

from datetime import datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.routers.notifications import router as notifications_router
from src.security.auth import get_current_user
from src.services.notifications.notifications import create_comment_notifications
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)


@pytest.fixture
async def activity(db, org, course):
    a = Activity(
        name="Intro Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_notification_router_1",
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


def _app(db, current_user=None):
    application = FastAPI()
    application.include_router(notifications_router, prefix="/api/v1/notifications")
    application.dependency_overrides[get_db_session] = lambda: db
    if current_user is not None:
        application.dependency_overrides[get_current_user] = lambda: current_user
    return application


@pytest.fixture
async def client_as(db):
    async def _make(current_user=None):
        application = _app(db, current_user)
        transport = ASGITransport(app=application)
        return AsyncClient(transport=transport, base_url="http://test")
    return _make


@pytest.mark.asyncio
async def test_list_notifications_rejects_anonymous_caller(client_as):
    async with await client_as() as client:
        resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unread_count_rejects_anonymous_caller(client_as):
    async with await client_as() as client:
        resp = await client.get("/api/v1/notifications/unread-count")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_mark_read_rejects_anonymous_caller(client_as):
    async with await client_as() as client:
        resp = await client.patch("/api/v1/notifications/does_not_exist/read")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_user_sees_only_their_own_notifications(
    db, org, admin_user, regular_user, published_video, client_as
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    async with await client_as(admin_user) as client:
        resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["recipient_id"] == admin_user.id

    async with await client_as(regular_user) as client:
        resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_unread_count_endpoint(db, org, admin_user, regular_user, published_video, client_as):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    async with await client_as(admin_user) as client:
        resp = await client.get("/api/v1/notifications/unread-count")
    assert resp.status_code == 200
    assert resp.json() == {"count": 1}


@pytest.mark.asyncio
async def test_user_cannot_mark_another_users_notification_read(
    db, org, admin_user, regular_user, published_video, client_as
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    async with await client_as(admin_user) as client:
        list_resp = await client.get("/api/v1/notifications")
    notification_uuid = list_resp.json()[0]["notification_uuid"]

    async with await client_as(regular_user) as client:
        resp = await client.patch(f"/api/v1/notifications/{notification_uuid}/read")
    assert resp.status_code == 404

    async with await client_as(admin_user) as client:
        resp = await client.get("/api/v1/notifications/unread-count")
    assert resp.json() == {"count": 1}


@pytest.mark.asyncio
async def test_owner_marks_their_own_notification_read(
    db, org, admin_user, regular_user, published_video, client_as
):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    async with await client_as(admin_user) as client:
        list_resp = await client.get("/api/v1/notifications")
        notification_uuid = list_resp.json()[0]["notification_uuid"]
        resp = await client.patch(f"/api/v1/notifications/{notification_uuid}/read")
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

        count_resp = await client.get("/api/v1/notifications/unread-count")
    assert count_resp.json() == {"count": 0}


@pytest.mark.asyncio
async def test_mark_all_read(db, org, admin_user, regular_user, published_video, client_as):
    await create_comment_notifications(org.id, published_video.id, regular_user.id, db)

    async with await client_as(admin_user) as client:
        resp = await client.patch("/api/v1/notifications/read-all")
        assert resp.status_code == 200
        assert resp.json() == {"marked_read": 1}

        count_resp = await client.get("/api/v1/notifications/unread-count")
    assert count_resp.json() == {"count": 0}


# ── Pagination bounds at the HTTP boundary (Phase 9 re-verification) ────────
# SECURITY_REVIEW.md §39 "Pagination and Resource Enumeration" requires a
# maximum page size on list endpoints. This endpoint previously accepted an
# arbitrary `limit`, letting one authenticated request pull an unbounded page.
# Same cap/convention as GET /feed and GET /shorts (Phase 9B-1).

@pytest.mark.asyncio
async def test_notifications_rejects_out_of_range_pagination_params(
    db, org, admin_user, client_as
):
    async with await client_as(admin_user) as client:
        for query in ("?limit=101", "?limit=0", "?page=0", "?limit=100000"):
            resp = await client.get(f"/api/v1/notifications{query}")
            assert resp.status_code == 422, query


@pytest.mark.asyncio
async def test_notifications_accepts_in_range_pagination_params(
    db, org, admin_user, client_as
):
    async with await client_as(admin_user) as client:
        resp = await client.get("/api/v1/notifications?page=1&limit=100")
    assert resp.status_code == 200
