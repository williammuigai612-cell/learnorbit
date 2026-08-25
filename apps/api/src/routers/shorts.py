from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.services.orgs.channel_videos import ChannelVideoRead, list_public_shorts

# Global Shorts discovery (LearnOrbit Phase 3C) — a cross-org, public,
# reverse-chronological feed of ChannelVideo rows with content_format ==
# "short". See docs/ARCHITECTURE.md § "Videos / Shorts (Phase 3A)", point 4.
router = APIRouter()


@router.get(
    "",
    response_model=List[ChannelVideoRead],
    summary="Global Shorts discovery",
    description=(
        "Cross-organization, reverse-chronological feed of every published, "
        "publicly-visible Short. Anonymous access. Drafts and "
        "unlisted/private Shorts are never returned — the same "
        "published+public predicate used by GET /orgs/{org_id}/videos. "
        "Paginated newest-first; maximum 100 per page."
    ),
    responses={
        200: {
            "description": "Published, public Shorts across all channels, newest first.",
            "model": List[ChannelVideoRead],
        },
    },
)
async def api_list_public_shorts(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[ChannelVideoRead]:
    return await list_public_shorts(db_session, page, limit)
