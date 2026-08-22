"""add organization is_verified

Revision ID: b7e4f1a92c83
Revises: a3c7f92e15b4
Create Date: 2026-08-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'b7e4f1a92c83'
down_revision: Union[str, None] = 'a3c7f92e15b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 8C — Teacher/organization verification. A platform-wide trust
    # signal, superadmin-grantable only (never through the general org
    # update path). Plain boolean, not an enum — see docs/ARCHITECTURE.md §
    # "Trust & Moderation (Phase 8C)".
    op.add_column(
        'organization',
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('organization', 'is_verified')
