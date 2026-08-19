from typing import Optional
from sqlalchemy import Column, ForeignKey, Index, Integer
from sqlmodel import Field, SQLModel


class ChannelVideoShare(SQLModel, table=True):
    """A share event for a ChannelVideo (Phase 4A).

    An append-only event log, not a toggle: repeated shares by the same user
    are all valid and all counted, so — unlike Like/Save — there is no
    UniqueConstraint on (channelvideo_id, user_id). `user_id` is required
    (not nullable): no anonymous-identity infrastructure exists anywhere in
    this schema to attribute an anonymous share to, so this follows the same
    required-auth convention as every other user-content relationship here
    (OrganizationFollow, DiscussionComment, DiscussionReaction). See
    docs/ARCHITECTURE.md § "Social Engagement (Phase 4A)".
    """

    __tablename__ = "channelvideoshare"
    __table_args__ = (
        Index("ix_channelvideoshare_channelvideo_id", "channelvideo_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    channelvideo_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("channelvideo.id", ondelete="CASCADE"), nullable=False
        )
    )
    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
        )
    )
    share_uuid: str = ""
    creation_date: str = ""
