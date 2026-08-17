"""add content format to channel video

Revision ID: a4286436d85d
Revises: e77b30b9f1ec
Create Date: 2026-08-17 10:50:42.764518

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a4286436d85d'
down_revision: Union[str, None] = 'e77b30b9f1ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Plain VARCHAR column (not a native Postgres ENUM), same convention as
    # Organization.channel_type (652b0b59778d) and ChannelVideo.visibility —
    # see docs/ARCHITECTURE.md § "Videos / Shorts (Phase 3A)". server_default
    # backfills every existing row to "long" in the same statement that adds
    # the column: every ChannelVideo created before Shorts existed was a
    # long-form video, so this is a safe, non-breaking default. nullable=False
    # with a server_default means existing rows and existing insert code
    # paths that don't yet know about this column both keep working.
    op.add_column(
        'channelvideo',
        sa.Column('content_format', sa.String(), nullable=False, server_default='long'),
    )
    op.create_index(
        op.f('ix_channelvideo_content_format'), 'channelvideo', ['content_format'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_channelvideo_content_format'), table_name='channelvideo')
    op.drop_column('channelvideo', 'content_format')
