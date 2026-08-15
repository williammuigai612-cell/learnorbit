from typing import Union
from uuid import uuid4
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.organizations import Organization
from src.db.organization_follows import OrganizationFollow, OrganizationFollowStatus
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id


async def _get_org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (await db_session.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _follower_count(org_id: int, db_session: AsyncSession) -> int:
    result = await db_session.execute(
        select(func.count()).select_from(OrganizationFollow).where(
            OrganizationFollow.org_id == org_id
        )
    )
    return result.scalar_one()


async def get_follow_status(
    request: Request,
    org_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> OrganizationFollowStatus:
    await _get_org_or_404(org_id, db_session)

    is_following = False
    if not isinstance(current_user, AnonymousUser):
        viewer_user_id = resolve_acting_user_id(current_user)
        existing = (await db_session.execute(
            select(OrganizationFollow).where(
                OrganizationFollow.org_id == org_id,
                OrganizationFollow.user_id == viewer_user_id,
            )
        )).scalars().first()
        is_following = existing is not None

    follower_count = await _follower_count(org_id, db_session)
    return OrganizationFollowStatus(is_following=is_following, follower_count=follower_count)


async def follow_organization(
    request: Request,
    org_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> OrganizationFollowStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await _get_org_or_404(org_id, db_session)
    # An API token's .id is the token id, not a user id; OrganizationFollow.user_id
    # is a FK to user.id, so we must record/match against the real acting user.
    acting_user_id = resolve_acting_user_id(current_user)

    existing = (await db_session.execute(
        select(OrganizationFollow).where(
            OrganizationFollow.org_id == org_id,
            OrganizationFollow.user_id == acting_user_id,
        )
    )).scalars().first()

    if not existing:
        follow = OrganizationFollow(
            org_id=org_id,
            user_id=acting_user_id,
            follow_uuid=f"orgfollow_{uuid4()}",
            creation_date=str(datetime.now(timezone.utc).replace(tzinfo=None)),
        )
        db_session.add(follow)
        try:
            await db_session.commit()
        except IntegrityError:
            # Concurrent duplicate follow (e.g. rapid double-click) violates the
            # (org_id, user_id) unique constraint. Treat it as idempotent
            # "already following" instead of surfacing an unhandled 500.
            await db_session.rollback()

    follower_count = await _follower_count(org_id, db_session)
    return OrganizationFollowStatus(is_following=True, follower_count=follower_count)


async def unfollow_organization(
    request: Request,
    org_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> OrganizationFollowStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await _get_org_or_404(org_id, db_session)
    acting_user_id = resolve_acting_user_id(current_user)

    existing = (await db_session.execute(
        select(OrganizationFollow).where(
            OrganizationFollow.org_id == org_id,
            OrganizationFollow.user_id == acting_user_id,
        )
    )).scalars().first()

    if existing:
        await db_session.delete(existing)
        await db_session.commit()

    follower_count = await _follower_count(org_id, db_session)
    return OrganizationFollowStatus(is_following=False, follower_count=follower_count)
