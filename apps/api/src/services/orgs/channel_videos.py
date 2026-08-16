"""
ChannelVideo service — the discovery/metadata layer over the existing
Activity video infrastructure. See docs/ARCHITECTURE.md § "Videos (Phase 2A)".

This module does NOT upload, store, transcode, or stream video — it only
manages which of a channel's already-created video Activities are published
as discoverable channel posts, with educational metadata. A ChannelVideo's
`activity_id` must reference an Activity created through the existing,
unmodified video-activity endpoints (POST /orgs/{org_id}/courses/{course_uuid}
/activities/video or /external_video).
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.channel_videos import ChannelVideo
from src.db.courses.activities import Activity, ActivityTypeEnum
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin


# ---------------------------------------------------------------------------
# Schemas (request/response only — the table model is db/channel_videos.py)
# ---------------------------------------------------------------------------

class ChannelVideoCreate(SQLModel):
    activity_id: int
    title: str
    description: Optional[str] = None
    thumbnail_image: Optional[str] = None
    visibility: str = "public"
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None


class ChannelVideoPublish(SQLModel):
    published: bool


class ChannelVideoUpdate(SQLModel):
    """Partial update — only fields explicitly set on the request are applied
    (see update_channel_video's `exclude_unset` usage); omitted fields are
    left unchanged."""
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None


class ChannelVideoRead(SQLModel):
    id: int
    channelvideo_uuid: str
    org_id: int
    activity_id: int
    title: str
    description: Optional[str] = None
    thumbnail_image: Optional[str] = None
    published: bool
    visibility: str
    creation_date: str
    update_date: str
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (await db_session.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _get_channel_video_or_404(
    org_id: int, channelvideo_id: int, db_session: AsyncSession
) -> ChannelVideo:
    # SECURITY: scoped to org_id so a video can never be fetched/modified
    # through another organization's id in the path.
    video = (await db_session.execute(
        select(ChannelVideo).where(
            ChannelVideo.id == channelvideo_id,
            ChannelVideo.org_id == org_id,
        )
    )).scalars().first()
    if not video:
        raise HTTPException(status_code=404, detail="Channel video not found")
    return video


async def _require_channel_admin(
    current_user: PublicUser | AnonymousUser, org_id: int, db_session: AsyncSession
) -> int:
    """Raise unless the acting user is an owner/admin of this channel.
    Returns the acting user's id on success. Follows the same
    get_current_user / resolve_acting_user_id / is_org_admin pattern already
    used for org membership checks elsewhere (src/security/org_auth.py).
    """
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(acting_user_id, org_id, db_session):
        raise HTTPException(
            status_code=403, detail="Only this channel's owner/admins can do this"
        )
    return acting_user_id


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def create_channel_video(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: ChannelVideoCreate,
) -> ChannelVideoRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)

    activity = (await db_session.execute(
        select(Activity).where(Activity.id == data.activity_id)
    )).scalars().first()
    # SECURITY: the activity must already belong to THIS org — otherwise an
    # admin of org A could post org B's video as their own channel content.
    # Not found and wrong-org are reported identically (404) so a caller can't
    # probe for other orgs' activity ids.
    if not activity or activity.org_id != org.id:
        raise HTTPException(status_code=404, detail="Video activity not found")
    if activity.activity_type != ActivityTypeEnum.TYPE_VIDEO:
        raise HTTPException(status_code=409, detail="Activity is not a video")

    existing = (await db_session.execute(
        select(ChannelVideo).where(ChannelVideo.activity_id == activity.id)
    )).scalars().first()
    if existing:
        raise HTTPException(
            status_code=409, detail="This video has already been posted to a channel"
        )

    now = _now()
    video = ChannelVideo(
        channelvideo_uuid=f"channelvideo_{uuid4()}",
        org_id=org.id,
        activity_id=activity.id,
        title=data.title,
        description=data.description,
        thumbnail_image=data.thumbnail_image,
        visibility=data.visibility or "public",
        subject=data.subject,
        topic=data.topic,
        level=data.level,
        institution_context=data.institution_context,
        resource_type=data.resource_type,
        creation_date=now,
        update_date=now,
    )
    db_session.add(video)
    await db_session.commit()
    await db_session.refresh(video)
    return ChannelVideoRead.model_validate(video)


async def list_channel_videos(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    level: Optional[str] = None,
    institution_context: Optional[str] = None,
    resource_type: Optional[str] = None,
) -> list[ChannelVideoRead]:
    org = await _get_org_or_404(org_id, db_session)

    viewer_is_admin = False
    if not isinstance(current_user, AnonymousUser):
        acting_user_id = resolve_acting_user_id(current_user)
        viewer_is_admin = await is_org_admin(acting_user_id, org.id, db_session)

    statement = select(ChannelVideo).where(ChannelVideo.org_id == org.id)
    if not viewer_is_admin:
        # Public/anonymous viewers and non-admin members only ever see
        # published, publicly-visible posts. "unlisted" is reachable by
        # direct link (get_channel_video) but excluded from listing/browse.
        statement = statement.where(
            ChannelVideo.published == True,  # noqa: E712
            ChannelVideo.visibility == "public",
        )
    if subject is not None:
        statement = statement.where(ChannelVideo.subject == subject)
    if topic is not None:
        statement = statement.where(ChannelVideo.topic == topic)
    if level is not None:
        statement = statement.where(ChannelVideo.level == level)
    if institution_context is not None:
        statement = statement.where(ChannelVideo.institution_context == institution_context)
    if resource_type is not None:
        statement = statement.where(ChannelVideo.resource_type == resource_type)

    # Newest-first — per docs/ARCHITECTURE.md § "Videos (Phase 2A)", no manual
    # order column; PRD explicitly rules out algorithmic/curated ranking.
    statement = statement.order_by(ChannelVideo.creation_date.desc())

    rows = (await db_session.execute(statement)).scalars().all()
    return [ChannelVideoRead.model_validate(r) for r in rows]


async def get_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ChannelVideoRead:
    org = await _get_org_or_404(org_id, db_session)
    video = await _get_channel_video_or_404(org.id, channelvideo_id, db_session)

    if video.published and video.visibility == "public":
        return ChannelVideoRead.model_validate(video)

    # Not publicly visible: only this channel's owner/admins may view it.
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=403, detail="This video is not published")
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(acting_user_id, org.id, db_session):
        raise HTTPException(status_code=403, detail="This video is not published")

    return ChannelVideoRead.model_validate(video)


async def set_channel_video_published(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: ChannelVideoPublish,
) -> ChannelVideoRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    video = await _get_channel_video_or_404(org.id, channelvideo_id, db_session)

    video.published = data.published
    video.update_date = _now()
    db_session.add(video)
    await db_session.commit()
    await db_session.refresh(video)
    return ChannelVideoRead.model_validate(video)


async def update_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: ChannelVideoUpdate,
) -> ChannelVideoRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    video = await _get_channel_video_or_404(org.id, channelvideo_id, db_session)

    updates = data.model_dump(exclude_unset=True)
    if "title" in updates and not (updates["title"] or "").strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")

    for field, value in updates.items():
        setattr(video, field, value)
    video.update_date = _now()

    db_session.add(video)
    await db_session.commit()
    await db_session.refresh(video)
    return ChannelVideoRead.model_validate(video)


async def delete_channel_video(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    video = await _get_channel_video_or_404(org.id, channelvideo_id, db_session)

    # Removes only the channel's discovery post. The underlying Activity
    # (upload/storage/HLS/captions) is intentionally left untouched — it may
    # still be used as a lesson inside its course; see docs/ARCHITECTURE.md
    # § "Videos (Phase 2A)" for the cascade/asymmetry rationale. Deleting the
    # video itself is a separate, existing, unmodified action (the
    # activity-delete endpoint) — not duplicated here.
    await db_session.delete(video)
    await db_session.commit()
