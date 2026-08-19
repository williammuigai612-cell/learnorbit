"""
ChannelVideoLike service (Phase 4B).

A like is a lightweight (channelvideo, user) toggle — see
db/channel_video_likes.py and docs/ARCHITECTURE.md § "Social Engagement
(Phase 4A)". This module manages only that toggle and its live count.

Visibility/ownership is deliberately NOT re-implemented here: every function
first calls the existing `get_channel_video` (Phase 2C), which already
raises the project's real 404/403 rule (published+public visible to anyone,
otherwise this channel's owner/admin only — see services/orgs/channel_videos.py).
Reusing it guarantees a viewer can never like/see-the-status-of a video they
couldn't actually watch, without duplicating that predicate.
"""

from datetime import datetime, timezone
from typing import Union
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.channel_video_likes import ChannelVideoLike
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.services.orgs.channel_videos import get_channel_video


class ChannelVideoLikeStatus(SQLModel):
    is_liked: bool
    like_count: int


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def _like_count(channelvideo_id: int, db_session: AsyncSession) -> int:
    result = await db_session.execute(
        select(func.count()).select_from(ChannelVideoLike).where(
            ChannelVideoLike.channelvideo_id == channelvideo_id
        )
    )
    return result.scalar_one()


async def get_like_status(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoLikeStatus:
    # Raises 404 (org/video not found) or 403 (not visible to this viewer)
    # via the existing rule — see get_channel_video. Anonymous/public
    # viewers of a public video are let through; is_liked is always False
    # for them.
    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)

    is_liked = False
    if not isinstance(current_user, AnonymousUser):
        viewer_user_id = resolve_acting_user_id(current_user)
        existing = (await db_session.execute(
            select(ChannelVideoLike).where(
                ChannelVideoLike.channelvideo_id == channelvideo_id,
                ChannelVideoLike.user_id == viewer_user_id,
            )
        )).scalars().first()
        is_liked = existing is not None

    like_count = await _like_count(channelvideo_id, db_session)
    return ChannelVideoLikeStatus(is_liked=is_liked, like_count=like_count)


async def like_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoLikeStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)

    existing = (await db_session.execute(
        select(ChannelVideoLike).where(
            ChannelVideoLike.channelvideo_id == channelvideo_id,
            ChannelVideoLike.user_id == acting_user_id,
        )
    )).scalars().first()

    if not existing:
        like = ChannelVideoLike(
            channelvideo_id=channelvideo_id,
            user_id=acting_user_id,
            like_uuid=f"channelvideolike_{uuid4()}",
            creation_date=_now(),
        )
        db_session.add(like)
        try:
            await db_session.commit()
        except IntegrityError:
            # Concurrent duplicate like (e.g. rapid double-click) violates the
            # (channelvideo_id, user_id) unique constraint. Treat it as
            # idempotent "already liked" instead of surfacing an unhandled 500.
            await db_session.rollback()

    like_count = await _like_count(channelvideo_id, db_session)
    return ChannelVideoLikeStatus(is_liked=True, like_count=like_count)


async def unlike_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoLikeStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)

    existing = (await db_session.execute(
        select(ChannelVideoLike).where(
            ChannelVideoLike.channelvideo_id == channelvideo_id,
            ChannelVideoLike.user_id == acting_user_id,
        )
    )).scalars().first()

    if existing:
        await db_session.delete(existing)
        await db_session.commit()

    like_count = await _like_count(channelvideo_id, db_session)
    return ChannelVideoLikeStatus(is_liked=False, like_count=like_count)
