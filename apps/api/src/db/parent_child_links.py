from enum import Enum
from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class ParentChildLinkStatusEnum(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ParentChildLink(SQLModel, table=True):
    """A parent's request to link to a child account (Phase 7B).

    Child-approves-parent's-request flow: the parent (an ``is_parent=True``
    account) creates the row as ``PENDING`` by identifying the child via
    username; only the child may transition it to ``APPROVED``/``REJECTED``.
    Modeled on ``OrganizationFollow``'s join-table shape (id, FK pair, unique
    constraint, `*_uuid`) with a status enum added, per the `resource_authors`
    convention, since this relationship isn't a simple binary follow — see
    docs/ARCHITECTURE.md § "Parents (Phase 7A)" for the surrounding decision
    trail. Setting the flag alone (7A) grants no relationship; an
    ``APPROVED`` row here is what 7C's activity view will authorize against.
    """

    __tablename__ = "parentchildlink"
    __table_args__ = (
        UniqueConstraint("parent_user_id", "child_user_id", name="unique_parent_child_link"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    link_uuid: str = Field(default="", index=True)
    parent_user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    child_user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    status: ParentChildLinkStatusEnum = Field(default=ParentChildLinkStatusEnum.PENDING)
    creation_date: str = ""
    update_date: str = ""


class ParentChildLinkRead(SQLModel):
    link_uuid: str
    parent_user_id: int
    child_user_id: int
    status: ParentChildLinkStatusEnum
    creation_date: str
    update_date: str
