"""Router test for GET /feed — the home feed (Phase 4G).

Complements the service-layer coverage in test_channel_videos_service.py
(list_home_feed) with the HTTP-boundary concern: an anonymous caller is
rejected at the router, matching test_shorts_router.py's and
test_channel_videos_router.py's "anonymous access" focus for this app's
router-level tests. Authenticated behavior (follow-scoping, ordering,
exclusions) is exercised at the service layer, not re-verified here.
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.routers.feed import router as feed_router


@pytest.fixture
def app(db):
    application = FastAPI()
    application.include_router(feed_router, prefix="/api/v1/feed")
    application.dependency_overrides[get_db_session] = lambda: db
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.mark.asyncio
async def test_home_feed_rejects_anonymous_caller(client):
    resp = await client.get("/api/v1/feed")
    assert resp.status_code == 401
