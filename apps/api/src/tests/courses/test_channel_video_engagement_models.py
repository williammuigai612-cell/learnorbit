"""
Model/constraint tests for Phase 4A's engagement schema: ChannelVideoLike,
ChannelVideoSave, ChannelVideoComment, ChannelVideoShare.

No service or router layer exists yet (that's Phase 4B–4E) — these tests
cover the models in isolation: creation + defaults, uniqueness constraints
for Like/Save, repeatability for Comment/Share, and FK CASCADE configuration.
Style mirrors test_channel_video_model.py (Phase 2A/2B).
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from src.db.channel_videos import ChannelVideo
from src.db.channel_video_comments import ChannelVideoComment
from src.db.channel_video_likes import ChannelVideoLike
from src.db.channel_video_saves import ChannelVideoSave
from src.db.channel_video_shares import ChannelVideoShare
from src.db.courses.activities import ActivitySubTypeEnum, ActivityTypeEnum, Activity
from src.db.users import User

# engine, db, org, course, chapter are provided by conftest.py as async
# fixtures backed by an async SQLite engine (see src/tests/courses/test_course_tree.py).


@pytest.fixture
async def activity(db, org, course):
    """A minimal hosted-video Activity to attach a ChannelVideo to."""
    a = Activity(
        name="Intro to Algebra",
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid="activity_engagement_1",
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
async def channel_video(db, org, activity):
    """A published ChannelVideo for engagement rows to reference."""
    video = ChannelVideo(
        channelvideo_uuid="channelvideo_engagement_1",
        org_id=org.id,
        activity_id=activity.id,
        title="Intro to Algebra",
        published=True,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)
    return video


@pytest.fixture
async def user(db):
    u = User(
        username="engager",
        first_name="Engaged",
        last_name="User",
        email="engager@test.com",
        password="hashed_password",
        user_uuid="user_engager",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


@pytest.fixture
async def other_user(db):
    u = User(
        username="other_engager",
        first_name="Other",
        last_name="User",
        email="other_engager@test.com",
        password="hashed_password",
        user_uuid="user_other_engager",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


# ---------------------------------------------------------------------------
# ChannelVideoLike
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_creates_channel_video_like(db, channel_video, user):
    like = ChannelVideoLike(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        like_uuid="like_1",
        creation_date=str(datetime.now()),
    )
    db.add(like)
    await db.commit()
    await db.refresh(like)

    assert like.id is not None

    row = (
        await db.execute(
            select(ChannelVideoLike).where(ChannelVideoLike.channelvideo_id == channel_video.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.user_id == user.id


@pytest.mark.asyncio
async def test_like_unique_constraint_prevents_duplicate_per_user(db, channel_video, user):
    first = ChannelVideoLike(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        like_uuid="like_1",
        creation_date=str(datetime.now()),
    )
    db.add(first)
    await db.commit()

    duplicate = ChannelVideoLike(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        like_uuid="like_2",
        creation_date=str(datetime.now()),
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        await db.commit()


@pytest.mark.asyncio
async def test_like_allows_different_users_on_same_video(db, channel_video, user, other_user):
    db.add(ChannelVideoLike(channelvideo_id=channel_video.id, user_id=user.id, creation_date=str(datetime.now())))
    db.add(ChannelVideoLike(channelvideo_id=channel_video.id, user_id=other_user.id, creation_date=str(datetime.now())))
    await db.commit()

    rows = (
        await db.execute(
            select(ChannelVideoLike).where(ChannelVideoLike.channelvideo_id == channel_video.id)
        )
    ).scalars().all()
    assert len(rows) == 2


def test_like_foreign_keys_configured_for_cascade_delete():
    table = ChannelVideoLike.__table__

    cv_fks = list(table.columns["channelvideo_id"].foreign_keys)
    assert len(cv_fks) == 1
    assert cv_fks[0].column.table.name == "channelvideo"
    assert cv_fks[0].ondelete == "CASCADE"

    user_fks = list(table.columns["user_id"].foreign_keys)
    assert len(user_fks) == 1
    assert user_fks[0].column.table.name == "user"
    assert user_fks[0].ondelete == "CASCADE"


@pytest.mark.asyncio
async def test_deleting_channel_video_cascades_to_like(db, channel_video, user):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    like = ChannelVideoLike(channelvideo_id=channel_video.id, user_id=user.id, creation_date=str(datetime.now()))
    db.add(like)
    await db.commit()

    await db.delete(channel_video)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelVideoLike).where(ChannelVideoLike.user_id == user.id))
    ).scalars().first()
    assert remaining is None


# ---------------------------------------------------------------------------
# ChannelVideoSave
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_creates_channel_video_save(db, channel_video, user):
    save = ChannelVideoSave(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        save_uuid="save_1",
        creation_date=str(datetime.now()),
    )
    db.add(save)
    await db.commit()
    await db.refresh(save)

    assert save.id is not None

    row = (
        await db.execute(
            select(ChannelVideoSave).where(ChannelVideoSave.channelvideo_id == channel_video.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.user_id == user.id


@pytest.mark.asyncio
async def test_save_unique_constraint_prevents_duplicate_per_user(db, channel_video, user):
    first = ChannelVideoSave(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        save_uuid="save_1",
        creation_date=str(datetime.now()),
    )
    db.add(first)
    await db.commit()

    duplicate = ChannelVideoSave(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        save_uuid="save_2",
        creation_date=str(datetime.now()),
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        await db.commit()


def test_save_foreign_keys_configured_for_cascade_delete():
    table = ChannelVideoSave.__table__

    cv_fks = list(table.columns["channelvideo_id"].foreign_keys)
    assert len(cv_fks) == 1
    assert cv_fks[0].column.table.name == "channelvideo"
    assert cv_fks[0].ondelete == "CASCADE"

    user_fks = list(table.columns["user_id"].foreign_keys)
    assert len(user_fks) == 1
    assert user_fks[0].column.table.name == "user"
    assert user_fks[0].ondelete == "CASCADE"


@pytest.mark.asyncio
async def test_deleting_user_cascades_to_save(db, channel_video, user):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    save = ChannelVideoSave(channelvideo_id=channel_video.id, user_id=user.id, creation_date=str(datetime.now()))
    db.add(save)
    await db.commit()

    await db.delete(user)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelVideoSave).where(ChannelVideoSave.channelvideo_id == channel_video.id))
    ).scalars().first()
    assert remaining is None


# ---------------------------------------------------------------------------
# ChannelVideoComment
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_creates_channel_video_comment(db, channel_video, user):
    comment = ChannelVideoComment(
        channelvideo_id=channel_video.id,
        author_id=user.id,
        content="Great explanation, thank you!",
        comment_uuid="comment_1",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    assert comment.id is not None
    assert comment.content == "Great explanation, thank you!"

    row = (
        await db.execute(
            select(ChannelVideoComment).where(ChannelVideoComment.channelvideo_id == channel_video.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.author_id == user.id


@pytest.mark.asyncio
async def test_multiple_comments_allowed_for_same_user_and_video(db, channel_video, user):
    db.add(ChannelVideoComment(
        channelvideo_id=channel_video.id, author_id=user.id, content="First comment",
        comment_uuid="comment_1", creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    db.add(ChannelVideoComment(
        channelvideo_id=channel_video.id, author_id=user.id, content="Second comment",
        comment_uuid="comment_2", creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    await db.commit()

    rows = (
        await db.execute(
            select(ChannelVideoComment).where(ChannelVideoComment.channelvideo_id == channel_video.id)
        )
    ).scalars().all()
    assert len(rows) == 2


def test_comment_foreign_keys_configured_for_cascade_delete():
    table = ChannelVideoComment.__table__

    cv_fks = list(table.columns["channelvideo_id"].foreign_keys)
    assert len(cv_fks) == 1
    assert cv_fks[0].column.table.name == "channelvideo"
    assert cv_fks[0].ondelete == "CASCADE"

    author_fks = list(table.columns["author_id"].foreign_keys)
    assert len(author_fks) == 1
    assert author_fks[0].column.table.name == "user"
    assert author_fks[0].ondelete == "CASCADE"


def test_comment_has_no_threading_or_voting_columns():
    """Phase 4A explicitly excludes threaded replies and comment voting."""
    columns = ChannelVideoComment.__table__.columns.keys()
    assert "parent_comment_id" not in columns
    assert "upvote_count" not in columns


@pytest.mark.asyncio
async def test_deleting_channel_video_cascades_to_comment(db, channel_video, user):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    comment = ChannelVideoComment(
        channelvideo_id=channel_video.id, author_id=user.id, content="Will be cascaded",
        comment_uuid="comment_1", creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(comment)
    await db.commit()

    await db.delete(channel_video)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelVideoComment).where(ChannelVideoComment.author_id == user.id))
    ).scalars().first()
    assert remaining is None


# ---------------------------------------------------------------------------
# ChannelVideoShare
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_creates_channel_video_share(db, channel_video, user):
    share = ChannelVideoShare(
        channelvideo_id=channel_video.id,
        user_id=user.id,
        share_uuid="share_1",
        creation_date=str(datetime.now()),
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)

    assert share.id is not None

    row = (
        await db.execute(
            select(ChannelVideoShare).where(ChannelVideoShare.channelvideo_id == channel_video.id)
        )
    ).scalars().first()
    assert row is not None
    assert row.user_id == user.id


@pytest.mark.asyncio
async def test_multiple_share_events_allowed_for_same_user_and_video(db, channel_video, user):
    """Unlike Like/Save, ChannelVideoShare has no uniqueness constraint —
    repeated shares by the same user are all valid, counted events."""
    db.add(ChannelVideoShare(channelvideo_id=channel_video.id, user_id=user.id, share_uuid="share_1", creation_date=str(datetime.now())))
    db.add(ChannelVideoShare(channelvideo_id=channel_video.id, user_id=user.id, share_uuid="share_2", creation_date=str(datetime.now())))
    db.add(ChannelVideoShare(channelvideo_id=channel_video.id, user_id=user.id, share_uuid="share_3", creation_date=str(datetime.now())))
    await db.commit()

    rows = (
        await db.execute(
            select(ChannelVideoShare).where(ChannelVideoShare.channelvideo_id == channel_video.id)
        )
    ).scalars().all()
    assert len(rows) == 3


def test_share_foreign_keys_configured_for_cascade_delete():
    table = ChannelVideoShare.__table__

    cv_fks = list(table.columns["channelvideo_id"].foreign_keys)
    assert len(cv_fks) == 1
    assert cv_fks[0].column.table.name == "channelvideo"
    assert cv_fks[0].ondelete == "CASCADE"

    user_fks = list(table.columns["user_id"].foreign_keys)
    assert len(user_fks) == 1
    assert user_fks[0].column.table.name == "user"
    assert user_fks[0].ondelete == "CASCADE"


def test_share_user_id_is_required_not_nullable():
    """No anonymous-identity infrastructure exists in this schema (confirmed
    during Phase 4A investigation), so shares follow the same required-auth
    convention as every other user-content relationship here."""
    table = ChannelVideoShare.__table__
    assert table.columns["user_id"].nullable is False


@pytest.mark.asyncio
async def test_deleting_channel_video_cascades_to_share(db, channel_video, user):
    await db.execute(text("PRAGMA foreign_keys=ON"))

    share = ChannelVideoShare(channelvideo_id=channel_video.id, user_id=user.id, creation_date=str(datetime.now()))
    db.add(share)
    await db.commit()

    await db.delete(channel_video)
    await db.commit()

    remaining = (
        await db.execute(select(ChannelVideoShare).where(ChannelVideoShare.user_id == user.id))
    ).scalars().first()
    assert remaining is None
