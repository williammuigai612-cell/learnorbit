"""Parent-child relationship service (Phase 7B).

Child-approves-parent's-request flow, modeled on services/orgs/follows.py's
join-table pattern but consent-gated (a status enum instead of a bare
follow/unfollow toggle) — see docs/ARCHITECTURE.md § "Parents (Phase 7A)"
for the decision trail. Setting `is_parent` (7A) grants no access by itself;
an APPROVED row here is the only thing 7C's activity view will be able to
authorize against.
"""

from datetime import datetime, timezone
from typing import List, Union
from uuid import uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException

from src.db.parent_child_links import ParentChildLink, ParentChildLinkStatusEnum
from src.db.users import AnonymousUser, PublicUser, User
from src.security.auth import resolve_acting_user_id


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def _get_child_by_username_or_404(username: str, db_session: AsyncSession) -> User:
    child = (
        await db_session.execute(select(User).where(User.username == username))
    ).scalars().first()
    if not child:
        # Generic message — mirrors read_user_by_username's enumeration guard.
        raise HTTPException(status_code=404, detail="Resource not found")
    return child


async def request_parent_link(
    current_user: Union[PublicUser, AnonymousUser],
    child_username: str,
    db_session: AsyncSession,
) -> ParentChildLink:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    if not getattr(current_user, "is_parent", False):
        raise HTTPException(
            status_code=403,
            detail="Only accounts with the parent flag enabled can request a link",
        )

    parent_id = resolve_acting_user_id(current_user)
    child = await _get_child_by_username_or_404(child_username, db_session)

    if child.id == parent_id:
        raise HTTPException(status_code=400, detail="Cannot link an account to itself")

    existing = (
        await db_session.execute(
            select(ParentChildLink).where(
                ParentChildLink.parent_user_id == parent_id,
                ParentChildLink.child_user_id == child.id,
            )
        )
    ).scalars().first()

    if existing:
        if existing.status != ParentChildLinkStatusEnum.PENDING:
            # A prior REJECTED (or APPROVED) link is re-opened as a fresh
            # request rather than accumulating duplicate rows for the same pair.
            existing.status = ParentChildLinkStatusEnum.PENDING
            existing.update_date = _now()
            db_session.add(existing)
            await db_session.commit()
            await db_session.refresh(existing)
        return existing

    link = ParentChildLink(
        link_uuid=f"parentlink_{uuid4()}",
        parent_user_id=parent_id,
        child_user_id=child.id,
        status=ParentChildLinkStatusEnum.PENDING,
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(link)
    await db_session.commit()
    await db_session.refresh(link)
    return link


async def list_pending_parent_links(
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> List[ParentChildLink]:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    child_id = resolve_acting_user_id(current_user)

    rows = (
        await db_session.execute(
            select(ParentChildLink).where(
                ParentChildLink.child_user_id == child_id,
                ParentChildLink.status == ParentChildLinkStatusEnum.PENDING,
            )
        )
    ).scalars().all()
    return list(rows)


async def _get_own_pending_link_or_404(
    child_id: int, link_uuid: str, db_session: AsyncSession
) -> ParentChildLink:
    link = (
        await db_session.execute(
            select(ParentChildLink).where(ParentChildLink.link_uuid == link_uuid)
        )
    ).scalars().first()
    if not link:
        raise HTTPException(status_code=404, detail="Link request not found")
    # SECURITY: IDOR guard — only the target child may respond. 404 (not 403)
    # so a caller can't distinguish "not yours" from "doesn't exist".
    if link.child_user_id != child_id:
        raise HTTPException(status_code=404, detail="Link request not found")
    if link.status != ParentChildLinkStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Link request is no longer pending")
    return link


async def respond_to_parent_link(
    current_user: Union[PublicUser, AnonymousUser],
    link_uuid: str,
    approve: bool,
    db_session: AsyncSession,
) -> ParentChildLink:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    child_id = resolve_acting_user_id(current_user)

    link = await _get_own_pending_link_or_404(child_id, link_uuid, db_session)
    link.status = (
        ParentChildLinkStatusEnum.APPROVED if approve else ParentChildLinkStatusEnum.REJECTED
    )
    link.update_date = _now()
    db_session.add(link)
    await db_session.commit()
    await db_session.refresh(link)
    return link


async def list_my_parent_links(
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> List[ParentChildLink]:
    """Approved links on either side of the calling user — for 7C."""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_id = resolve_acting_user_id(current_user)

    rows = (
        await db_session.execute(
            select(ParentChildLink).where(
                ParentChildLink.status == ParentChildLinkStatusEnum.APPROVED,
                (ParentChildLink.parent_user_id == acting_id)
                | (ParentChildLink.child_user_id == acting_id),
            )
        )
    ).scalars().all()
    return list(rows)
