"""
Service-layer tests for ChannelVideoReport (Phase 8A).

Mirrors test_channel_video_saves_service.py's structure (auth/visibility) and
test_channel_video_comments_service.py's content-validation style, adapted
for a report: one open report per (video, reporter) — a repeat report from
the same user is idempotent, not a second row — see
db/channel_video_reports.py and docs/ARCHITECTURE.md § "Trust & Moderation
(Phase 8A)".
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.channel_video_reports import ChannelVideoReport
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.user_organizations import UserOrganization
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)
from src.services.orgs.channel_video_reports import (
    ALLOWED_REPORT_REASONS,
    ALLOWED_REPORT_STATUSES,
    MAX_REPORT_DETAILS_LENGTH,
    ChannelVideoReportCreate,
    ChannelVideoReportStatusUpdate,
    create_channel_video_report,
    list_channel_video_reports,
    resolve_channel_video_report,
)

# db, org, other_org, admin_user, regular_user, anonymous_user, course are
# provided by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def activity(db, org, course):
    """A hosted-video Activity in the test org, ready to post to the channel."""
    a = Activity(
        name="Intro Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_report_1",
        org_id=org.id,
        course_id=course.id,
        content={"filename": "video.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest.fixture
async def published_video(db, org, admin_user, activity):
    """A published, publicly-visible ChannelVideo — reportable by anyone."""
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Intro Video"),
    )
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )


@pytest.fixture
async def draft_video(db, org, admin_user, activity):
    """An unpublished ChannelVideo — only visible to this channel's admin."""
    return await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Unpublished Draft"),
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_report_persists_and_returns_it(db, org, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM", details="Looks like spam"),
        current_user=regular_user, db_session=db,
    )

    assert report.reason == "SPAM"
    assert report.details == "Looks like spam"
    assert report.status == "OPEN"
    assert report.channelvideo_id == published_video.id

    row = (
        await db.execute(
            select(ChannelVideoReport).where(ChannelVideoReport.reporter_id == regular_user.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.channelvideo_id == published_video.id
    assert row.org_id == org.id
    assert row.status == "OPEN"


@pytest.mark.asyncio
async def test_create_report_allows_missing_details(db, org, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="OTHER"),
        current_user=regular_user, db_session=db,
    )
    assert report.details is None


@pytest.mark.asyncio
async def test_create_report_rejects_anonymous_user(db, org, anonymous_user, published_video):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await create_channel_video_report(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            data=ChannelVideoReportCreate(reason="SPAM"),
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_create_report_rejects_invalid_reason(db, org, regular_user, published_video):
    with pytest.raises(HTTPException, match="Invalid report reason") as exc:
        await create_channel_video_report(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            data=ChannelVideoReportCreate(reason="NOT_A_REAL_REASON"),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_report_rejects_details_over_max_length(db, org, regular_user, published_video):
    with pytest.raises(HTTPException, match="Report details are too long") as exc:
        await create_channel_video_report(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            data=ChannelVideoReportCreate(reason="SPAM", details="x" * (MAX_REPORT_DETAILS_LENGTH + 1)),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_report_rejects_non_admin_on_draft_video(db, org, regular_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await create_channel_video_report(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            data=ChannelVideoReportCreate(reason="SPAM"),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_create_report_rejects_missing_channel_video(db, org, regular_user):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await create_channel_video_report(
            request=None, org_id=org.id, channelvideo_id=999999,
            data=ChannelVideoReportCreate(reason="SPAM"),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_report_rejects_video_from_a_different_organization(
    db, other_org, regular_user, published_video
):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await create_channel_video_report(
            request=None, org_id=other_org.id, channelvideo_id=published_video.id,
            data=ChannelVideoReportCreate(reason="SPAM"),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Idempotency / isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_repeat_report_by_same_user_is_idempotent(db, org, regular_user, published_video):
    first = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )
    second = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="INAPPROPRIATE"),
        current_user=regular_user, db_session=db,
    )

    assert second.report_uuid == first.report_uuid

    rows = (
        await db.execute(
            select(ChannelVideoReport).where(
                ChannelVideoReport.channelvideo_id == published_video.id,
                ChannelVideoReport.reporter_id == regular_user.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_different_users_can_each_report_the_same_video(
    db, org, admin_user, regular_user, published_video
):
    await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=admin_user, db_session=db,
    )
    await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="MISINFORMATION"),
        current_user=regular_user, db_session=db,
    )

    rows = (
        await db.execute(
            select(ChannelVideoReport).where(ChannelVideoReport.channelvideo_id == published_video.id)
        )
    ).scalars().all()
    assert len(rows) == 2


def test_allowed_reasons_are_a_fixed_set():
    assert ALLOWED_REPORT_REASONS == {
        "SPAM", "INAPPROPRIATE", "MISINFORMATION", "COPYRIGHT", "OTHER",
    }


# ---------------------------------------------------------------------------
# List (Phase 8B — admin review queue)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_reports_returns_reports_for_this_org(
    db, org, admin_user, regular_user, published_video
):
    await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )

    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
    )

    assert len(reports) == 1
    assert reports[0].channelvideo_id == published_video.id
    assert reports[0].status == "OPEN"


@pytest.mark.asyncio
async def test_list_reports_orders_newest_first(db, org, admin_user, regular_user, published_video):
    first = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=admin_user, db_session=db,
    )
    second = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="OTHER"),
        current_user=regular_user, db_session=db,
    )

    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
    )

    assert [r.report_uuid for r in reports] == [second.report_uuid, first.report_uuid]


