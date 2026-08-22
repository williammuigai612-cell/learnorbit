"""add parent child link table

Revision ID: 23f2681a2070
Revises: 72573d15ab51
Create Date: 2026-08-22 15:41:41.936663

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '23f2681a2070'
down_revision: Union[str, None] = '72573d15ab51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 7B: child-approves-parent's-request relationship — see
    # docs/ARCHITECTURE.md § "Parents (Phase 7A)" for the decision trail.
    # Native enum type first, matching the resourceauthorshipstatusenum
    # convention (db/resource_authors.py / migrations/.../4a88b680263c).
    status_enum = postgresql.ENUM(
        'PENDING', 'APPROVED', 'REJECTED', name='parentchildlinkstatusenum'
    )
    status_enum.create(op.get_bind())

    op.create_table(
        'parentchildlink',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('link_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('parent_user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('child_user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM(
                'PENDING', 'APPROVED', 'REJECTED',
                name='parentchildlinkstatusenum', create_type=False,
            ),
            nullable=False,
            server_default='PENDING',
        ),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
        sa.UniqueConstraint('parent_user_id', 'child_user_id', name='unique_parent_child_link'),
    )
    op.create_index('ix_parentchildlink_link_uuid', 'parentchildlink', ['link_uuid'])
    op.create_index('ix_parentchildlink_parent_user_id', 'parentchildlink', ['parent_user_id'])
    op.create_index('ix_parentchildlink_child_user_id', 'parentchildlink', ['child_user_id'])


def downgrade() -> None:
    op.drop_index('ix_parentchildlink_child_user_id', table_name='parentchildlink')
    op.drop_index('ix_parentchildlink_parent_user_id', table_name='parentchildlink')
    op.drop_index('ix_parentchildlink_link_uuid', table_name='parentchildlink')
    op.drop_table('parentchildlink')

    postgresql.ENUM(name='parentchildlinkstatusenum').drop(op.get_bind())
