"""
Service-layer tests for ChannelVideoComment (Phase 4C).

Exercises the service functions directly (matches the style of
test_channel_video_likes_service.py): authenticated create/list/update/delete,
ownership enforcement, content validation, and reuse of the existing
ChannelVideo visibility rule (a video's comments can only be created/read by a
viewer who could actually watch it).
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.channel_video_comments import ChannelVideoComment
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.services.orgs.channel_videos import (
    ChannelVideoCreate,
    ChannelVideoPublish,
    create_channel_video,
    set_channel_video_published,
)
from src.services.orgs.channel_video_comments import (
    MAX_COMMENT_LENGTH,
    create_channel_video_comment,
    delete_channel_video_comment,
    list_channel_video_comments,
    update_channel_video_comment,
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
        activity_uuid="activity_comment_1",
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
    """A published, publicly-visible ChannelVideo — commentable by anyone."""
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
async def test_create_comment_persists_and_returns_it(db, org, regular_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Great explanation, thank you!", current_user=regular_user, db_session=db,
    )

    assert comment.content == "Great explanation, thank you!"
    assert comment.channelvideo_id == published_video.id
    assert comment.author is not None
    assert comment.author.id == regular_user.id

    row = (
        await db.execute(
            select(ChannelVideoComment).where(ChannelVideoComment.channelvideo_id == published_video.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.author_id == regular_user.id


@pytest.mark.asyncio
async def test_create_comment_rejects_anonymous_user(db, org, anonymous_user, published_video):
    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            content="Hello", current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_create_comment_rejects_non_admin_on_draft_video(db, org, regular_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            content="Hello", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_comment_on_own_unpublished_draft(db, org, admin_user, draft_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=draft_video.id,
        content="Preview note", current_user=admin_user, db_session=db,
    )
    assert comment.content == "Preview note"


@pytest.mark.asyncio
async def test_create_comment_rejects_missing_channel_video(db, org, regular_user):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=999999,
            content="Hello", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_comment_rejects_video_from_a_different_organization(
    db, other_org, regular_user, published_video
):
    with pytest.raises(HTTPException, match="Channel video not found") as exc:
        await create_channel_video_comment(
            request=None, org_id=other_org.id, channelvideo_id=published_video.id,
            content="Hello", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_comment_rejects_empty_content(db, org, regular_user, published_video):
    with pytest.raises(HTTPException, match="Comment cannot be empty") as exc:
        await create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            content="   ", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_create_comment_rejects_content_over_max_length(db, org, regular_user, published_video):
    with pytest.raises(HTTPException, match="Comment is too long") as exc:
        await create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            content="x" * (MAX_COMMENT_LENGTH + 1), current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 422


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_comments_returns_newest_first_with_author(
    db, org, regular_user, admin_user, published_video
):
    first = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="First comment", current_user=regular_user, db_session=db,
    )
    second = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Second comment", current_user=admin_user, db_session=db,
    )

    comments = await list_channel_video_comments(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db,
    )

    assert [c.comment_uuid for c in comments] == [second.comment_uuid, first.comment_uuid]
    assert comments[0].author.id == admin_user.id


@pytest.mark.asyncio
async def test_list_comments_allows_anonymous_on_public_video(
    db, org, anonymous_user, regular_user, published_video
):
    await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Hello", current_user=regular_user, db_session=db,
    )

    comments = await list_channel_video_comments(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=anonymous_user, db_session=db,
    )
    assert len(comments) == 1


@pytest.mark.asyncio
async def test_list_comments_rejects_non_admin_on_draft_video(db, org, regular_user, draft_video):
    with pytest.raises(HTTPException) as exc:
        await list_channel_video_comments(
            request=None, org_id=org.id, channelvideo_id=draft_video.id,
            current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_comments_respects_limit(db, org, regular_user, published_video):
    for i in range(3):
        await create_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            content=f"Comment {i}", current_user=regular_user, db_session=db,
        )

    comments = await list_channel_video_comments(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        current_user=regular_user, db_session=db, page=1, limit=2,
    )
    assert len(comments) == 2


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_author_can_update_own_comment(db, org, regular_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    updated = await update_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        comment_uuid=comment.comment_uuid, content="Edited", current_user=regular_user, db_session=db,
    )

    assert updated.content == "Edited"
    assert updated.update_date != updated.creation_date


@pytest.mark.asyncio
async def test_update_comment_rejects_non_author(db, org, regular_user, admin_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="You can only edit your own comments") as exc:
        await update_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid=comment.comment_uuid, content="Hijacked", current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_update_comment_rejects_anonymous(db, org, anonymous_user, regular_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await update_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid=comment.comment_uuid, content="Edited", current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_update_comment_rejects_empty_content(db, org, regular_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="Comment cannot be empty") as exc:
        await update_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid=comment.comment_uuid, content="   ", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_update_comment_rejects_missing_comment(db, org, regular_user, published_video):
    with pytest.raises(HTTPException, match="Comment not found") as exc:
        await update_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid="does_not_exist", content="Edited", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_comment_rejects_channelvideo_mismatch(
    db, org, course, admin_user, regular_user, published_video
):
    """A comment can't be edited by referencing it through a *different*
    video's id in the URL, even a real, accessible one — mirrors the like
    service's own-org-scoped-lookup test."""
    other_activity = Activity(
        name="Other Video",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_comment_mismatch",
        org_id=org.id,
        course_id=course.id,
        content={"filename": "other.mp4"},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(other_activity)
    await db.commit()
    await db.refresh(other_activity)

    other_video = await create_channel_video(
        request=None, org_id=org.id, current_user=admin_user, db_session=db,
        data=ChannelVideoCreate(activity_id=other_activity.id, title="Other Video"),
    )

    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="Comment not found") as exc:
        await update_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=other_video.id,
            comment_uuid=comment.comment_uuid, content="Edited", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_author_can_delete_own_comment(db, org, regular_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    await delete_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        comment_uuid=comment.comment_uuid, current_user=regular_user, db_session=db,
    )

    row = (
        await db.execute(
            select(ChannelVideoComment).where(ChannelVideoComment.comment_uuid == comment.comment_uuid)
        )
    ).scalars().first()
    assert row is None


@pytest.mark.asyncio
async def test_delete_comment_rejects_non_author(db, org, regular_user, admin_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="You can only delete your own comments") as exc:
        await delete_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid=comment.comment_uuid, current_user=admin_user, db_session=db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_comment_rejects_anonymous(db, org, anonymous_user, regular_user, published_video):
    comment = await create_channel_video_comment(
        request=None, org_id=org.id, channelvideo_id=published_video.id,
        content="Original", current_user=regular_user, db_session=db,
    )

    with pytest.raises(HTTPException, match="Authentication required") as exc:
        await delete_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid=comment.comment_uuid, current_user=anonymous_user, db_session=db,
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_delete_comment_rejects_missing_comment(db, org, regular_user, published_video):
    with pytest.raises(HTTPException, match="Comment not found") as exc:
        await delete_channel_video_comment(
            request=None, org_id=org.id, channelvideo_id=published_video.id,
            comment_uuid="does_not_exist", current_user=regular_user, db_session=db,
        )
    assert exc.value.status_code == 404
