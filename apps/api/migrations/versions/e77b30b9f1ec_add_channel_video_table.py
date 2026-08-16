"""add channel video table

Revision ID: e77b30b9f1ec
Revises: 7c8d9e0f1a2b
Create Date: 2026-08-16 14:21:31.511768

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'e77b30b9f1ec'
down_revision: Union[str, None] = '7c8d9e0f1a2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ChannelVideo: a channel's published video. A thin discovery/metadata
    # layer over the existing Activity video infrastructure (upload,
    # storage, HLS, captions, streaming) rather than a new video system —
    # see docs/ARCHITECTURE.md § "Videos (Phase 2A)". One ChannelVideo per
    # Activity (unique + CASCADE), so a channel post can never outlive the
    # video it wraps, however the deletion happens (channel, course, or the
    # activity directly).
    op.create_table(
        'channelvideo',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('channelvideo_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organization.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_id', sa.BigInteger(), sa.ForeignKey('activity.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('thumbnail_image', sa.String(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('visibility', sa.String(), nullable=False, server_default='public'),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
        sa.Column('subject', sa.String(), nullable=True),
        sa.Column('topic', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=True),
        sa.Column('institution_context', sa.String(), nullable=True),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.UniqueConstraint('activity_id', name='unique_channelvideo_activity'),
    )
    op.create_index('ix_channelvideo_channelvideo_uuid', 'channelvideo', ['channelvideo_uuid'])
    op.create_index('ix_channelvideo_org_id', 'channelvideo', ['org_id'])
    op.create_index('ix_channelvideo_activity_id', 'channelvideo', ['activity_id'])


def downgrade() -> None:
    op.drop_index('ix_channelvideo_activity_id', table_name='channelvideo')
    op.drop_index('ix_channelvideo_org_id', table_name='channelvideo')
    op.drop_index('ix_channelvideo_channelvideo_uuid', table_name='channelvideo')
    op.drop_table('channelvideo')
