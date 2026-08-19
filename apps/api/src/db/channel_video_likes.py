from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class ChannelVideoLike(SQLModel, table=True):
    """A user's like on a ChannelVideo (Phase 4A).

    Mirrors OrganizationFollow's toggle shape: a lightweight (channelvideo,
    user) relationship, not a multi-emoji reaction — the PRD's "Likes"
    feature is deliberately kept distinct from the Discussion*Reaction
    emoji-picker pattern. See docs/ARCHITECTURE.md § "Social Engagement
    (Phase 4A)".
    """

    __tablename__ = "channelvideolike"
    __table_args__ = (
        UniqueConstraint(
            "channelvideo_id", "user_id", name="unique_channelvideo_user_like"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    channelvideo_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("channelvideo.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    like_uuid: str = ""
    creation_date: str = ""
