"""
Service-layer tests for organization verification (Phase 8C).

Mirrors test_channel_video_reports_service.py's auth-rejection style, but
the gate here is platform superadmin (is_user_superadmin), not
is_org_admin — a channel's own admin must be rejected, not just anonymous
users and unrelated members.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.users import User
from src.services.orgs.verification import (
    OrgVerificationUpdate,
    set_org_verification,
)

# db, org, other_org, admin_user, regular_user, anonymous_user are provided
# by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def superadmin_user(db):
    """A platform superadmin, unaffiliated with any organization."""
    u = User(
        id=99,
        username="superadmin",
        first_name="Super",
        last_name="Admin",
        email="superadmin@test.com",
        password="hashed_password",
        user_uuid="user_superadmin99",
        is_superadmin=True,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest.mark.asyncio
async def test_superadmin_can_verify_org(db, org, superadmin_user):
    result = await set_org_verification(
        request=None, org_id=org.id,
        data=OrgVerificationUpdate(is_verified=True),
        current_user=superadmin_user, db_session=db,
    )

    assert result.is_verified is True


@pytest.mark.asyncio
async def test_superadmin_can_unverify_org(db, org, superadmin_user):
    await set_org_verification(
        request=None, org_id=org.id,
        data=OrgVerificationUpdate(is_verified=True),
        current_user=superadmin_user, db_session=db,
    )

    result = await set_org_verification(
        request=None, org_id=org.id,
        data=OrgVerificationUpdate(is_verified=False),
        current_user=superadmin_user, db_session=db,
    )

    assert result.is_verified is False


@pytest.mark.asyncio
async def test_set_verification_rejects_anonymous(db, org, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await set_org_verification(
            request=None, org_id=org.id,
            data=OrgVerificationUpdate(is_verified=True),
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_set_verification_rejects_regular_member(db, org, regular_user):
    with pytest.raises(HTTPException) as exc:
        await set_org_verification(
            request=None, org_id=org.id,
            data=OrgVerificationUpdate(is_verified=True),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_set_verification_rejects_the_channels_own_admin(db, org, admin_user):
    """A channel's own owner/admin must not be able to self-verify — this
    is the whole point of gating on is_user_superadmin instead of
    is_org_admin."""
    with pytest.raises(HTTPException) as exc:
        await set_org_verification(
            request=None, org_id=org.id,
            data=OrgVerificationUpdate(is_verified=True),
            current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_set_verification_rejects_missing_org(db, superadmin_user):
    with pytest.raises(HTTPException) as exc:
        await set_org_verification(
            request=None, org_id=999999,
            data=OrgVerificationUpdate(is_verified=True),
            current_user=superadmin_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_set_verification_checks_superadmin_before_org_existence(
    db, regular_user
):
    """A non-superadmin gets 403 for a nonexistent org too, not 404 —
    otherwise org-id existence would leak to unauthorized callers."""
    with pytest.raises(HTTPException) as exc:
        await set_org_verification(
            request=None, org_id=999999,
            data=OrgVerificationUpdate(is_verified=True),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403
