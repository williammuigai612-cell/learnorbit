"""add question table

Revision ID: e8861c4dd570
Revises: 5d1f971f786d
Create Date: 2026-08-21 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'e8861c4dd570'
down_revision: Union[str, None] = '5d1f971f786d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Question: a channel's reusable exam-prep question bank item —
    # channel-scoped, reusable across many Quizzes (including
    # exam_practice-mode quizzes that mix questions from across the bank).
    # Purpose-built, not a thin wrapper over an existing Activity — see
    # docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)".
    op.create_table(
        'question',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('question_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organization.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_type', sa.String(), nullable=False),
        sa.Column('prompt', sa.String(), nullable=False),
        sa.Column('contents', sa.JSON(), nullable=False),
        sa.Column('explanation', sa.String(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
        sa.Column('subject', sa.String(), nullable=True),
        sa.Column('topic', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=True),
        sa.Column('institution_context', sa.String(), nullable=True),
    )
    op.create_index('ix_question_question_uuid', 'question', ['question_uuid'])
    op.create_index('ix_question_org_id', 'question', ['org_id'])


def downgrade() -> None:
    op.drop_index('ix_question_org_id', table_name='question')
    op.drop_index('ix_question_question_uuid', table_name='question')
    op.drop_table('question')
