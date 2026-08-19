from typing import Optional
from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer
from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    """An in-app notification for a user (Phase 4H).

    Single-purpose FK to channelvideo, same convention as the Phase 4A
    engagement tables (no polymorphic content_type/content_id association).
    `notification_type` is a plain growable string (matches
    ChannelVideo.visibility/content_format) rather than a native enum, so a
    future type like LIKE needs no migration — see
    docs/ARCHITECTURE.md § "Basic Notifications (Phase 4H)".
    """

    __tablename__ = "notification"
    __table_args__ = (
        Index("ix_notification_recipient_id", "recipient_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    notification_uuid: str = Field(default="", index=True)
    recipient_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
        )
    )
    actor_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
        )
    )
    channelvideo_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("channelvideo.id", ondelete="CASCADE"), nullable=False
        )
    )
    notification_type: str = Field(default="COMMENT")
    is_read: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    creation_date: str = ""
