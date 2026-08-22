"""
ChannelResource service — the discovery/metadata layer over the existing
Activity document infrastructure. See docs/ARCHITECTURE.md § "Academic
Library (Phase 5A)".

This module does NOT upload, store, or validate PDFs — it only manages which
of a channel's already-created document Activities are published as
discoverable channel posts, with educational metadata. A ChannelResource's
`activity_id` must reference an Activity created through the existing,
unmodified document-activity endpoint (POST /orgs/{org_id}/courses/
{course_uuid}/activities/documentpdf).
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.channel_resources import ChannelResource
from src.db.courses.activities import Activity, ActivityTypeEnum
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin


# ---------------------------------------------------------------------------
# Schemas (request/response only — the table model is db/channel_resources.py)
# ---------------------------------------------------------------------------

class ChannelResourceCreate(SQLModel):
    activity_id: int
    title: str
    description: Optional[str] = None
    visibility: str = "public"
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None
    year: Optional[str] = None


class ChannelResourcePublish(SQLModel):
    published: bool


class ChannelResourceUpdate(SQLModel):
    """Partial update — only fields explicitly set on the request are applied
    (see update_channel_resource's `exclude_unset` usage); omitted fields are
    left unchanged."""
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None
    year: Optional[str] = None


class ChannelResourceRead(SQLModel):
    id: int
    channelresource_uuid: str
    org_id: int
    activity_id: int
    title: str
    description: Optional[str] = None
    published: bool
    visibility: str
    creation_date: str
    update_date: str
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None
    year: Optional[str] = None


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


async def _get_channel_resource_or_404(
    org_id: int, channelresource_id: int, db_session: AsyncSession
) -> ChannelResource:
    # SECURITY: scoped to org_id so a resource can never be fetched/modified
    # through another organization's id in the path.
    resource = (await db_session.execute(
        select(ChannelResource).where(
            ChannelResource.id == channelresource_id,
            ChannelResource.org_id == org_id,
        )
    )).scalars().first()
    if not resource:
        raise HTTPException(status_code=404, detail="Channel resource not found")
    return resource


async def _require_channel_admin(
    current_user: PublicUser | AnonymousUser, org_id: int, db_session: AsyncSession
) -> int:
    """Raise unless the acting user is an owner/admin of this channel.
    Returns the acting user's id on success. Same pattern as
    channel_videos._require_channel_admin."""
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

async def create_channel_resource(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: ChannelResourceCreate,
) -> ChannelResourceRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)

    activity = (await db_session.execute(
        select(Activity).where(Activity.id == data.activity_id)
    )).scalars().first()
    # SECURITY: the activity must already belong to THIS org — otherwise an
    # admin of org A could post org B's document as their own channel
    # content. Not found and wrong-org are reported identically (404) so a
    # caller can't probe for other orgs' activity ids.
    if not activity or activity.org_id != org.id:
        raise HTTPException(status_code=404, detail="Document activity not found")
    if activity.activity_type != ActivityTypeEnum.TYPE_DOCUMENT:
        raise HTTPException(status_code=409, detail="Activity is not a document")

    existing = (await db_session.execute(
        select(ChannelResource).where(ChannelResource.activity_id == activity.id)
    )).scalars().first()
    if existing:
        raise HTTPException(
            status_code=409, detail="This document has already been posted to a channel"
        )

    now = _now()
    resource = ChannelResource(
        channelresource_uuid=f"channelresource_{uuid4()}",
        org_id=org.id,
        activity_id=activity.id,
        title=data.title,
        description=data.description,
        visibility=data.visibility or "public",
        subject=data.subject,
        topic=data.topic,
        level=data.level,
        institution_context=data.institution_context,
        resource_type=data.resource_type,
        year=data.year,
        creation_date=now,
        update_date=now,
    )
    db_session.add(resource)
    await db_session.commit()
    await db_session.refresh(resource)
    return ChannelResourceRead.model_validate(resource)


async def list_channel_resources(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    level: Optional[str] = None,
    institution_context: Optional[str] = None,
    resource_type: Optional[str] = None,
    year: Optional[str] = None,
) -> list[ChannelResourceRead]:
    org = await _get_org_or_404(org_id, db_session)

    viewer_is_admin = False
    if not isinstance(current_user, AnonymousUser):
        acting_user_id = resolve_acting_user_id(current_user)
        viewer_is_admin = await is_org_admin(acting_user_id, org.id, db_session)

    statement = select(ChannelResource).where(ChannelResource.org_id == org.id)
    if not viewer_is_admin:
        # Public/anonymous viewers and non-admin members only ever see
        # published, publicly-visible posts. "unlisted" is reachable by
        # direct link (get_channel_resource) but excluded from listing/browse.
        statement = statement.where(
            ChannelResource.published == True,  # noqa: E712
            ChannelResource.visibility == "public",
        )
    if subject is not None:
        statement = statement.where(ChannelResource.subject == subject)
    if topic is not None:
        statement = statement.where(ChannelResource.topic == topic)
    if level is not None:
        statement = statement.where(ChannelResource.level == level)
    if institution_context is not None:
        statement = statement.where(ChannelResource.institution_context == institution_context)
    if resource_type is not None:
        statement = statement.where(ChannelResource.resource_type == resource_type)
    if year is not None:
        statement = statement.where(ChannelResource.year == year)

    # Newest-first — same convention as list_channel_videos; no manual order
    # column, PRD explicitly rules out algorithmic/curated ranking.
    statement = statement.order_by(ChannelResource.creation_date.desc())

    rows = (await db_session.execute(statement)).scalars().all()
    return [ChannelResourceRead.model_validate(r) for r in rows]


async def get_channel_resource(
    request: Request,
    org_id: int,
    channelresource_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ChannelResourceRead:
    org = await _get_org_or_404(org_id, db_session)
    resource = await _get_channel_resource_or_404(org.id, channelresource_id, db_session)

    if resource.published and resource.visibility == "public":
        return ChannelResourceRead.model_validate(resource)

    # Not publicly visible: only this channel's owner/admins may view it.
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=403, detail="This resource is not published")
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_org_admin(acting_user_id, org.id, db_session):
        raise HTTPException(status_code=403, detail="This resource is not published")

    return ChannelResourceRead.model_validate(resource)


async def set_channel_resource_published(
    request: Request,
    org_id: int,
    channelresource_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: ChannelResourcePublish,
) -> ChannelResourceRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    resource = await _get_channel_resource_or_404(org.id, channelresource_id, db_session)

    resource.published = data.published
    resource.update_date = _now()
    db_session.add(resource)
    await db_session.commit()
    await db_session.refresh(resource)
    return ChannelResourceRead.model_validate(resource)


async def update_channel_resource(
    request: Request,
    org_id: int,
    channelresource_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    data: ChannelResourceUpdate,
) -> ChannelResourceRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    resource = await _get_channel_resource_or_404(org.id, channelresource_id, db_session)

    updates = data.model_dump(exclude_unset=True)
    if "title" in updates and not (updates["title"] or "").strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")

    for field, value in updates.items():
        setattr(resource, field, value)
    resource.update_date = _now()

    db_session.add(resource)
    await db_session.commit()
    await db_session.refresh(resource)
    return ChannelResourceRead.model_validate(resource)


async def delete_channel_resource(
    request: Request,
    org_id: int,
    channelresource_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)
    resource = await _get_channel_resource_or_404(org.id, channelresource_id, db_session)

    # Removes only the channel's discovery post. The underlying Activity
    # (upload/storage/validation) is intentionally left untouched — it may
    # still be used as a lesson inside its course; see docs/ARCHITECTURE.md
    # § "Academic Library (Phase 5A)" for the cascade/asymmetry rationale.
    # Deleting the document itself is a separate, existing, unmodified action
    # (the activity-delete endpoint) — not duplicated here.
    await db_session.delete(resource)
    await db_session.commit()
