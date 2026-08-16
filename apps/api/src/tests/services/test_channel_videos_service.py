"""
Service-layer tests for ChannelVideo (Phase 2C).

Exercises the service functions directly (matches the style of
test_organization_follows_service.py) rather than through the router/HTTP
layer, covering: authenticated creation, ownership, unauthorized creation,
listing (visibility + ordering + metadata filtering), get access rules,
publish/unpublish authorization, deletion authorization, and cross-org access
prevention.
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.channel_videos import ChannelVideo
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.courses import Course
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    ChannelVideoUpdate,
    create_channel_video,
    delete_channel_video,
    get_channel_video,
    list_channel_videos,
    set_channel_video_published,
    update_channel_video,
)

# db, org, other_org, admin_user, regular_user, anonymous_user, course, chapter
# are provided by conftest.py as async fixtures backed by an async SQLite engine.


@pytest.fixture
async def activity(db, org, course):
    """A hosted-video Activity in the test org, ready to post to the channel."""
    a = Activity(
        name="Intro Video",
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


@pytest.fixture
async def other_org_course(db, other_org):
    c = Course(
        id=2,
        name="Other Org Course",
        description="",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=other_org.id,
        course_uuid="course_other",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest.fixture
async def other_org_activity(db, other_org, other_org_course):
    a = Activity(
        name="Other Org Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_video_other",
        org_id=other_org.id,
        course_id=other_org_course.id,
        content={"filename": "other.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest.fixture
async def other_org_admin_user(db, other_org):
    """Admin of `other_org` — used to prove admin rights don't cross channels."""
    u = User(
        id=3,
        username="other_admin",
        first_name="Other",
        last_name="Admin",
        email="other_admin@test.com",
        password="hashed_password",
        user_uuid="user_other_admin",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    db.add(UserOrganization(
        user_id=u.id,
        org_id=other_org.id,
        role_id=1,  # ADMIN_ROLE_ID
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    ))
    await db.commit()
    return PublicUser(
        id=u.id, username=u.username, first_name=u.first_name,
        last_name=u.last_name, email=u.email, user_uuid=u.user_uuid,
    )


# ── Creation ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_create_channel_video(db, org, admin_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Intro Video", subject="Mathematics"),
    )

    assert video.org_id == org.id
    assert video.activity_id == activity.id
    assert video.published is False
    assert video.visibility == "public"

    row = (await db.execute(
        select(ChannelVideo).where(ChannelVideo.id == video.id)
    )).scalars().first()
    assert row is not None
    assert row.org_id == org.id


@pytest.mark.asyncio
async def test_regular_member_cannot_create_channel_video(db, org, regular_user, activity):
    with pytest.raises(HTTPException) as exc:
        await create_channel_video(
            request=None, org_id=org.id, current_user=regular_user, db_session=db,
            data=ChannelVideoCreate(activity_id=activity.id, title="Intro Video"),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_anonymous_cannot_create_channel_video(db, org, anonymous_user, activity):
    with pytest.raises(HTTPException) as exc:
        await create_channel_video(
            request=None, org_id=org.id, current_user=anonymous_user, db_session=db,
            data=ChannelVideoCreate(activity_id=activity.id, title="Intro Video"),
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_cannot_create_channel_video_from_another_orgs_activity(
    db, org, admin_user, other_org_activity
):
    with pytest.raises(HTTPException) as exc:
        await create_channel_video(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=ChannelVideoCreate(activity_id=other_org_activity.id, title="Stolen"),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_cannot_post_the_same_activity_to_a_channel_twice(db, org, admin_user, activity):
    await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="First post"),
    )
    with pytest.raises(HTTPException) as exc:
        await create_channel_video(
            request=None, org_id=org.id, current_user=admin_user, db_session=db,
            data=ChannelVideoCreate(activity_id=activity.id, title="Duplicate post"),
        )
    assert exc.value.status_code == 409


# ── Listing: visibility, ordering, metadata filtering ──────────────────────

@pytest.mark.asyncio
async def test_list_hides_unpublished_from_anonymous(db, org, admin_user, anonymous_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Draft"),
    )
    assert await list_channel_videos(
        request=None, org_id=org.id, current_user=anonymous_user, db_session=db
    ) == []

    await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )
    videos = await list_channel_videos(request=None, org_id=org.id, current_user=anonymous_user, db_session=db)
    assert [v.id for v in videos] == [video.id]


