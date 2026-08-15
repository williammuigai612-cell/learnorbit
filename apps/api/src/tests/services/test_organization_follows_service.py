import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.organization_follows import OrganizationFollow
from src.services.orgs.follows import (
    follow_organization,
    get_follow_status,
    unfollow_organization,
)


@pytest.mark.asyncio
async def test_follow_creates_relationship_and_increments_follower_count(
    db, org, regular_user
):
    status = await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    assert status.is_following is True
    assert status.follower_count == 1

    row = (
        await db.execute(
            select(OrganizationFollow).where(
                OrganizationFollow.user_id == regular_user.id
            )
        )
    ).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_follow_is_idempotent_and_prevents_duplicates(db, org, regular_user):
    first = await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )
    second = await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    assert first.follower_count == 1
    assert second.follower_count == 1

    rows = (
        await db.execute(
            select(OrganizationFollow).where(
                OrganizationFollow.user_id == regular_user.id,
                OrganizationFollow.org_id == org.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_unfollow_removes_relationship(db, org, regular_user):
    await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    status = await unfollow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    assert status.is_following is False
    assert status.follower_count == 0


@pytest.mark.asyncio
async def test_unfollow_when_not_following_is_a_noop(db, org, regular_user):
    status = await unfollow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    assert status.is_following is False
    assert status.follower_count == 0


@pytest.mark.asyncio
async def test_follow_and_unfollow_reject_anonymous_users(db, org, anonymous_user):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await follow_organization(
            request=None, org_id=org.id, current_user=anonymous_user, db_session=db
        )
    assert exc.value.status_code == 401

    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await unfollow_organization(
            request=None, org_id=org.id, current_user=anonymous_user, db_session=db
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_follow_rejects_missing_organization(db, regular_user):
    with pytest.raises(HTTPException, match="Organization not found") as exc:
        await follow_organization(
            request=None, org_id=999, current_user=regular_user, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_get_follow_status_reflects_current_user_and_total_count(
    db, org, admin_user, regular_user
):
    await follow_organization(
        request=None, org_id=org.id, current_user=admin_user, db_session=db
    )
    await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    status_for_follower = await get_follow_status(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )
    assert status_for_follower.is_following is True
    assert status_for_follower.follower_count == 2


@pytest.mark.asyncio
async def test_get_follow_status_supports_anonymous_viewers(
    db, org, regular_user, anonymous_user
):
    await follow_organization(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    status = await get_follow_status(
        request=None, org_id=org.id, current_user=anonymous_user, db_session=db
    )

    assert status.is_following is False
    assert status.follower_count == 1


@pytest.mark.asyncio
async def test_get_follow_status_rejects_missing_organization(db, anonymous_user):
    with pytest.raises(HTTPException, match="Organization not found") as exc:
        await get_follow_status(
            request=None, org_id=999, current_user=anonymous_user, db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_follow_is_isolated_per_user(db, org, admin_user, regular_user):
    """Following as one user must not mark the other user as following (§ users
    can only modify/see their own follow relationship)."""
    await follow_organization(
        request=None, org_id=org.id, current_user=admin_user, db_session=db
    )

    status_for_other_user = await get_follow_status(
        request=None, org_id=org.id, current_user=regular_user, db_session=db
    )

    assert status_for_other_user.is_following is False
    assert status_for_other_user.follower_count == 1
