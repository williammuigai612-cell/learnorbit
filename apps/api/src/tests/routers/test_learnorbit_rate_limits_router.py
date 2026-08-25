"""Router-boundary tests for F2 rate limiting on LearnOrbit endpoints.

Two concerns the service-level tests in
``src/tests/services/test_learnorbit_rate_limiting_service.py`` can't cover:

1. **Coverage** — every LearnOrbit mutation route is actually wired to the
   limiter, and the handful that are deliberately not wired stay an explicit,
   documented list rather than an oversight. A new unprotected LearnOrbit
   mutation endpoint fails this test.
2. **Over HTTP** — a caller under the ceiling gets the endpoint's normal
   response, a caller over it gets 429 with ``Retry-After`` and the shared
   ``RATE_LIMITED`` envelope, and one user's flood does not spend another
   user's quota.
"""

import inspect
import re
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.parent_child_links import ParentChildLink, ParentChildLinkStatusEnum
from src.db.users import PublicUser
from src.routers.orgs.orgs import router as orgs_router
from src.routers.users import router as users_router
from src.security.auth import get_authenticated_user, get_current_user
from src.services.security import rate_limiting
from src.tests.fixtures.fake_redis import FakeRedis

MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths owned by LearnOrbit (not inherited LearnHouse org/config/invite CRUD).
LEARNORBIT_ORG_PATHS = re.compile(
    r"^/\{org_id\}/(follow|videos|reports|verification|resources|questions|quizzes)\b"
)
LEARNORBIT_USER_PATHS = re.compile(r"^/parent-links\b")

# LearnOrbit mutation routes intentionally left off the limiter, each with the
# reason it is safe. Keeping this explicit is the point: an unlisted,
# unprotected route is a test failure, not a silent gap.
EXPECTED_UNPROTECTED = {
    # Submitting is single-shot per attempt — the service returns 409 on a
    # second submit — so attempt *creation* (quiz_attempt_start) already bounds
    # it, and a 429 here would throw away a student's finished quiz.
    ("POST", "/{org_id}/quizzes/{quiz_id}/attempts/{attempt_id}/submit"),
}


def _learnorbit_mutation_routes():
    found = []
    for router, pattern in (
        (orgs_router, LEARNORBIT_ORG_PATHS),
        (users_router, LEARNORBIT_USER_PATHS),
    ):
        for route in router.routes:
            path = getattr(route, "path", "")
            if not pattern.match(path):
                continue
            for method in getattr(route, "methods", set()) & MUTATION_METHODS:
                found.append((method, path, route.endpoint))
    return found


# --- coverage ------------------------------------------------------------


def test_every_learnorbit_mutation_route_is_rate_limited():
    routes = _learnorbit_mutation_routes()
    assert routes, "route discovery found nothing — the patterns have drifted"

    unprotected = {
        (method, path)
        for method, path, endpoint in routes
        if "enforce_learnorbit_rate_limit" not in inspect.getsource(endpoint)
    }
    assert unprotected == EXPECTED_UNPROTECTED


def test_protected_routes_use_a_declared_action():
    """Handlers name an action from the table, never an ad-hoc key."""
    for _method, path, endpoint in _learnorbit_mutation_routes():
        source = inspect.getsource(endpoint)
        match = re.search(r'enforce_learnorbit_rate_limit\(\s*"([^"]+)"', source)
        if match is None:
            continue  # covered by the test above
        assert match.group(1) in rate_limiting.LEARNORBIT_RATE_LIMITS, path


def test_limiter_runs_before_the_service_does():
    """The call must be the handler's first statement.

    A limiter placed after the service call would still return 429 but only
    once the abusive write had already happened.
    """
    for _method, _path, endpoint in _learnorbit_mutation_routes():
        body = inspect.getsource(endpoint).split(":\n", 1)[-1]
        statements = [ln.strip() for ln in body.split("\n") if ln.strip()]
        if not any("enforce_learnorbit_rate_limit" in s for s in statements):
            continue
        assert statements[0].startswith("enforce_learnorbit_rate_limit"), endpoint.__name__


# --- over HTTP -----------------------------------------------------------