@pytest.mark.asyncio
async def test_list_shows_drafts_to_admin(db, org, admin_user, activity):
    await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Draft"),
    )
    videos = await list_channel_videos(request=None, org_id=org.id, current_user=admin_user, db_session=db)
    assert len(videos) == 1


async def _make_published_video(db, org, admin_user, course, key, **fields):
    a = Activity(
        name=f"Video {key}",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid=f"activity_{key}",
        org_id=org.id,
        course_id=course.id,
        content={"filename": f"{key}.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=a.id, title=f"Video {key}", **fields),
    )
    return await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )


@pytest.mark.asyncio
async def test_list_orders_newest_first(db, org, admin_user, course):
    v0 = await _make_published_video(db, org, admin_user, course, "0")
    v1 = await _make_published_video(db, org, admin_user, course, "1")
    v2 = await _make_published_video(db, org, admin_user, course, "2")

    # Force distinct, known-order creation_date values directly — avoids
    # flakiness from same-microsecond datetime.now() collisions.
    for i, video_id in enumerate((v0.id, v1.id, v2.id)):
        row = (await db.execute(select(ChannelVideo).where(ChannelVideo.id == video_id))).scalars().first()
        row.creation_date = f"2026-01-0{i + 1} 00:00:00.000000"
        db.add(row)
    await db.commit()

    videos = await list_channel_videos(request=None, org_id=org.id, current_user=admin_user, db_session=db)
    assert [v.id for v in videos] == [v2.id, v1.id, v0.id]


@pytest.mark.asyncio
async def test_list_filters_by_educational_metadata(db, org, admin_user, course):
    await _make_published_video(
        db, org, admin_user, course, "algebra", subject="Mathematics", topic="Algebra", level="Form 2"
    )
    await _make_published_video(
        db, org, admin_user, course, "geometry", subject="Mathematics", topic="Geometry", level="Form 2"
    )
    await _make_published_video(
        db, org, admin_user, course, "biology", subject="Biology", topic="Plants", level="Form 1"
    )

    math_videos = await list_channel_videos(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, subject="Mathematics"
    )
    assert {v.topic for v in math_videos} == {"Algebra", "Geometry"}

    algebra_only = await list_channel_videos(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        subject="Mathematics", topic="Algebra",
    )
    assert [v.topic for v in algebra_only] == ["Algebra"]

    form1_only = await list_channel_videos(
        request=None, org_id=org.id, current_user=admin_user, db_session=db, level="Form 1"
    )
    assert [v.subject for v in form1_only] == ["Biology"]


# ── Get: visibility rules ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_unpublished_video_requires_admin(db, org, admin_user, regular_user, anonymous_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Draft"),
    )

    for viewer in (anonymous_user, regular_user):
        with pytest.raises(HTTPException) as exc:
            await get_channel_video(
                request=None, org_id=org.id, channelvideo_id=video.id, current_user=viewer, db_session=db
            )
        assert exc.value.status_code == 403

    result = await get_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user, db_session=db
    )
    assert result.id == video.id


@pytest.mark.asyncio
async def test_get_published_public_video_is_publicly_accessible(db, org, admin_user, anonymous_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Live"),
    )
    await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )
    result = await get_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=anonymous_user, db_session=db
    )
    assert result.id == video.id


# ── Publish/unpublish authorization ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_unpublish_requires_admin(db, org, admin_user, regular_user, anonymous_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Video"),
    )

    with pytest.raises(HTTPException) as exc:
        await set_channel_video_published(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=regular_user,
            db_session=db, data=ChannelVideoPublish(published=True),
        )
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await set_channel_video_published(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=anonymous_user,
            db_session=db, data=ChannelVideoPublish(published=True),
        )
    assert exc.value.status_code == 401

    updated = await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=True),
    )
    assert updated.published is True

    updated = await set_channel_video_published(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoPublish(published=False),
    )
    assert updated.published is False


# ── Deletion authorization + asymmetry with the underlying Activity ────────

@pytest.mark.asyncio
async def test_delete_requires_admin_and_leaves_activity_intact(db, org, admin_user, regular_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Video"),
    )

    with pytest.raises(HTTPException) as exc:
        await delete_channel_video(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=regular_user, db_session=db
        )
    assert exc.value.status_code == 403

    await delete_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user, db_session=db
    )

    remaining = (await db.execute(
        select(ChannelVideo).where(ChannelVideo.id == video.id)
    )).scalars().first()
    assert remaining is None

    # Per docs/ARCHITECTURE.md § "Videos (Phase 2A)": deleting the channel
    # post never deletes the underlying Activity.
    still_there = (await db.execute(
        select(Activity).where(Activity.id == activity.id)
    )).scalars().first()
    assert still_there is not None


