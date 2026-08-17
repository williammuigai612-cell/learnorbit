"""
Model/constraint tests for ChannelVideo (Phase 2A/2B).

ChannelVideo is a thin discovery/metadata layer over the existing Activity
video infrastructure — see docs/ARCHITECTURE.md § "Videos (Phase 2A)". These
tests cover the model in isolation (no service/router layer exists yet):
creation + defaults, the activity_id uniqueness constraint, and the
org_id/activity_id CASCADE configuration.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from src.db.channel_videos import ChannelVideo
from src.db.courses.activities import (
    Activity,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)

# engine, db, org, course, chapter are provided by conftest.py as async
# fixtures backed by an async SQLite engine (see src/tests/courses/test_course_tree.py).


@pytest.fixture
async def activity(db, org, course):
    """A minimal hosted-video Activity to attach a ChannelVideo to."""
    a = Activity(
        name="Intro to Algebra",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_video_1",
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


@pytest.mark.asyncio
async def test_creates_with_defaults_and_educational_metadata(db, org, activity):
    video = ChannelVideo(
        channelvideo_uuid="channelvideo_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Intro to Algebra",
        subject="Mathematics",
        topic="Algebra",
        level="Form 2",
        institution_context="KCSE",
        resource_type="lesson",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)

    assert video.id is not None
    assert video.published is False
    assert video.visibility == "public"
    assert video.content_format == "long"
    assert video.description is None
    assert video.thumbnail_image is None
    assert video.subject == "Mathematics"
    assert video.resource_type == "lesson"

    row = (
        await db.execute(select(ChannelVideo).where(ChannelVideo.activity_id == activity.id))
    ).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_content_format_defaults_to_long(db, org, activity):
    """Phase 3A: `content_format` distinguishes Shorts from long-form video.
    Every video created without specifying it — including all pre-Phase-3A
    rows via the migration's server_default — must be treated as long-form."""
    video = ChannelVideo(
        channelvideo_uuid="channelvideo_default_format",
        org_id=org.id,
        activity_id=activity.id,
        title="Untouched by Phase 3",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)

    assert video.content_format == "long"


@pytest.mark.asyncio
async def test_content_format_short_persists(db, org, activity):
    video = ChannelVideo(
        channelvideo_uuid="channelvideo_short",
        org_id=org.id,
        activity_id=activity.id,
        title="A Short",
        content_format="short",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)

    assert video.content_format == "short"

    row = (
        await db.execute(select(ChannelVideo).where(ChannelVideo.id == video.id))
    ).scalars().first()
    assert row.content_format == "short"


@pytest.mark.asyncio
async def test_activity_id_unique_constraint_prevents_duplicate_post(db, org, activity):
    first = ChannelVideo(
        channelvideo_uuid="channelvideo_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Intro to Algebra",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(first)
    await db.commit()

    duplicate = ChannelVideo(
        channelvideo_uuid="channelvideo_2",
        org_id=org.id,
        activity_id=activity.id,
        title="Intro to Algebra (duplicate post)",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        await db.commit()


def test_org_and_activity_foreign_keys_configured_for_cascade_delete():
    """Dialect-independent check that both FKs are wired to CASCADE, per the
    Phase 2A decision (a ChannelVideo can never outlive its channel or its
    underlying video, however the deletion happens)."""
    table = ChannelVideo.__table__

    org_fks = list(table.columns["org_id"].foreign_keys)
    assert len(org_fks) == 1
    assert org_fks[0].column.table.name == "organization"
    assert org_fks[0].ondelete == "CASCADE"

    activity_fks = list(table.columns["activity_id"].foreign_keys)
    assert len(activity_fks) == 1
    assert activity_fks[0].column.table.name == "activity"
    assert activity_fks[0].ondelete == "CASCADE"

    assert table.columns["activity_id"].unique is True or any(
        set(c.columns.keys()) == {"activity_id"} for c in table.constraints if hasattr(c, "columns")
    )


@pytest.mark.asyncio
async def test_deleting_activity_cascades_to_channel_video(db, org, activity):
    # SQLite doesn't enforce FK constraints by default; opt in for this test
    # so ON DELETE CASCADE actually runs (scoped to this test's own in-memory
    # engine/connection — does not affect any other test).
    await db.execute(text("PRAGMA foreign_keys=ON"))

    video = ChannelVideo(
        channelvideo_uuid="channelvideo_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Intro to Algebra",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(video)
    await db.commit()

    await db.delete(activity)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelVideo).where(ChannelVideo.activity_id == activity.id))
    ).scalars().first()
    assert remaining is None


@pytest.mark.asyncio
async def test_deleting_organization_cascades_to_channel_video(db, org, activity):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    video = ChannelVideo(
        channelvideo_uuid="channelvideo_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Intro to Algebra",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(video)
    await db.commit()
    video_id = video.id

    await db.delete(org)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelVideo).where(ChannelVideo.id == video_id))
    ).scalars().first()
    assert remaining is None
