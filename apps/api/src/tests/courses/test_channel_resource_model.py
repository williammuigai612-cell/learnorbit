"""
Model/constraint tests for ChannelResource (Phase 5B).

ChannelResource is a thin discovery/metadata layer over the existing
Activity document infrastructure — see docs/ARCHITECTURE.md § "Academic
Library (Phase 5A)". These tests cover the model in isolation (no
service/router layer exercised here): creation + defaults, the activity_id
uniqueness constraint, and the org_id/activity_id CASCADE configuration.
Mirrors test_channel_video_model.py.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from src.db.channel_resources import ChannelResource
from src.db.courses.activities import (
    Activity,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)

# engine, db, org, course, chapter are provided by conftest.py as async
# fixtures backed by an async SQLite engine.


@pytest.fixture
async def activity(db, org, course):
    """A minimal PDF document Activity to attach a ChannelResource to."""
    a = Activity(
        name="Form 2 Algebra Past Paper",
        activity_type=ActivityTypeEnum.TYPE_DOCUMENT,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DOCUMENT_PDF,
        activity_uuid="activity_document_1",
        org_id=org.id,
        course_id=course.id,
        content={"filename": "paper.pdf"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest.mark.asyncio
async def test_creates_with_defaults_and_educational_metadata(db, org, activity):
    resource = ChannelResource(
        channelresource_uuid="channelresource_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Form 2 Algebra Past Paper",
        subject="Mathematics",
        topic="Algebra",
        level="Form 2",
        institution_context="KCSE",
        resource_type="past_paper",
        year="2023",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    assert resource.id is not None
    assert resource.published is False
    assert resource.visibility == "public"
    assert resource.description is None
    assert resource.subject == "Mathematics"
    assert resource.resource_type == "past_paper"
    assert resource.year == "2023"

    row = (
        await db.execute(select(ChannelResource).where(ChannelResource.activity_id == activity.id))
    ).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_year_defaults_to_none(db, org, activity):
    resource = ChannelResource(
        channelresource_uuid="channelresource_no_year",
        org_id=org.id,
        activity_id=activity.id,
        title="Undated resource",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    assert resource.year is None


@pytest.mark.asyncio
async def test_activity_id_unique_constraint_prevents_duplicate_post(db, org, activity):
    first = ChannelResource(
        channelresource_uuid="channelresource_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Form 2 Algebra Past Paper",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(first)
    await db.commit()

    duplicate = ChannelResource(
        channelresource_uuid="channelresource_2",
        org_id=org.id,
        activity_id=activity.id,
        title="Form 2 Algebra Past Paper (duplicate post)",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        await db.commit()


def test_org_and_activity_foreign_keys_configured_for_cascade_delete():
    """Dialect-independent check that both FKs are wired to CASCADE, per the
    Phase 5A decision (a ChannelResource can never outlive its channel or its
    underlying document, however the deletion happens)."""
    table = ChannelResource.__table__

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
async def test_deleting_activity_cascades_to_channel_resource(db, org, activity):
    # SQLite doesn't enforce FK constraints by default; opt in for this test
    # so ON DELETE CASCADE actually runs (scoped to this test's own in-memory
    # engine/connection — does not affect any other test).
    await db.execute(text("PRAGMA foreign_keys=ON"))

    resource = ChannelResource(
        channelresource_uuid="channelresource_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Form 2 Algebra Past Paper",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(resource)
    await db.commit()

    await db.delete(activity)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelResource).where(ChannelResource.activity_id == activity.id))
    ).scalars().first()
    assert remaining is None


@pytest.mark.asyncio
async def test_deleting_organization_cascades_to_channel_resource(db, org, activity):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    resource = ChannelResource(
        channelresource_uuid="channelresource_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Form 2 Algebra Past Paper",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(resource)
    await db.commit()
    resource_id = resource.id

    await db.delete(org)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelResource).where(ChannelResource.id == resource_id))
    ).scalars().first()
    assert remaining is None
