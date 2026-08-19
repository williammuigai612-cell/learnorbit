from typing import Optional
from sqlalchemy import Column, ForeignKey, Index, Integer, Text
from sqlmodel import Field, SQLModel


class ChannelVideoComment(SQLModel, table=True):
    """A flat comment on a ChannelVideo (Phase 4A).

    Mirrors DiscussionComment's shape, minus the two fields Phase 4's scope
    explicitly excludes: no `parent_comment_id` (no threaded replies) and no
    `upvote_count` (no comment voting/reactions). See docs/ARCHITECTURE.md §
    "Social Engagement (Phase 4A)".
    """

    __tablename__ = "channelvideocomment"
    __table_args__ = (
        Index("ix_channelvideocomment_channelvideo_id", "channelvideo_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    channelvideo_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("channelvideo.id", ondelete="CASCADE"), nullable=False
        )
    )
    author_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
        )
    )
    content: str = Field(sa_column=Column(Text, nullable=False))
    comment_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
