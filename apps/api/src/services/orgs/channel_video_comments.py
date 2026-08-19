"""
ChannelVideoComment service (Phase 4C).

A comment is a flat (channelvideo, author) row — see db/channel_video_comments.py
and docs/ARCHITECTURE.md § "Social Engagement (Phase 4A/4B)". No threading, no
voting, no configurable moderation — only a hard-coded max length.

Visibility/ownership for create/list is deliberately NOT re-implemented here:
both call the existing `get_channel_video` (Phase 2C), which already raises
the project's real 404/403 rule (published+public visible to anyone,
otherwise this channel's owner/admin only — see services/orgs/channel_videos.py).
Reusing it guarantees a viewer can never comment-on/see-comments-of a video
they couldn't actually watch, without duplicating that predicate.

Edit/delete authorization is author-only (no channel-admin override) — Phase
4C's scope is create/list/edit-own/delete-own; channel-owner moderation of
other people's comments is not part of this phase.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Union
from uuid import uuid4

from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.channel_video_comments import ChannelVideoComment
from src.db.users import AnonymousUser, PublicUser, User, UserReadAuthor
from src.security.auth import resolve_acting_user_id
from src.services.notifications.notifications import create_comment_notifications
from src.services.orgs.channel_videos import get_channel_video

MAX_COMMENT_LENGTH = 2000


class ChannelVideoCommentCreate(SQLModel):
    content: str


class ChannelVideoCommentUpdate(SQLModel):
    content: str


class ChannelVideoCommentRead(SQLModel):
    id: int
    channelvideo_id: int
    content: str
    comment_uuid: str
    creation_date: str
    update_date: str
    author: Optional[UserReadAuthor] = None


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


def _validate_content(content: str) -> str:
    stripped = content.strip()
    if not stripped:
        raise HTTPException(status_code=422, detail="Comment cannot be empty")
    if len(stripped) > MAX_COMMENT_LENGTH:
        raise HTTPException(status_code=422, detail="Comment is too long")
    return stripped


async def _get_comment_or_404(
    channelvideo_id: int, comment_uuid: str, db_session: AsyncSession
) -> ChannelVideoComment:
    comment = (
        await db_session.execute(
            select(ChannelVideoComment).where(
                ChannelVideoComment.comment_uuid == comment_uuid,
                ChannelVideoComment.channelvideo_id == channelvideo_id,
            )
        )
    ).scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


async def _to_read(comment: ChannelVideoComment, db_session: AsyncSession) -> ChannelVideoCommentRead:
    author = (
        await db_session.execute(select(User).where(User.id == comment.author_id))
    ).scalars().first()
    return ChannelVideoCommentRead(
        **comment.model_dump(),
        author=UserReadAuthor.model_validate(author.model_dump()) if author else None,
    )


async def _try_create_comment_notifications(
    org_id: int, channelvideo_id: int, actor_id: int, db_session: AsyncSession
) -> None:
    """Best-effort: notify the video's admin(s) of the new comment. Never
    fails comment creation — mirrors `_try_record_org_admin_in_loops`
    (services/orgs/orgs.py). See docs/ARCHITECTURE.md § "Basic Notifications
    (Phase 4H)"."""
    try:
        await create_comment_notifications(org_id, channelvideo_id, actor_id, db_session)
    except Exception:
        logging.exception("create_comment_notifications failed")
        await db_session.rollback()


async def create_channel_video_comment(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    content: str,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoCommentRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)
    clean_content = _validate_content(content)

    comment = ChannelVideoComment(
        channelvideo_id=channelvideo_id,
        author_id=acting_user_id,
        content=clean_content,
        comment_uuid=f"channelvideocomment_{uuid4()}",
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(comment)
    await db_session.commit()
    await db_session.refresh(comment)

    # Read the response before firing the best-effort notification: a
    # notification failure can roll back db_session (expiring ORM
    # instances), so anything the response needs from `comment` must be
    # extracted first.
    result = await _to_read(comment, db_session)

    await _try_create_comment_notifications(org_id, channelvideo_id, acting_user_id, db_session)

    return result


async def list_channel_video_comments(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 50,
) -> List[ChannelVideoCommentRead]:
    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)

    offset = (page - 1) * limit
    comments = (
        await db_session.execute(
            select(ChannelVideoComment)
            .where(ChannelVideoComment.channelvideo_id == channelvideo_id)
            .order_by(ChannelVideoComment.creation_date.desc())  # type: ignore
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    if not comments:
        return []

    author_ids = [c.author_id for c in comments]
    authors = (
        await db_session.execute(select(User).where(User.id.in_(author_ids)))  # type: ignore
    ).scalars().all()
    authors_map = {a.id: a for a in authors}

    return [
        ChannelVideoCommentRead(
            **comment.model_dump(),
            author=(
                UserReadAuthor.model_validate(authors_map[comment.author_id].model_dump())
                if comment.author_id in authors_map
                else None
            ),
        )
        for comment in comments
    ]


async def update_channel_video_comment(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    comment_uuid: str,
    content: str,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoCommentRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    comment = await _get_comment_or_404(channelvideo_id, comment_uuid, db_session)
    acting_user_id = resolve_acting_user_id(current_user)
    if comment.author_id != acting_user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    comment.content = _validate_content(content)
    comment.update_date = _now()

    db_session.add(comment)
    await db_session.commit()
    await db_session.refresh(comment)

    return await _to_read(comment, db_session)


async def delete_channel_video_comment(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    comment_uuid: str,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> dict:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    comment = await _get_comment_or_404(channelvideo_id, comment_uuid, db_session)
    acting_user_id = resolve_acting_user_id(current_user)
    if comment.author_id != acting_user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    await db_session.delete(comment)
    await db_session.commit()

    return {"detail": "Comment deleted"}
