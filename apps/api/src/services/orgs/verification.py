"""
Organization verification service (Phase 8C).

A platform-wide trust signal (`Organization.is_verified`) — deliberately
superadmin-only, not reachable through `update_org`/`OrganizationUpdate`
(which a channel's own owner/admin can call). A channel verifying itself
would not be a trust signal at all, so this reuses `is_user_superadmin`
directly rather than `is_org_admin` — see docs/ARCHITECTURE.md § "Trust &
Moderation (Phase 8C)".

No application/request flow and no audit-trail columns (who/when) — a
flag only, consistent with the minimal-schema approach in Phase 8A/8B.
"""

from typing import Union

from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.organizations import Organization, OrganizationRead
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.superadmin import is_user_superadmin


class OrgVerificationUpdate(SQLModel):
    is_verified: bool


async def _get_org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (await db_session.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _require_superadmin(
    current_user: Union[PublicUser, AnonymousUser], db_session: AsyncSession
) -> int:
    """Raise unless the acting user is a platform superadmin. Returns the
    acting user's id on success. Intentionally not `is_org_admin` — a
    channel's own admin must never be able to grant itself verification."""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_user_superadmin(acting_user_id, db_session):
        raise HTTPException(
            status_code=403, detail="Only a platform superadmin can do this"
        )
    return acting_user_id


async def set_org_verification(
    request: Request,
    org_id: int,
    data: OrgVerificationUpdate,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> OrganizationRead:
    await _require_superadmin(current_user, db_session)
    org = await _get_org_or_404(org_id, db_session)

    org.is_verified = data.is_verified
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return OrganizationRead(**org.model_dump())
