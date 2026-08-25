from typing import List, Union

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.orgs.channel_videos import HomeFeedItem, list_home_feed

# Home feed (LearnOrbit Phase 4G / roadmap "Home feed") — a personalized,
# cross-org, reverse-chronological feed of long-form videos from channels the
# authenticated user follows. Mirrors routers/shorts.py's global-router
# pattern (no org_id in the path); unlike shorts.py this requires
# authentication since the feed is personal to the caller's follows.
router = APIRouter()


@router.get(
    "",
    response_model=List[HomeFeedItem],
    summary="Home feed",
    description=(
        "Reverse-chronological feed of published, publicly-visible long-form "
        "videos from channels the authenticated user follows. Excludes "
        "Shorts (see GET /shorts for those) and returns an empty list for a "
        "user who follows no channels yet. Paginated newest-first; maximum "
        "100 per page."
    ),
    responses={
        200: {"description": "Followed channels' videos, newest first.", "model": List[HomeFeedItem]},
        401: {"description": "Not authenticated"},
    },
)
async def api_get_home_feed(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[HomeFeedItem]:
    return await list_home_feed(current_user, db_session, page, limit)
