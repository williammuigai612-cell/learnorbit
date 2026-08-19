from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class ChannelVideoSave(SQLModel, table=True):
    """A user's private save/bookmark of a ChannelVideo (Phase 4A).

    Same toggle shape as ChannelVideoLike but a separate table rather than a
    shared "type" column: saves are a private, per-user list (queried by
    user_id — "my saved videos"), while likes are a public count (queried by
    channelvideo_id) — different access patterns, not the same relationship
    with a label attached.
    """

    __tablename__ = "channelvideosave"
    __table_args__ = (
        UniqueConstraint(
            "channelvideo_id", "user_id", name="unique_channelvideo_user_save"
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
    save_uuid: str = ""
    creation_date: str = ""