@pytest.fixture
def limiter(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(rate_limiting, "get_redis_connection", lambda: fake)
    monkeypatch.setitem(rate_limiting.LEARNORBIT_RATE_LIMITS, "parent_link_write", (3, 60))
    rate_limiting.reset_learnorbit_rate_limit_state()
    yield fake
    rate_limiting.reset_learnorbit_rate_limit_state()


def _user(user_id: int) -> PublicUser:
    return PublicUser(
        id=user_id,
        username=f"user{user_id}",
        first_name="Test",
        last_name="User",
        email=f"user{user_id}@example.com",
        user_uuid=f"user_{user_id}",
    )


@pytest.fixture
def app(db):
    """Users router with a switchable authenticated principal."""
    application = FastAPI()
    application.include_router(users_router, prefix="/api/v1/users")
    application.dependency_overrides[get_db_session] = lambda: db
    state = {"user": _user(101)}
    application.dependency_overrides[get_current_user] = lambda: state["user"]
    application.dependency_overrides[get_authenticated_user] = lambda: state["user"]
    application.state.acting = state
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def _mock_link() -> ParentChildLink:
    return ParentChildLink(
        id=1,
        link_uuid="parentlink_abc",
        parent_user_id=1,
        child_user_id=2,
        status=ParentChildLinkStatusEnum.PENDING,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )


async def _request_link(client):
    return await client.post(
        "/api/v1/users/parent-links/request",
        json={"child_username": "regular"},
    )


async def test_requests_under_the_limit_behave_exactly_as_before(client, limiter):
    with patch(
        "src.routers.users.request_parent_link",
        new_callable=AsyncMock,
        return_value=_mock_link(),
    ) as mocked:
        for _ in range(3):
            response = await _request_link(client)
            assert response.status_code == 200
            assert response.json()["link_uuid"] == "parentlink_abc"
    assert mocked.await_count == 3


async def test_request_over_the_limit_returns_429(client, limiter):
    with patch(
        "src.routers.users.request_parent_link",
        new_callable=AsyncMock,
        return_value=_mock_link(),
    ) as mocked:
        for _ in range(3):
            assert (await _request_link(client)).status_code == 200
        response = await _request_link(client)

    assert response.status_code == 429
    detail = response.json()["detail"]
    assert detail["code"] == "RATE_LIMITED"
    assert detail["retry_after"] > 0
    assert int(response.headers["Retry-After"]) > 0
    # The service was never reached for the rejected call.
    assert mocked.await_count == 3


async def test_429_body_does_not_leak_internals(client, limiter):
    with patch(
        "src.routers.users.request_parent_link",
        new_callable=AsyncMock,
        return_value=_mock_link(),
    ):
        for _ in range(3):
            await _request_link(client)
        response = await _request_link(client)

    body = response.text.lower()
    assert "redis" not in body
    assert "rate_limit:lo" not in body
    assert "parent_link_write" not in body


async def test_one_user_cannot_spend_another_users_quota(app, client, limiter):
    with patch(
        "src.routers.users.request_parent_link",
        new_callable=AsyncMock,
        return_value=_mock_link(),
    ):
        for _ in range(3):
            await _request_link(client)
        assert (await _request_link(client)).status_code == 429

        app.state.acting["user"] = _user(102)
        assert (await _request_link(client)).status_code == 200


async def test_quota_returns_when_the_window_expires(client, limiter):
    with patch(
        "src.routers.users.request_parent_link",
        new_callable=AsyncMock,
        return_value=_mock_link(),
    ):
        for _ in range(3):
            await _request_link(client)
        assert (await _request_link(client)).status_code == 429

        limiter.expire_window("lo:parent_link_write:user:101")

        assert (await _request_link(client)).status_code == 200


async def test_endpoint_still_works_when_redis_is_down(client, limiter):
    """A Redis outage must not take parent-link requests down with it."""
    limiter.fail = True
    with patch(
        "src.routers.users.request_parent_link",
        new_callable=AsyncMock,
        return_value=_mock_link(),
    ):
        for _ in range(5):
            assert (await _request_link(client)).status_code == 200
