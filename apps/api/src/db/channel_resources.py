from typing import Optional
from sqlalchemy import BigInteger, Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class ChannelResource(SQLModel, table=True):
    """A channel's published academic resource (PDF).

    A thin discovery/metadata layer over the existing `Activity` document
    infrastructure (upload, storage, validation), which `Activity` continues
    to own unchanged. Mirrors `ChannelVideo`'s relationship to `Activity`
    exactly. See docs/ARCHITECTURE.md § "Academic Library (Phase 5A)" for the
    full decision and cascade analysis.
    """

    __tablename__ = "channelresource"

    id: Optional[int] = Field(default=None, primary_key=True)
    channelresource_uuid: str = Field(default="", index=True)
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    activity_id: int = Field(
        sa_column=Column(
            BigInteger,
            ForeignKey("activity.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        )
    )
    title: str
    description: Optional[str] = None
    published: bool = Field(default=False)
    visibility: str = Field(default="public")
    creation_date: str = ""
    update_date: str = ""
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None
    # Exam year/session, e.g. "2023" or "Nov 2023 P1" — not present on
    # ChannelVideo. Free text, not int: exam sessions aren't always a bare
    # year. See docs/ARCHITECTURE.md § "Academic Library (Phase 5A)".
    year: Optional[str] = None
