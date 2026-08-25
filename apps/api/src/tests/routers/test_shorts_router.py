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


# ── Pagination at the HTTP boundary (Phase 9B) ──────────────────────────────

@pytest.mark.asyncio
async def test_limit_is_honoured_over_http(db, org, admin_user, course, client):
    for i in range(4):
        await _create_video(db, org, admin_user, course, f"pg{i}", content_format="short")

    resp = await client.get("/api/v1/shorts?page=1&limit=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_second_page_returns_the_remainder(db, org, admin_user, course, client):
    for i in range(3):
        await _create_video(db, org, admin_user, course, f"pgr{i}", content_format="short")

    first = await client.get("/api/v1/shorts?page=1&limit=2")
    second = await client.get("/api/v1/shorts?page=2&limit=2")
    assert len(first.json()) == 2
    assert len(second.json()) == 1
    first_ids = {v["id"] for v in first.json()}
    assert all(v["id"] not in first_ids for v in second.json())


@pytest.mark.asyncio
async def test_rejects_limit_above_the_maximum(client):
    """max 100 per page — a data-dumping guard, same convention as the
    existing paginated orgs endpoints."""
    resp = await client.get("/api/v1/shorts?limit=101")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_rejects_non_positive_page_and_limit(client):
    assert (await client.get("/api/v1/shorts?page=0")).status_code == 422
    assert (await client.get("/api/v1/shorts?limit=0")).status_code == 422


@pytest.mark.asyncio
async def test_omitting_pagination_params_still_works(db, org, admin_user, course, client):
    """No params — the Phase 3C request shape — must keep working."""
    short = await _create_video(db, org, admin_user, course, "noparam", content_format="short")
    resp = await client.get("/api/v1/shorts")
    assert resp.status_code == 200
    assert [v["id"] for v in resp.json()] == [short.id]


@pytest.mark.asyncio
async def test_pagination_never_exposes_a_draft_or_unlisted_short(
    db, org, admin_user, course, client
):
    """SECURITY (9A): the published+public predicate holds on every page."""
    published = await _create_video(db, org, admin_user, course, "secpub", content_format="short")
    await _create_video(db, org, admin_user, course, "secdraft", publish=False, content_format="short")
    await _create_video(
        db, org, admin_user, course, "secunl", content_format="short", visibility="unlisted"
    )

    resp = await client.get("/api/v1/shorts?page=1&limit=100")
    assert resp.status_code == 200
    assert [v["id"] for v in resp.json()] == [published.id]
