"""add channel video engagement tables

Revision ID: d7bab4bd5914
Revises: a4286436d85d
Create Date: 2026-08-19 08:24:20.844927

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'd7bab4bd5914'
down_revision: Union[str, None] = 'a4286436d85d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 4A — Social Learning engagement schema. Each table is a direct,
    # single-purpose FK to channelvideo (no polymorphic content_type/content_id
    # association — matches every existing precedent: organizationfollow,
    # discussioncomment, discussionreaction). See docs/ARCHITECTURE.md §
    # "Social Engagement (Phase 4A)".

    # Like: toggle, unique per (channelvideo, user) — mirrors organizationfollow.
    op.create_table(
        'channelvideolike',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('channelvideo_id', sa.Integer(), sa.ForeignKey('channelvideo.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('like_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.UniqueConstraint('channelvideo_id', 'user_id', name='unique_channelvideo_user_like'),
    )
    op.create_index('ix_channelvideolike_channelvideo_id', 'channelvideolike', ['channelvideo_id'])
    op.create_index('ix_channelvideolike_user_id', 'channelvideolike', ['user_id'])

    # Save: same toggle shape as Like, kept as a separate table — saves are a
    # private per-user list, not a public count, so the access pattern differs.
    op.create_table(
        'channelvideosave',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('channelvideo_id', sa.Integer(), sa.ForeignKey('channelvideo.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('save_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.UniqueConstraint('channelvideo_id', 'user_id', name='unique_channelvideo_user_save'),
    )
    op.create_index('ix_channelvideosave_channelvideo_id', 'channelvideosave', ['channelvideo_id'])
    op.create_index('ix_channelvideosave_user_id', 'channelvideosave', ['user_id'])

    # Comment: flat (no parent_comment_id/threading), no upvote_count/voting —
    # both explicitly excluded from Phase 4A scope. Mirrors discussioncomment
    # minus those two fields.
    op.create_table(
        'channelvideocomment',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('channelvideo_id', sa.Integer(), sa.ForeignKey('channelvideo.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('comment_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
    )
    op.create_index('ix_channelvideocomment_channelvideo_id', 'channelvideocomment', ['channelvideo_id'])
    op.create_index('ix_channelvideocomment_comment_uuid', 'channelvideocomment', ['comment_uuid'])

    # Share: append-only event log, no uniqueness constraint — repeated shares
    # by the same user are all valid, counted events. user_id is required (not
    # nullable): no anonymous-identity infrastructure exists anywhere in this
    # schema to attribute an anonymous share to.
    op.create_table(
        'channelvideoshare',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('channelvideo_id', sa.Integer(), sa.ForeignKey('channelvideo.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('share_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
    )
    op.create_index('ix_channelvideoshare_channelvideo_id', 'channelvideoshare', ['channelvideo_id'])


def downgrade() -> None:
    op.drop_index('ix_channelvideoshare_channelvideo_id', table_name='channelvideoshare')
    op.drop_table('channelvideoshare')

    op.drop_index('ix_channelvideocomment_comment_uuid', table_name='channelvideocomment')
    op.drop_index('ix_channelvideocomment_channelvideo_id', table_name='channelvideocomment')
    op.drop_table('channelvideocomment')

    op.drop_index('ix_channelvideosave_user_id', table_name='channelvideosave')
    op.drop_index('ix_channelvideosave_channelvideo_id', table_name='channelvideosave')
    op.drop_table('channelvideosave')

    op.drop_index('ix_channelvideolike_user_id', table_name='channelvideolike')
    op.drop_index('ix_channelvideolike_channelvideo_id', table_name='channelvideolike')
    op.drop_table('channelvideolike')