# ── Metadata update authorization + behavior ────────────────────────────────

@pytest.mark.asyncio
async def test_admin_can_update_channel_video_metadata(db, org, admin_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Original Title", subject="Mathematics"),
    )

    updated = await update_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db,
        data=ChannelVideoUpdate(
            title="Updated Title",
            description="Now with a description",
            subject="Biology",
            topic="Cells",
            level="Form 3",
            institution_context="KCSE",
            resource_type="lesson",
        ),
    )

    assert updated.title == "Updated Title"
    assert updated.description == "Now with a description"
    assert updated.subject == "Biology"
    assert updated.topic == "Cells"
    assert updated.level == "Form 3"
    assert updated.institution_context == "KCSE"
    assert updated.resource_type == "lesson"

    row = (await db.execute(
        select(ChannelVideo).where(ChannelVideo.id == video.id)
    )).scalars().first()
    assert row.title == "Updated Title"
    assert row.update_date != row.creation_date


@pytest.mark.asyncio
async def test_partial_update_leaves_unspecified_fields_unchanged(db, org, admin_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(
            activity_id=activity.id, title="Original Title",
            description="Original description", subject="Mathematics", topic="Algebra",
        ),
    )

    updated = await update_channel_video(
        request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
        db_session=db, data=ChannelVideoUpdate(subject="Physics"),
    )

    assert updated.subject == "Physics"
    assert updated.title == "Original Title"
    assert updated.description == "Original description"
    assert updated.topic == "Algebra"


@pytest.mark.asyncio
async def test_update_rejects_blank_title(db, org, admin_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Original Title"),
    )

    with pytest.raises(HTTPException) as exc:
        await update_channel_video(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=admin_user,
            db_session=db, data=ChannelVideoUpdate(title="   "),
        )
    assert exc.value.status_code == 422

    row = (await db.execute(
        select(ChannelVideo).where(ChannelVideo.id == video.id)
    )).scalars().first()
    assert row.title == "Original Title"


@pytest.mark.asyncio
async def test_regular_member_cannot_update_channel_video(db, org, admin_user, regular_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Video"),
    )

    with pytest.raises(HTTPException) as exc:
        await update_channel_video(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=regular_user,
            db_session=db, data=ChannelVideoUpdate(title="Hijacked"),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_anonymous_cannot_update_channel_video(db, org, admin_user, anonymous_user, activity):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Video"),
    )

    with pytest.raises(HTTPException) as exc:
        await update_channel_video(
            request=None, org_id=org.id, channelvideo_id=video.id, current_user=anonymous_user,
            db_session=db, data=ChannelVideoUpdate(title="Hijacked"),
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_admin_of_another_org_cannot_update_this_channels_video(
    db, org, other_org, admin_user, other_org_admin_user, activity
):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Video"),
    )

    with pytest.raises(HTTPException) as exc:
        await update_channel_video(
            request=None, org_id=other_org.id, channelvideo_id=video.id,
            current_user=other_org_admin_user, db_session=db,
            data=ChannelVideoUpdate(title="Stolen"),
        )
    assert exc.value.status_code == 404

    row = (await db.execute(
        select(ChannelVideo).where(ChannelVideo.id == video.id)
    )).scalars().first()
    assert row.title == "Video"


# ── Cross-organization access prevention ────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_of_another_org_cannot_manage_this_channels_video(
    db, org, other_org, admin_user, other_org_admin_user, activity
):
    video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=activity.id, title="Video"),
    )

    # Being an admin of a DIFFERENT org must not grant access — the wrong
    # org_id in the path 404s rather than leaking existence via a 403.
    with pytest.raises(HTTPException) as exc:
        await get_channel_video(
            request=None, org_id=other_org.id, channelvideo_id=video.id,
            current_user=other_org_admin_user, db_session=db,
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await set_channel_video_published(
            request=None, org_id=other_org.id, channelvideo_id=video.id,
            current_user=other_org_admin_user, db_session=db,
            data=ChannelVideoPublish(published=True),
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await delete_channel_video(
            request=None, org_id=other_org.id, channelvideo_id=video.id,
            current_user=other_org_admin_user, db_session=db,
        )
    assert exc.value.status_code == 404

    # The video is untouched.
    row = (await db.execute(
        select(ChannelVideo).where(ChannelVideo.id == video.id)
    )).scalars().first()
    assert row is not None
