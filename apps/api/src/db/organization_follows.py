from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class OrganizationFollow(SQLModel, table=True):
    __tablename__ = "organizationfollow"
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", name="unique_org_follow_user"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    follow_uuid: str = ""
    creation_date: str = ""


class OrganizationFollowStatus(SQLModel):
    is_following: bool
    follower_count: int
