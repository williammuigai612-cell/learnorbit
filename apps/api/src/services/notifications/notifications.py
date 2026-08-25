"""
Notification service (Phase 4H).

A notification is created for a `ChannelVideo`'s channel admin(s)/maintainer(s)
when someone else comments on it — never for the actor's own comment on a
video they themselves administer. `notification_type` is a plain string
("COMMENT" today) so a future type (e.g. LIKE) needs no schema change; see
db/notifications.py and docs/ARCHITECTURE.md § "Basic Notifications (Phase 4H)".

Creation is deliberately a plain function, not wrapped in try/except here —
the comment-creation call site (services/orgs/channel_video_comments.py) is
responsible for the best-effort try/except, matching the existing
`_try_record_org_admin_in_loops` pattern (services/orgs/orgs.py).
"""

from datetime import datetime, timezone
from typing import List, Optional, Union
from uuid import uuid4

from sqlalchemy import update
from sqlmodel import SQLModel, func, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException

from src.db.notifications import Notification
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User, UserReadAuthor
from src.security.auth import resolve_acting_user_id
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS

NOTIFICATION_TYPE_COMMENT = "COMMENT"


class NotificationRead(SQLModel):
    id: int
    notification_uuid: str
    recipient_id: int
    actor_id: int
    channelvideo_id: int
    notification_type: str
    is_read: bool
    creation_date: str
    actor: Optional[UserReadAuthor] = None


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def _get_org_admin_user_ids(org_id: int, db_session: AsyncSession) -> List[int]:
    rows = (
        await db_session.execute(
            select(UserOrganization.user_id).where(
                UserOrganization.org_id == org_id,
                UserOrganization.role_id.in_(ADMIN_OR_MAINTAINER_ROLE_IDS),  # type: ignore
            )
        )
    ).scalars().all()
    return list(rows)


async def create_comment_notifications(
    org_id: int, channelvideo_id: int, actor_id: int, db_session: AsyncSession
) -> None:
    """Notify this channel's admin(s)/maintainer(s) of a new comment, except
    the actor themself (no self-notification when the owner comments on
    their own video)."""
    admin_ids = await _get_org_admin_user_ids(org_id, db_session)
    recipient_ids = [uid for uid in admin_ids if uid != actor_id]
    if not recipient_ids:
        return

    for recipient_id in recipient_ids:
        db_session.add(
            Notification(
                notification_uuid=f"notification_{uuid4()}",
                recipient_id=recipient_id,
                actor_id=actor_id,
                channelvideo_id=channelvideo_id,
                notification_type=NOTIFICATION_TYPE_COMMENT,
                is_read=False,
                creation_date=_now(),
            )
        )
    await db_session.commit()


async def _to_read(notification: Notification, db_session: AsyncSession) -> NotificationRead:
    actor = (
        await db_session.execute(select(User).where(User.id == notification.actor_id))
    ).scalars().first()
    return NotificationRead(
        **notification.model_dump(),
        actor=UserReadAuthor.model_validate(actor.model_dump()) if actor else None,
    )


async def list_notifications(
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 50,
) -> List[NotificationRead]:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)

    offset = (page - 1) * limit
    notifications = (
        await db_session.execute(
            select(Notification)
            .where(Notification.recipient_id == acting_user_id)
            .order_by(Notification.creation_date.desc())  # type: ignore
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    if not notifications:
        return []

    actor_ids = [n.actor_id for n in notifications]
    actors = (
        await db_session.execute(select(User).where(User.id.in_(actor_ids)))  # type: ignore
    ).scalars().all()
    actors_map = {a.id: a for a in actors}

    return [
        NotificationRead(
            **n.model_dump(),
            actor=(
                UserReadAuthor.model_validate(actors_map[n.actor_id].model_dump())
                if n.actor_id in actors_map
                else None
            ),
        )
        for n in notifications
    ]


async def get_unread_notification_count(
    current_user: Union[PublicUser, AnonymousUser], db_session: AsyncSession
) -> int:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)

    count = (
        await db_session.execute(
            select(func.count()).select_from(Notification).where(
                Notification.recipient_id == acting_user_id,
                Notification.is_read == False,  # noqa: E712
            )
        )
    ).scalar_one()
    return int(count)


async def _get_own_notification_or_404(
    acting_user_id: int, notification_uuid: str, db_session: AsyncSession
) -> Notification:
    notification = (
        await db_session.execute(
            select(Notification).where(
                Notification.notification_uuid == notification_uuid,
                Notification.recipient_id == acting_user_id,
            )
        )
    ).scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


async def mark_notification_read(
    current_user: Union[PublicUser, AnonymousUser],
    notification_uuid: str,
    db_session: AsyncSession,
) -> NotificationRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)

    notification = await _get_own_notification_or_404(acting_user_id, notification_uuid, db_session)
    notification.is_read = True
    db_session.add(notification)
    await db_session.commit()
    await db_session.refresh(notification)

    return await _to_read(notification, db_session)


async def mark_all_notifications_read(
    current_user: Union[PublicUser, AnonymousUser], db_session: AsyncSession
) -> int:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)

    # Phase 9B: a single bulk UPDATE rather than hydrating every unread row
    # into Python to flip one boolean. `rowcount` gives the same number the
    # previous `len(unread)` did, so the {"marked_read": n} contract is
    # unchanged. The recipient_id predicate is what keeps this scoped to the
    # acting user — it must never be relaxed.
    result = await db_session.execute(
        update(Notification)
        .where(
            Notification.recipient_id == acting_user_id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    await db_session.commit()

    return int(result.rowcount or 0)
