from typing import List, Union

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.notifications.notifications import (
    NotificationRead,
    get_unread_notification_count,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)

# Basic in-app notifications (Phase 4H / roadmap "Basic notifications") — a
# global router (no org_id in the path), mirroring routers/feed.py's pattern:
# a notification is personal to the caller, not org-scoped.
router = APIRouter()


@router.get(
    "",
    response_model=List[NotificationRead],
    summary="List the authenticated user's notifications",
    description="Newest-first, paginated. Only ever returns the caller's own notifications.",
    responses={
        200: {"description": "Notifications.", "model": List[NotificationRead]},
        401: {"description": "Not authenticated"},
    },
)
async def api_list_notifications(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[NotificationRead]:
    return await list_notifications(current_user, db_session, page, limit)


@router.get(
    "/unread-count",
    summary="Get the authenticated user's unread notification count",
    responses={
        200: {"description": "Unread count."},
        401: {"description": "Not authenticated"},
    },
)
async def api_get_unread_notification_count(
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    count = await get_unread_notification_count(current_user, db_session)
    return {"count": count}


@router.patch(
    "/{notification_uuid}/read",
    response_model=NotificationRead,
    summary="Mark a single notification as read",
    description="Recipient only.",
    responses={
        200: {"description": "Updated notification.", "model": NotificationRead},
        401: {"description": "Not authenticated"},
        404: {"description": "Notification not found"},
    },
)
async def api_mark_notification_read(
    notification_uuid: str,
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> NotificationRead:
    return await mark_notification_read(current_user, notification_uuid, db_session)


@router.patch(
    "/read-all",
    summary="Mark all of the authenticated user's notifications as read",
    responses={
        200: {"description": "Number of notifications marked read."},
        401: {"description": "Not authenticated"},
    },
)
async def api_mark_all_notifications_read(
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    marked = await mark_all_notifications_read(current_user, db_session)
    return {"marked_read": marked}
