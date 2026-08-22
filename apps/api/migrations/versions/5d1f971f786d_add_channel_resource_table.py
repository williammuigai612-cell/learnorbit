"""add channel resource table

Revision ID: 5d1f971f786d
Revises: f9a1b2c3d4e5
Create Date: 2026-08-20 11:43:20.112396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '5d1f971f786d'
down_revision: Union[str, None] = 'f9a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ChannelResource: a channel's published academic resource (PDF). A thin
    # discovery/metadata layer over the existing Activity document
    # infrastructure (upload, storage, validation) rather than a new upload
    # pipeline — see docs/ARCHITECTURE.md § "Academic Library (Phase 5A)".
    # One ChannelResource per Activity (unique + CASCADE), mirroring
    # ChannelVideo's relationship to Activity exactly.
    op.create_table(
        'channelresource',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('channelresource_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organization.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_id', sa.BigInteger(), sa.ForeignKey('activity.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('visibility', sa.String(), nullable=False, server_default='public'),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
        sa.Column('subject', sa.String(), nullable=True),
        sa.Column('topic', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=True),
        sa.Column('institution_context', sa.String(), nullable=True),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('year', sa.String(), nullable=True),
        sa.UniqueConstraint('activity_id', name='unique_channelresource_activity'),
    )
    op.create_index('ix_channelresource_channelresource_uuid', 'channelresource', ['channelresource_uuid'])
    op.create_index('ix_channelresource_org_id', 'channelresource', ['org_id'])
    op.create_index('ix_channelresource_activity_id', 'channelresource', ['activity_id'])


def downgrade() -> None:
    op.drop_index('ix_channelresource_activity_id', table_name='channelresource')
    op.drop_index('ix_channelresource_org_id', table_name='channelresource')
    op.drop_index('ix_channelresource_channelresource_uuid', table_name='channelresource')
    op.drop_table('channelresource')
