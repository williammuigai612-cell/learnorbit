"""
ChannelVideoShare service (Phase 4E).

A share is an append-only event log, not a toggle — see
db/channel_video_shares.py and docs/ARCHITECTURE.md § "Social Engagement
(Phase 4A)". Unlike Like/Save, there is no per-user uniqueness and no
unshare: repeated shares by the same user are all valid and all counted, so
this module only ever adds rows, never removes them.

Visibility/ownership is deliberately NOT re-implemented here: every function
first calls the existing `get_channel_video` (Phase 2C), which already
raises the project's real 404/403 rule (published+public visible to anyone,
otherwise this channel's owner/admin only — see services/orgs/channel_videos.py).
Reusing it guarantees a viewer can never share/see-the-count-of a video they
couldn't actually watch, without duplicating that predicate.
"""

from datetime import datetime, timezone
from typing import Union
from uuid import uuid4

from sqlalchemy import func
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.channel_video_shares import ChannelVideoShare
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.services.orgs.channel_videos import get_channel_video


class ChannelVideoShareStatus(SQLModel):
    share_count: int


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def _share_count(channelvideo_id: int, db_session: AsyncSession) -> int:
    result = await db_session.execute(
        select(func.count()).select_from(ChannelVideoShare).where(
            ChannelVideoShare.channelvideo_id == channelvideo_id
        )
    )
    return result.scalar_one()


async def get_share_status(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoShareStatus:
    # Raises 404 (org/video not found) or 403 (not visible to this viewer)
    # via the existing rule — see get_channel_video. Anonymous/public
    # viewers of a public video are let through; share_count is a public
    # total, same as like_count.
    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)

    share_count = await _share_count(channelvideo_id, db_session)
    return ChannelVideoShareStatus(share_count=share_count)


async def share_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoShareStatus:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)

    share = ChannelVideoShare(
        channelvideo_id=channelvideo_id,
        user_id=acting_user_id,
        share_uuid=f"channelvideoshare_{uuid4()}",
        creation_date=_now(),
    )
    db_session.add(share)
    await db_session.commit()

    share_count = await _share_count(channelvideo_id, db_session)
    return ChannelVideoShareStatus(share_count=share_count)
