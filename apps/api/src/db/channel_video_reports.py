from typing import Optional
from sqlalchemy import Column, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


class ChannelVideoReport(SQLModel, table=True):
    """A user's report of a ChannelVideo for review (Phase 8A).

    Single-purpose FK to channelvideo, same convention as ChannelVideoLike/
    Save/Share and Notification — see docs/ARCHITECTURE.md § "Trust &
    Moderation (Phase 8A)". One open report per (video, reporter): a repeat
    report from the same user is treated as idempotent success rather than a
    second row — same abuse-prevention shape as ChannelVideoSave's unique
    constraint. `status` is set to "OPEN" here and, in this phase, never
    changes — the review/resolve workflow belongs to a later Phase 8
    increment, not this one.
    """

    __tablename__ = "channelvideoreport"
    __table_args__ = (
        UniqueConstraint(
            "channelvideo_id", "reporter_id", name="unique_channelvideo_reporter_report"
        ),
        Index("ix_channelvideoreport_org_id", "org_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    report_uuid: str = Field(default="", index=True)
    channelvideo_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("channelvideo.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    reporter_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    # Denormalized from the video at report time (equals ChannelVideo.org_id)
    # so a future admin queue can filter reports by channel directly, without
    # a join through channelvideo. See docs/ARCHITECTURE.md § "Trust &
    # Moderation (Phase 8A)".
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False)
    )
    # Plain growable string, not a native enum — same convention as
    # ChannelVideo.visibility/content_format. Validated against a fixed
    # allowed set in the service layer, not the database.
    reason: str = Field(sa_column=Column(String(32), nullable=False))
    details: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(
        default="OPEN", sa_column=Column(String(16), nullable=False, server_default="OPEN")
    )
    creation_date: str = ""