@pytest.mark.asyncio
async def test_list_reports_filters_by_status(db, org, admin_user, regular_user, published_video):
    open_report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=admin_user, db_session=db,
    )
    resolved_report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="OTHER"),
        current_user=regular_user, db_session=db,
    )
    await resolve_channel_video_report(
        request=None, org_id=org.id, report_uuid=resolved_report.report_uuid,
        data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
        current_user=admin_user, db_session=db,
    )

    open_only = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, status="OPEN",
    )
    assert [r.report_uuid for r in open_only] == [open_report.report_uuid]

    resolved_only = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, status="RESOLVED",
    )
    assert [r.report_uuid for r in resolved_only] == [resolved_report.report_uuid]


@pytest.mark.asyncio
async def test_list_reports_only_returns_this_org(
    db, org, other_org, admin_user, admin_role, regular_user, published_video
):
    await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )
    # Make admin_user an admin of other_org too, so the 403 auth guard isn't
    # what's producing the empty result — this proves the query itself is
    # scoped to org_id, not just that cross-org access is blocked (that's
    # already covered by the *_rejects_non_admin/cross_org tests).
    db.add(UserOrganization(
        user_id=admin_user.id, org_id=other_org.id, role_id=admin_role.id,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    await db.commit()

    reports = await list_channel_video_reports(
        request=None, org_id=other_org.id, current_user=admin_user, db_session=db,
    )
    assert reports == []


@pytest.mark.asyncio
async def test_list_reports_rejects_non_admin(db, org, regular_user, published_video):
    with pytest.raises(HTTPException) as exc:
        await list_channel_video_reports(
            request=None, org_id=org.id, current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_reports_rejects_anonymous(db, org, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await list_channel_video_reports(
            request=None, org_id=org.id, current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# Resolve/dismiss (Phase 8B)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resolve_report_updates_status(db, org, admin_user, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )

    updated = await resolve_channel_video_report(
        request=None, org_id=org.id, report_uuid=report.report_uuid,
        data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
        current_user=admin_user, db_session=db,
    )

    assert updated.status == "RESOLVED"
    row = (
        await db.execute(
            select(ChannelVideoReport).where(ChannelVideoReport.report_uuid == report.report_uuid)
        )
    ).scalars().first()
    assert row.status == "RESOLVED"


@pytest.mark.asyncio
async def test_dismiss_report_updates_status(db, org, admin_user, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="OTHER"),
        current_user=regular_user, db_session=db,
    )

    updated = await resolve_channel_video_report(
        request=None, org_id=org.id, report_uuid=report.report_uuid,
        data=ChannelVideoReportStatusUpdate(status="DISMISSED"),
        current_user=admin_user, db_session=db,
    )

    assert updated.status == "DISMISSED"


@pytest.mark.asyncio
async def test_resolve_report_rejects_invalid_status(db, org, admin_user, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="Invalid report status") as exc:
        await resolve_channel_video_report(
            request=None, org_id=org.id, report_uuid=report.report_uuid,
            data=ChannelVideoReportStatusUpdate(status="OPEN"),
            current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_resolve_report_rejects_missing_report(db, org, admin_user):
    with pytest.raises(HTTPException, match="Report not found") as exc:
        await resolve_channel_video_report(
            request=None, org_id=org.id, report_uuid="channelvideoreport_missing",
            data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
            current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_report_rejects_cross_org_report(
    db, org, other_org, admin_user, admin_role, regular_user, published_video
):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )
    # Admin of other_org too, so the 404 below proves the report lookup is
    # scoped to org_id — not just that cross-org access is blocked by the
    # auth guard (already covered by *_rejects_non_admin above).
    db.add(UserOrganization(
        user_id=admin_user.id, org_id=other_org.id, role_id=admin_role.id,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    await db.commit()

    with pytest.raises(HTTPException, match="Report not found") as exc:
        await resolve_channel_video_report(
            request=None, org_id=other_org.id, report_uuid=report.report_uuid,
            data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
            current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_report_rejects_non_admin(db, org, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await resolve_channel_video_report(
            request=None, org_id=org.id, report_uuid=report.report_uuid,
            data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_report_rejects_anonymous(db, org, anonymous_user, admin_user, regular_user, published_video):
    report = await create_channel_video_report(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        data=ChannelVideoReportCreate(reason="SPAM"),
        current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException) as exc:
        await resolve_channel_video_report(
            request=None, org_id=org.id, report_uuid=report.report_uuid,
            data=ChannelVideoReportStatusUpdate(status="RESOLVED"),
            current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


def test_allowed_statuses_are_a_fixed_set():
    assert ALLOWED_REPORT_STATUSES == {"RESOLVED", "DISMISSED"}


# ── Pagination (Phase 9B) ───────────────────────────────────────────────────
# 9B-1: the moderation queue was unpaginated, which 9A finding F2 named as the
# concrete impact of the (still deferred) missing rate limit on reporting.
# Rows are inserted directly here because the (channelvideo_id, reporter_id)
# unique constraint deliberately caps one report per user per video, and these
# tests need many rows with deterministic ordering.


async def _reports_newest_first(db, org, published_video, count):
    made = []
    for i in range(count):
        r = ChannelVideoReport(
            report_uuid=f"channelvideoreport_pg{i}",
            channelvideo_id=published_video.id,
            reporter_id=1000 + i,
            org_id=org.id,
            reason="SPAM",
            details=None,
            status="OPEN",
            creation_date=f"2026-04-{i + 1:02d} 00:00:00.000000",
        )
        db.add(r)
        made.append(r)
    await db.commit()
    return list(reversed(made))


@pytest.mark.asyncio
async def test_list_reports_respects_limit(db, org, admin_user, published_video):
    newest_first = await _reports_newest_first(db, org, published_video, 5)
    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, page=1, limit=2,
    )
    assert [r.report_uuid for r in reports] == [r.report_uuid for r in newest_first[:2]]


@pytest.mark.asyncio
async def test_list_reports_second_page_offsets(db, org, admin_user, published_video):
    newest_first = await _reports_newest_first(db, org, published_video, 5)
    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, page=2, limit=2,
    )
    assert [r.report_uuid for r in reports] == [r.report_uuid for r in newest_first[2:4]]


@pytest.mark.asyncio
async def test_list_reports_page_beyond_end_is_empty(db, org, admin_user, published_video):
    await _reports_newest_first(db, org, published_video, 3)
    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, page=99, limit=10,
    )
    assert reports == []


@pytest.mark.asyncio
async def test_list_reports_pagination_still_admin_only(
    db, org, regular_user, anonymous_user, published_video
):
    """SECURITY (9A): the admin gate runs before paging, not after."""
    with pytest.raises(HTTPException) as exc:
        await list_channel_video_reports(
            request=None, org_id=org.id, current_user=regular_user,
            db_session=db, page=1, limit=10,
        )
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await list_channel_video_reports(
            request=None, org_id=org.id, current_user=anonymous_user,
            db_session=db, page=1, limit=10,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_list_reports_pagination_composes_with_status_filter(
    db, org, admin_user, published_video
):
    await _reports_newest_first(db, org, published_video, 3)
    resolved = ChannelVideoReport(
        report_uuid="channelvideoreport_pgres",
        channelvideo_id=published_video.id,
        reporter_id=2000,
        org_id=org.id,
        reason="OTHER",
        details=None,
        status="RESOLVED",
        creation_date="2026-04-09 00:00:00.000000",
    )
    db.add(resolved)
    await db.commit()

    open_page = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        status="OPEN", page=1, limit=2,
    )
    assert len(open_page) == 2
    assert all(r.status == "OPEN" for r in open_page)


@pytest.mark.asyncio
async def test_list_reports_pagination_stays_org_scoped(
    db, org, other_org, admin_user, published_video
):
    """SECURITY (9A): cross-org isolation must survive paging — another org's
    report never appears in this org's queue."""
    await _reports_newest_first(db, org, published_video, 2)
    db.add(ChannelVideoReport(
        report_uuid="channelvideoreport_otherorg",
        channelvideo_id=published_video.id,
        reporter_id=3000,
        org_id=other_org.id,
        reason="SPAM",
        details=None,
        status="OPEN",
        creation_date="2026-04-20 00:00:00.000000",
    ))
    await db.commit()

    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, page=1, limit=50,
    )
    assert all(r.report_uuid != "channelvideoreport_otherorg" for r in reports)
    assert len(reports) == 2


@pytest.mark.asyncio
async def test_list_reports_default_call_still_works(db, org, admin_user, published_video):
    """The Phase 8B call signature must keep working."""
    await _reports_newest_first(db, org, published_video, 2)
    reports = await list_channel_video_reports(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
    )
    assert len(reports) == 2
