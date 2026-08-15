"""add organization follows table

Revision ID: 7c8d9e0f1a2b
Revises: 652b0b59778d
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '7c8d9e0f1a2b'
down_revision: Union[str, None] = '652b0b59778d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Follow/subscribe relationship between a user and a channel (Organization).
    # A dedicated table rather than reusing UserOrganization: following is a
    # lightweight, roleless subscription available to any authenticated user,
    # not membership with a Role — the same distinction PlaygroundReaction
    # draws for reactions vs. course enrollment.
    op.create_table(
        'organizationfollow',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organization.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('follow_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.UniqueConstraint('org_id', 'user_id', name='unique_org_follow_user'),
    )
    op.create_index('ix_organizationfollow_org_id', 'organizationfollow', ['org_id'])
    op.create_index('ix_organizationfollow_user_id', 'organizationfollow', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_organizationfollow_user_id', table_name='organizationfollow')
    op.drop_index('ix_organizationfollow_org_id', table_name='organizationfollow')
    op.drop_table('organizationfollow')
