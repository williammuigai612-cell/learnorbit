"""Router tests for GET /shorts — global cross-org Shorts discovery (Phase 3C).

See docs/ARCHITECTURE.md § "Videos / Shorts (Phase 3A)", point 4. Exercises
the endpoint over real HTTP: anonymous access and the same published+public
predicate proven at the service layer in test_channel_videos_service.py, now
verified at the HTTP boundary so there is no code path where the router
itself could leak a draft/unlisted row.
"""

from datetime import datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.routers.shorts import router as shorts_router
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)


@pytest.fixture
def app(db):
    application = FastAPI()
    application.include_router(shorts_router, prefix="/api/v1/shorts")
    application.dependency_overrides[get_db_session] = lambda: db
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


async def _create_video(db, org, admin_user, course, key, publish=True, **fields):
    a = Activity(
        name=f"Video {key}",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid=f"activity_shorts_router_{key}",
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
    if publish:
        video = await set_channel_video_published(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
            db_session=db, data=ChannelVideoPublish(published=True),
        )
    return video


@pytest.mark.asyncio
async def test_returns_published_public_short_anonymously(db, org, admin_user, course, client):
    short = await _create_video(db, org, admin_user, course, "pub", content_format="short")

    resp = await client.get("/api/v1/shorts")
    assert resp.status_code == 200
    assert [v["id"] for v in resp.json()] == [short.id]


@pytest.mark.asyncio
async def test_excludes_unpublished_short(db, org, admin_user, course, client):
    await _create_video(db, org, admin_user, course, "draft", publish=False, content_format="short")

    resp = await client.get("/api/v1/shorts")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_excludes_unlisted_short(db, org, admin_user, course, client):
    await _create_video(
        db, org, admin_user, course, "unlisted", content_format="short", visibility="unlisted"
    )

    resp = await client.get("/api/v1/shorts")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_excludes_long_form_video(db, org, admin_user, course, client):
    await _create_video(db, org, admin_user, course, "long", content_format="long")

    resp = await client.get("/api/v1/shorts")
    assert resp.status_code == 200
    assert resp.json() == []
