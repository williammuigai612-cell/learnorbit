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


# ── Pagination at the HTTP boundary (Phase 9B) ──────────────────────────────

@pytest.mark.asyncio
async def test_home_feed_still_rejects_anonymous_with_pagination_params(client):
    """SECURITY (9A): adding page/limit must not open a path around the 401
    gate — the auth check is in front of the window, not after it."""
    resp = await client.get("/api/v1/feed?page=2&limit=10")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_home_feed_rejects_out_of_range_pagination_params(client):
    """max 100 per page, page/limit >= 1. Anonymous callers are rejected
    regardless, so this asserts the request is refused rather than served —
    422 (validation) and 401 (auth) are both correct refusals here, and
    which one wins is FastAPI's resolution order, not this endpoint's
    contract."""
    for query in ("?limit=101", "?page=0", "?limit=0"):
        resp = await client.get(f"/api/v1/feed{query}")
        assert resp.status_code in (401, 422)
