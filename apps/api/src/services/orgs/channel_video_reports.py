"""
ChannelVideoReport service (Phase 8A).

A report is a (channelvideo, reporter) row with a fixed reason — see
db/channel_video_reports.py and docs/ARCHITECTURE.md § "Trust & Moderation
(Phase 8A)". This phase is submission-only: creating a report is the entire
surface. There is no list/review/resolve endpoint here — every row is
created with status="OPEN" and stays that way; the admin-facing review
workflow that reads and transitions `status` is a later Phase 8 increment,
not built here.

Visibility/ownership is deliberately NOT re-implemented here: `get_channel_video`
(Phase 2C) already raises the project's real 404/403 rule (published+public
visible to anyone, otherwise this channel's owner/admin only — see
services/orgs/channel_videos.py). Reusing it guarantees a viewer can never
report a video they couldn't actually watch, without duplicating that
predicate.
"""

from datetime import datetime, timezone
from typing import Optional, Union
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException, Request

from src.db.channel_video_reports import ChannelVideoReport
from src.db.organizations import Organization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_admin
from src.services.orgs.channel_videos import get_channel_video

# Fixed set, not sourced from any real moderation policy yet — a Phase 8A
# placeholder pending a real category list. See docs/ARCHITECTURE.md § "Trust
# & Moderation (Phase 8A)".
ALLOWED_REPORT_REASONS = {"SPAM", "INAPPROPRIATE", "MISINFORMATION", "COPYRIGHT", "OTHER"}
MAX_REPORT_DETAILS_LENGTH = 1000

# Phase 8B — valid targets for resolve_channel_video_report. "OPEN" is only
# ever set at creation time (see create_channel_video_report); it is
# deliberately not a valid transition target here, so a report can't be
# reopened once reviewed.
ALLOWED_REPORT_STATUSES = {"RESOLVED", "DISMISSED"}


class ChannelVideoReportCreate(SQLModel):
    reason: str
    details: Optional[str] = None


class ChannelVideoReportRead(SQLModel):
    id: int
    channelvideo_id: int
    report_uuid: str
    reason: str
    details: Optional[str] = None
    status: str
    creation_date: str


class ChannelVideoReportStatusUpdate(SQLModel):
    status: str


def _now() -> str:
    return str(datetime.now(timezone.utc).replace(tzinfo=None))


async def _get_org_or_404(org_id: int, db_session: AsyncSession) -> Organization:
    org = (await db_session.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _require_channel_admin(
    current_user: Union[PublicUser, AnonymousUser], org_id: int, db_session: AsyncSession
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


async def _get_report_or_404(
    org_id: int, report_uuid: str, db_session: AsyncSession
) -> ChannelVideoReport:
    # SECURITY: scoped to org_id so a report can never be fetched/modified
    # through another organization's id in the path.
    report = (await db_session.execute(
        select(ChannelVideoReport).where(
            ChannelVideoReport.report_uuid == report_uuid,
            ChannelVideoReport.org_id == org_id,
        )
    )).scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


def _validate_report_input(reason: str, details: Optional[str]) -> tuple[str, Optional[str]]:
    if reason not in ALLOWED_REPORT_REASONS:
        raise HTTPException(status_code=422, detail="Invalid report reason")

    clean_details = (details or "").strip() or None
    if clean_details and len(clean_details) > MAX_REPORT_DETAILS_LENGTH:
        raise HTTPException(status_code=422, detail="Report details are too long")

    return reason, clean_details


async def _get_existing_report(
    channelvideo_id: int, reporter_id: int, db_session: AsyncSession
) -> Optional[ChannelVideoReport]:
    return (
        await db_session.execute(
            select(ChannelVideoReport).where(
                ChannelVideoReport.channelvideo_id == channelvideo_id,
                ChannelVideoReport.reporter_id == reporter_id,
            )
        )
    ).scalars().first()


def _to_read(report: ChannelVideoReport) -> ChannelVideoReportRead:
    return ChannelVideoReportRead(**report.model_dump())


async def create_channel_video_report(
    request: Request,
    org_id: int,
    channelvideo_id: int,
    data: ChannelVideoReportCreate,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoReportRead:
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")

    # Raises 404 (org/video not found) or 403 (not visible to this viewer)
    # via the existing rule — see get_channel_video.
    await get_channel_video(request, org_id, channelvideo_id, current_user, db_session)
    acting_user_id = resolve_acting_user_id(current_user)
    reason, details = _validate_report_input(data.reason, data.details)

    existing = await _get_existing_report(channelvideo_id, acting_user_id, db_session)
    if existing:
        return _to_read(existing)

    report = ChannelVideoReport(
        channelvideo_id=channelvideo_id,
        reporter_id=acting_user_id,
        org_id=org_id,
        reason=reason,
        details=details,
        report_uuid=f"channelvideoreport_{uuid4()}",
        creation_date=_now(),
    )
    db_session.add(report)
    try:
        await db_session.commit()
    except IntegrityError:
        # Concurrent duplicate report (e.g. rapid double-submit) violates the
        # (channelvideo_id, reporter_id) unique constraint. Treat it as
        # idempotent success instead of surfacing an unhandled 500.
        await db_session.rollback()
        existing = await _get_existing_report(channelvideo_id, acting_user_id, db_session)
        return _to_read(existing)

    await db_session.refresh(report)
    return _to_read(report)


# ---------------------------------------------------------------------------
# Admin review queue (Phase 8B) — reads and transitions `status`. Channel
# owner/admin only (superadmin bypass baked into is_org_admin), same
# authorization convention as every other admin-only channel surface
# (questions.py's list_questions, channel_videos.py's create/update/delete).
# ---------------------------------------------------------------------------

async def list_channel_video_reports(
    request: Request,
    org_id: int,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> list[ChannelVideoReportRead]:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)

    statement = select(ChannelVideoReport).where(ChannelVideoReport.org_id == org.id)
    if status is not None:
        statement = statement.where(ChannelVideoReport.status == status)
    statement = statement.order_by(ChannelVideoReport.creation_date.desc())

    # Paginated in Phase 9B. 9A finding F2 named this queue as the concrete
    # casualty of the (still deferred) missing rate limit on reporting — an
    # unbounded queue degrades exactly when report volume spikes. The
    # org_id predicate and the admin gate both run ahead of the window, so
    # cross-org isolation is unaffected by paging.
    statement = statement.offset((page - 1) * limit).limit(limit)

    rows = (await db_session.execute(statement)).scalars().all()
    return [_to_read(r) for r in rows]


async def resolve_channel_video_report(
    request: Request,
    org_id: int,
    report_uuid: str,
    data: ChannelVideoReportStatusUpdate,
    current_user: Union[PublicUser, AnonymousUser],
    db_session: AsyncSession,
) -> ChannelVideoReportRead:
    org = await _get_org_or_404(org_id, db_session)
    await _require_channel_admin(current_user, org.id, db_session)

    report = await _get_report_or_404(org.id, report_uuid, db_session)

    if data.status not in ALLOWED_REPORT_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid report status")

    report.status = data.status
    db_session.add(report)
    await db_session.commit()
    await db_session.refresh(report)
    return _to_read(report)
