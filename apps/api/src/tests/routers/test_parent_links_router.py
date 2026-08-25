"""Router tests for the parent-link endpoints in src/routers/users.py (Phase 7B).

Same isolation pattern as test_users_router.py: a minimal FastAPI app with
only the users router, service functions patched at the router import level.
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.parent_child_links import ParentChildLink, ParentChildLinkStatusEnum
from src.routers.users import router as users_router
from src.security.auth import get_current_user, get_authenticated_user


@pytest.fixture
def app(db, admin_user):
    app = FastAPI()
    app.include_router(users_router, prefix="/api/v1/users")
    app.dependency_overrides[get_db_session] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_authenticated_user] = lambda: admin_user
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def _mock_link(**overrides) -> ParentChildLink:
    data = dict(
        id=1,
        link_uuid="parentlink_abc",
        parent_user_id=1,
        child_user_id=2,
        status=ParentChildLinkStatusEnum.PENDING,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    data.update(overrides)
    return ParentChildLink(**data)


class TestRequestParentLink:
    async def test_request_creates_link(self, client):
        with patch(
            "src.routers.users.request_parent_link",
            new_callable=AsyncMock,
            return_value=_mock_link(),
        ) as mocked:
            response = await client.post(
                "/api/v1/users/parent-links/request",
                json={"child_username": "regular"},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "PENDING"
        assert body["link_uuid"] == "parentlink_abc"
        mocked.assert_awaited_once()
        assert mocked.await_args.kwargs["child_username"] == "regular"

    async def test_request_propagates_service_errors(self, client):
        with patch(
            "src.routers.users.request_parent_link",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=403, detail="Not a parent account"),
        ):
            response = await client.post(
                "/api/v1/users/parent-links/request",
                json={"child_username": "regular"},
            )

        assert response.status_code == 403


class TestListPendingParentLinks:
    async def test_list_pending(self, client):
        with patch(
            "src.routers.users.list_pending_parent_links",
            new_callable=AsyncMock,
            return_value=[_mock_link()],
        ):
            response = await client.get("/api/v1/users/parent-links/pending")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["status"] == "PENDING"

    async def test_list_pending_empty(self, client):
        with patch(
            "src.routers.users.list_pending_parent_links",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = await client.get("/api/v1/users/parent-links/pending")

        assert response.status_code == 200
        assert response.json() == []


class TestListMyParentLinks:
    async def test_list_mine(self, client):
        with patch(
            "src.routers.users.list_my_parent_links",
            new_callable=AsyncMock,
            return_value=[_mock_link(status=ParentChildLinkStatusEnum.APPROVED)],
        ):
            response = await client.get("/api/v1/users/parent-links/mine")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["status"] == "APPROVED"

    async def test_list_mine_empty(self, client):
        with patch(
            "src.routers.users.list_my_parent_links",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = await client.get("/api/v1/users/parent-links/mine")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_mine_requires_auth(self, client):
        with patch(
            "src.routers.users.list_my_parent_links",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=401, detail="Authentication required"),
        ):
            response = await client.get("/api/v1/users/parent-links/mine")

        assert response.status_code == 401


class TestChildQuizProgress:
    def _mock_summary(self, **overrides):
        data = dict(
            quiz_id=1,
            quiz_title="Algebra Basics",
            pass_threshold_percentage=70.0,
            attempts_taken=2,
            best_score_percentage=90.0,
            most_recent_score_percentage=80.0,
            most_recent_attempt_at=str(datetime.now()),
            org_id=1,
            org_name="Test Org",
            org_slug="test-org",
        )
        data.update(overrides)
        return data

    async def test_returns_child_progress(self, client):
        with patch(
            "src.routers.users.get_child_quiz_progress",
            new_callable=AsyncMock,
            return_value=[self._mock_summary()],
        ) as mocked:
            response = await client.get("/api/v1/users/parent-links/children/2/quiz-progress")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["quiz_title"] == "Algebra Basics"
        assert body[0]["org_name"] == "Test Org"
        assert mocked.await_args.kwargs["child_user_id"] == 2

    async def test_empty_when_no_attempts(self, client):
        with patch(
            "src.routers.users.get_child_quiz_progress",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = await client.get("/api/v1/users/parent-links/children/2/quiz-progress")

        assert response.status_code == 200
        assert response.json() == []

    async def test_unauthorized_child_404s(self, client):
        with patch(
            "src.routers.users.get_child_quiz_progress",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Resource not found"),
        ):
            response = await client.get("/api/v1/users/parent-links/children/999/quiz-progress")

        assert response.status_code == 404


class TestRespondToParentLink:
    async def test_approve(self, client):
        with patch(
            "src.routers.users.respond_to_parent_link",
            new_callable=AsyncMock,
            return_value=_mock_link(status=ParentChildLinkStatusEnum.APPROVED),
        ) as mocked:
            response = await client.post(
                "/api/v1/users/parent-links/parentlink_abc/respond",
                json={"approve": True},
            )

        assert response.status_code == 200
        assert response.json()["status"] == "APPROVED"
        assert mocked.await_args.kwargs["link_uuid"] == "parentlink_abc"
        assert mocked.await_args.kwargs["approve"] is True

    async def test_reject(self, client):
        with patch(
            "src.routers.users.respond_to_parent_link",
            new_callable=AsyncMock,
            return_value=_mock_link(status=ParentChildLinkStatusEnum.REJECTED),
        ):
            response = await client.post(
                "/api/v1/users/parent-links/parentlink_abc/respond",
                json={"approve": False},
            )

        assert response.status_code == 200
        assert response.json()["status"] == "REJECTED"

    async def test_respond_not_found(self, client):
        with patch(
            "src.routers.users.respond_to_parent_link",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Link request not found"),
        ):
            response = await client.post(
                "/api/v1/users/parent-links/nonexistent/respond",
                json={"approve": True},
            )

        assert response.status_code == 404


class TestRevokeParentLink:
    """Phase 9A finding F1 — consent withdrawal for an APPROVED link."""

    async def test_revoke_returns_rejected_link(self, client):
        with patch(
            "src.routers.users.revoke_parent_link",
            new_callable=AsyncMock,
            return_value=_mock_link(status=ParentChildLinkStatusEnum.REJECTED),
        ) as mocked:
            response = await client.post(
                "/api/v1/users/parent-links/parentlink_abc/revoke"
            )

        assert response.status_code == 200
        assert response.json()["status"] == "REJECTED"
        assert mocked.await_args.kwargs["link_uuid"] == "parentlink_abc"

    async def test_revoke_unrelated_link_is_404(self, client):
        """The service's IDOR guard surfaces as 404, not 403."""
        with patch(
            "src.routers.users.revoke_parent_link",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Link not found"),
        ):
            response = await client.post(
                "/api/v1/users/parent-links/parentlink_someone_else/revoke"
            )

        assert response.status_code == 404

    async def test_revoke_non_approved_link_is_400(self, client):
        with patch(
            "src.routers.users.revoke_parent_link",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=400, detail="Link is not approved"),
        ):
            response = await client.post(
                "/api/v1/users/parent-links/parentlink_abc/revoke"
            )

        assert response.status_code == 400
