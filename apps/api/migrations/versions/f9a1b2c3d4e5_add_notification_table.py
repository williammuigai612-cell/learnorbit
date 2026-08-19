"""add notification table

Revision ID: f9a1b2c3d4e5
Revises: d7bab4bd5914
Create Date: 2026-08-19 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'f9a1b2c3d4e5'
down_revision: Union[str, None] = 'd7bab4bd5914'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 4H — Basic Notifications. Single-purpose FK to channelvideo, same
    # convention as Phase 4A's engagement tables. `notification_type` is a
    # plain growable string (not a native enum) so a future LIKE type needs
    # no migration. See docs/ARCHITECTURE.md § "Basic Notifications (Phase 4H)".
    op.create_table(
        'notification',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('notification_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('recipient_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('channelvideo_id', sa.Integer(), sa.ForeignKey('channelvideo.id', ondelete='CASCADE'), nullable=False),
        sa.Column('notification_type', sa.String(), nullable=False, server_default='COMMENT'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
    )
    op.create_index('ix_notification_recipient_id', 'notification', ['recipient_id'])
    op.create_index('ix_notification_notification_uuid', 'notification', ['notification_uuid'])


def downgrade() -> None:
    op.drop_index('ix_notification_notification_uuid', table_name='notification')
    op.drop_index('ix_notification_recipient_id', table_name='notification')
    op.drop_table('notification')
