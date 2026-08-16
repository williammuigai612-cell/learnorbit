from typing import Optional
from sqlalchemy import BigInteger, Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class ChannelVideo(SQLModel, table=True):
    """A channel's published video.

    A thin discovery/metadata layer over the existing `Activity` video
    infrastructure (upload, storage, processing, streaming, HLS, captions),
    which `Activity` continues to own unchanged. See docs/ARCHITECTURE.md
    § "Videos (Phase 2A)" for the full decision and cascade analysis.
    """

    __tablename__ = "channelvideo"

    id: Optional[int] = Field(default=None, primary_key=True)
    channelvideo_uuid: str = Field(default="", index=True)
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
    thumbnail_image: Optional[str] = None
    published: bool = Field(default=False)
    visibility: str = Field(default="public")
    creation_date: str = ""
    update_date: str = ""
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
    resource_type: Optional[str] = None
