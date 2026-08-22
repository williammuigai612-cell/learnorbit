"""add is_parent to user

Revision ID: 72573d15ab51
Revises: f4c9a2b7e6d1
Create Date: 2026-08-22 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '72573d15ab51'
down_revision: Union[str, None] = 'f4c9a2b7e6d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 7A: self-declared "this account is a parent" flag. No relationship
    # or cross-user access is granted by this alone — see docs/ARCHITECTURE.md
    # § "Parents (Phase 7A)".
    op.add_column(
        'user',
        sa.Column('is_parent', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('user', 'is_parent')
