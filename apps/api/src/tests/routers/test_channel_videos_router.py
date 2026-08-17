"""Router tests for GET /orgs/{org_id}/videos content_format filtering (Phase 3C).

Exercises the endpoint over real HTTP through the orgs router, complementing
the service-layer coverage in test_channel_videos_service.py with the
router-boundary concern: query-param validation (Literal-typed
`content_format`) and anonymous HTTP access.
"""

from datetime import datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.routers.orgs.orgs import router as orgs_router
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)


@pytest.fixture
def app(db):
    application = FastAPI()
    application.include_router(orgs_router, prefix="/api/v1/orgs")
    application.dependency_overrides[get_db_session] = lambda: db
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


async def _published_video(db, org, admin_user, course, key, **fields):
    a = Activity(
        name=f"Video {key}",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid=f"activity_cv_router_{key}",
        org_id=org.id,
        course_id=course.id,
        content={"filename": f"{key}.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=a.id, title=f"Video {key}", **fields),
    )
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )


@pytest.mark.asyncio
async def test_content_format_short_returns_shorts_only(db, org, admin_user, course, client):
    short = await _published_video(db, org, admin_user, course, "short1", content_format="short")
    await _published_video(db, org, admin_user, course, "long1", content_format="long")

    resp = await client.get(f"/api/v1/orgs/{org.id}/videos", params={"content_format": "short"})
    assert resp.status_code == 200
    assert [v["id"] for v in resp.json()] == [short.id]


@pytest.mark.asyncio
async def test_content_format_long_returns_long_only(db, org, admin_user, course, client):
    await _published_video(db, org, admin_user, course, "short1", content_format="short")
    long_video = await _published_video(db, org, admin_user, course, "long1", content_format="long")

    resp = await client.get(f"/api/v1/orgs/{org.id}/videos", params={"content_format": "long"})
    assert resp.status_code == 200
    assert [v["id"] for v in resp.json()] == [long_video.id]


@pytest.mark.asyncio
async def test_content_format_omitted_preserves_existing_behavior(db, org, admin_user, course, client):
    short = await _published_video(db, org, admin_user, course, "short1", content_format="short")
    long_video = await _published_video(db, org, admin_user, course, "long1", content_format="long")

    resp = await client.get(f"/api/v1/orgs/{org.id}/videos")
    assert resp.status_code == 200
    assert {v["id"] for v in resp.json()} == {short.id, long_video.id}


@pytest.mark.asyncio
async def test_content_format_invalid_value_is_rejected(db, org, client):
    resp = await client.get(f"/api/v1/orgs/{org.id}/videos", params={"content_format": "bogus"})
    assert resp.status_code == 422
