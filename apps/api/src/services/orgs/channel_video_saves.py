"""
ChannelVideoSave service (Phase 4D).

A save is a lightweight (channelvideo, user) toggle — see
db/channel_video_saves.py and docs/ARCHITECTURE.md § "Social Engagement
(Phase 4A)". Unlike likes, a save has no public count: it's a private
per-user bookmark, so the status here only ever reflects the viewer's own
save state. Mirrors src/services/orgs/channel_video_likes.py exactly except
for that.

Visibility/ownership is deliberately NOT re-implemented here: every function
first calls the existing `get_channel_video` (Phase 2C), which already
raises the project's real 404/403 rule (published+public visible to anyone,
otherwise this channel's owner/admin only — see services/orgs/channel_videos.py).
Reusing it guarantees a viewer can never save/see-the-status-of a video they
couldn't actually watch, without duplicating that predicate.
"""

from datetime import datetime, timezone
from typing import Union
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.channel_video_saves import ChannelVideoSave
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.services.orgs.channel_videos import get_channel_video


class ChannelVideoSaveStatus(SQLModel):
    is_saved: bool


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def get_save_status(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoSaveStatus:
    # Raises 404 (org/video not found) or 403 (not visible to this viewer)
    # via the existing rule — see get_channel_video. Anonymous/public
    # viewers of a public video are let through; is_saved is always False
    # for them.
    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)

    is_saved = False
    if not isinstance(current_user, AnonymousUser):
        viewer_user_id = resolve_acting_user_id(current_user)
        existing = (await db_session.execute(
            select(ChannelVideoSave).where(
                ChannelVideoSave.channelvideo_id == channelvideo_id,
                ChannelVideoSave.user_id == viewer_user_id,
            )
        )).scalars().first()
        is_saved = existing is not None

    return ChannelVideoSaveStatus(is_saved=is_saved)


async def save_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoSaveStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)

    existing = (await db_session.execute(
        select(ChannelVideoSave).where(
            ChannelVideoSave.channelvideo_id == channelvideo_id,
            ChannelVideoSave.user_id == acting_user_id,
        )
    )).scalars().first()

    if not existing:
        save = ChannelVideoSave(
            channelvideo_id=channelvideo_id,
            user_id=acting_user_id,
            save_uuid=f"channelvideosave_{uuid4()}",
            creation_date=_now(),
        )
        db_session.add(save)
        try:
            await db_session.commit()
        except IntegrityError:
            # Concurrent duplicate save (e.g. rapid double-click) violates the
            # (channelvideo_id, user_id) unique constraint. Treat it as
            # idempotent "already saved" instead of surfacing an unhandled 500.
            await db_session.rollback()

    return ChannelVideoSaveStatus(is_saved=True)


async def unsave_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoSaveStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)

    existing = (await db_session.execute(
        select(ChannelVideoSave).where(
            ChannelVideoSave.channelvideo_id == channelvideo_id,
            ChannelVideoSave.user_id == acting_user_id,
        )
    )).scalars().first()

    if existing:
        await db_session.delete(existing)
        await db_session.commit()

    return ChannelVideoSaveStatus(is_saved=False)
