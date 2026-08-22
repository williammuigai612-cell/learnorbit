from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.parent_child_links import ParentChildLink, ParentChildLinkStatusEnum
from src.db.users import PublicUser, User
from src.services.users.parent_links import (
    list_my_parent_links,
    list_pending_parent_links,
    request_parent_link,
    respond_to_parent_link,
)


@pytest.fixture
async def third_user(db, org):
    """A third, unrelated user — for cross-link isolation checks."""
    u = User(
        id=3,
        username="other",
        first_name="Other",
        last_name="User",
        email="other@test.com",
        password="hashed_password",
        user_uuid="user_other",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _make_parent(db, public_user: PublicUser) -> PublicUser:
    """Flip is_parent=True on the underlying User row for a PublicUser fixture
    and return an updated PublicUser reflecting it (mirrors what get_current_user
    would hand a router after the flag is set — see request_parent_link's
    `current_user.is_parent` check)."""
    row = await db.get(User, public_user.id)
    row.is_parent = True
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PublicUser(**{**public_user.model_dump(), "is_parent": True})


@pytest.mark.asyncio
async def test_request_creates_pending_link(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)

    link = await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )

    assert link.status == ParentChildLinkStatusEnum.PENDING
    row = (
        await db.execute(
            select(ParentChildLink).where(
                ParentChildLink.parent_user_id == parent.id,
                ParentChildLink.child_user_id == regular_user.id,
            )
        )
    ).scalars().first()
    assert row is not None
    assert row.status == ParentChildLinkStatusEnum.PENDING


@pytest.mark.asyncio
async def test_request_rejects_non_parent_accounts(db, admin_user, regular_user):
    with pytest.raises(HTTPException) as exc:
        await request_parent_link(
            current_user=admin_user, child_username=regular_user.username, db_session=db
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_request_rejects_self_link(db, admin_user):
    parent = await _make_parent(db, admin_user)

    with pytest.raises(HTTPException) as exc:
        await request_parent_link(
            current_user=parent, child_username=parent.username, db_session=db
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_request_rejects_unknown_username(db, admin_user):
    parent = await _make_parent(db, admin_user)

    with pytest.raises(HTTPException) as exc:
        await request_parent_link(
            current_user=parent, child_username="does_not_exist", db_session=db
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_request_is_idempotent_while_pending(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)

    await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )
    await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )

    rows = (
        await db.execute(
            select(ParentChildLink).where(
                ParentChildLink.parent_user_id == parent.id,
                ParentChildLink.child_user_id == regular_user.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_list_pending_only_returns_requests_for_the_calling_child(
    db, admin_user, regular_user, third_user
):
    parent = await _make_parent(db, admin_user)
    await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )

    pending_for_child = await list_pending_parent_links(current_user=regular_user, db_session=db)
    pending_for_other = await list_pending_parent_links(current_user=third_user, db_session=db)

    assert len(pending_for_child) == 1
    assert pending_for_child[0].parent_user_id == parent.id
    assert pending_for_other == []


@pytest.mark.asyncio
async def test_child_can_approve_pending_link(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)
    link = await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )

    approved = await respond_to_parent_link(
        current_user=regular_user, link_uuid=link.link_uuid, approve=True, db_session=db
    )

    assert approved.status == ParentChildLinkStatusEnum.APPROVED


@pytest.mark.asyncio
async def test_child_can_reject_pending_link(db, admin_user, regular_user):
    parent = await _make_parent(db, admin_user)
    link = await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )

    rejected = await respond_to_parent_link(
        current_user=regular_user, link_uuid=link.link_uuid, approve=False, db_session=db
    )

    assert rejected.status == ParentChildLinkStatusEnum.REJECTED


@pytest.mark.asyncio
async def test_only_the_target_child_can_respond(
    db, admin_user, regular_user, third_user
):
    """IDOR check: neither the parent nor an unrelated third user may approve
    a link that isn't theirs to respond to."""
    parent = await _make_parent(db, admin_user)
    link = await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )

    with pytest.raises(HTTPException) as exc:
        await respond_to_parent_link(
            current_user=parent, link_uuid=link.link_uuid, approve=True, db_session=db
        )
    assert exc.value.status_code in (403, 404)

    with pytest.raises(HTTPException) as exc:
        await respond_to_parent_link(
            current_user=third_user, link_uuid=link.link_uuid, approve=True, db_session=db
        )
    assert exc.value.status_code in (403, 404)

    row = (
        await db.execute(
            select(ParentChildLink).where(ParentChildLink.link_uuid == link.link_uuid)
        )
    ).scalars().first()
    assert row.status == ParentChildLinkStatusEnum.PENDING


@pytest.mark.asyncio
async def test_list_my_links_returns_approved_links_on_either_side(
    db, admin_user, regular_user, third_user
):
    """Phase 7C: list_my_parent_links is the read the 'linked family' UI
    consumes — approved links only, visible from both the parent's and the
    child's side."""
    parent = await _make_parent(db, admin_user)
    link = await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )
    await respond_to_parent_link(
        current_user=regular_user, link_uuid=link.link_uuid, approve=True, db_session=db
    )

    from_parent_side = await list_my_parent_links(current_user=parent, db_session=db)
    from_child_side = await list_my_parent_links(current_user=regular_user, db_session=db)
    from_unrelated = await list_my_parent_links(current_user=third_user, db_session=db)

    assert [row.link_uuid for row in from_parent_side] == [link.link_uuid]
    assert [row.link_uuid for row in from_child_side] == [link.link_uuid]
    assert from_unrelated == []


@pytest.mark.asyncio
async def test_list_my_links_excludes_pending_and_rejected(
    db, admin_user, regular_user, third_user
):
    parent = await _make_parent(db, admin_user)

    pending_link = await request_parent_link(
        current_user=parent, child_username=regular_user.username, db_session=db
    )
    rejected_link = await request_parent_link(
        current_user=parent, child_username=third_user.username, db_session=db
    )
    await respond_to_parent_link(
        current_user=third_user, link_uuid=rejected_link.link_uuid, approve=False, db_session=db
    )

    assert await list_my_parent_links(current_user=parent, db_session=db) == []
    assert pending_link.status == ParentChildLinkStatusEnum.PENDING
    assert rejected_link.link_uuid  # sanity: request succeeded before rejection


@pytest.mark.asyncio
async def test_list_my_links_requires_authentication(db, anonymous_user):
    with pytest.raises(HTTPException) as exc:
        await list_my_parent_links(current_user=anonymous_user, db_session=db)
    assert exc.value.status_code == 401
