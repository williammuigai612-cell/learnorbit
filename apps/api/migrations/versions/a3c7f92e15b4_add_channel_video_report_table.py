"""add channel video report table

Revision ID: a3c7f92e15b4
Revises: 23f2681a2070
Create Date: 2026-08-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a3c7f92e15b4'
down_revision: Union[str, None] = '23f2681a2070'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 8A — Reporting. Single-purpose FK to channelvideo, same
    # convention as the Phase 4A engagement tables and Notification. One
    # open report per (video, reporter) via the unique constraint — a repeat
    # report from the same user is treated as idempotent success rather than
    # a new row, same abuse-prevention shape as channelvideosave's unique
    # constraint. `status` starts and, in this phase, always stays 'OPEN'.
    # See docs/ARCHITECTURE.md § "Trust & Moderation (Phase 8A)".
    op.create_table(
        'channelvideoreport',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('report_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('channelvideo_id', sa.Integer(), sa.ForeignKey('channelvideo.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organization.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reason', sa.String(length=32), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='OPEN'),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.UniqueConstraint('channelvideo_id', 'reporter_id', name='unique_channelvideo_reporter_report'),
    )
    op.create_index('ix_channelvideoreport_report_uuid', 'channelvideoreport', ['report_uuid'])
    op.create_index('ix_channelvideoreport_channelvideo_id', 'channelvideoreport', ['channelvideo_id'])
    op.create_index('ix_channelvideoreport_reporter_id', 'channelvideoreport', ['reporter_id'])
    op.create_index('ix_channelvideoreport_org_id', 'channelvideoreport', ['org_id'])


def downgrade() -> None:
    op.drop_index('ix_channelvideoreport_org_id', table_name='channelvideoreport')
    op.drop_index('ix_channelvideoreport_reporter_id', table_name='channelvideoreport')
    op.drop_index('ix_channelvideoreport_channelvideo_id', table_name='channelvideoreport')
    op.drop_index('ix_channelvideoreport_report_uuid', table_name='channelvideoreport')
    op.drop_table('channelvideoreport')
