"""add channel type to organization

Revision ID: 652b0b59778d
Revises: b1n2u3d4g5e6
Create Date: 2026-08-15 14:55:56.672254

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '652b0b59778d'
down_revision: Union[str, None] = 'b1n2u3d4g5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Plain VARCHAR column (not a native Postgres ENUM) so future channel
    # types can be added without an ALTER TYPE migration — see
    # k1f2a3b4c5d6_add_community_page_type.py for the same convention.
    #
    # server_default backfills every existing row to SCHOOL in the same
    # statement that adds the column: every Organization created before
    # LearnOrbit channels existed was a school/institution tenant, so this
    # is a safe, non-breaking default. nullable=False with a server_default
    # means existing rows and existing insert code paths that don't yet know
    # about this column both keep working.
    op.add_column(
        'organization',
        sa.Column('channel_type', sa.String(), nullable=False, server_default='SCHOOL'),
    )
    op.create_index(
        op.f('ix_organization_channel_type'), 'organization', ['channel_type'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_organization_channel_type'), table_name='organization')
    op.drop_column('organization', 'channel_type')
