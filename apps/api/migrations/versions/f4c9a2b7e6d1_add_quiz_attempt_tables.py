"""add quiz attempt tables

Revision ID: f4c9a2b7e6d1
Revises: 685b648bce80
Create Date: 2026-08-21 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'f4c9a2b7e6d1'
down_revision: Union[str, None] = '685b648bce80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # QuizAttempt: one row per attempt at taking a Quiz — not reset-in-place,
    # every attempt is its own row (no unique constraint on
    # (user_id, quiz_id)) so attempt history is preserved for Results (6G)
    # and progress tracking (6H). See docs/ARCHITECTURE.md § "Exams &
    # Practice (Phase 6A)".
    op.create_table(
        'quizattempt',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quizattempt_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('quiz_id', sa.Integer(), sa.ForeignKey('quiz.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='in_progress'),
        sa.Column('score_percentage', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('started_at', sa.String(), nullable=False, server_default=''),
        sa.Column('submitted_at', sa.String(), nullable=True),
    )
    op.create_index('ix_quizattempt_quizattempt_uuid', 'quizattempt', ['quizattempt_uuid'])
    op.create_index('ix_quizattempt_quiz_id', 'quizattempt', ['quiz_id'])
    op.create_index('ix_quizattempt_user_id', 'quizattempt', ['user_id'])

    # QuizAnswer: one row per (attempt, question) — the learner's submitted
    # answer and its auto-graded correctness.
    op.create_table(
        'quizanswer',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quizattempt_id', sa.Integer(), sa.ForeignKey('quizattempt.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_id', sa.Integer(), sa.ForeignKey('question.id', ondelete='CASCADE'), nullable=False),
        sa.Column('answer', sa.JSON(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint('quizattempt_id', 'question_id', name='uq_quizanswer_attempt_question'),
    )
    op.create_index('ix_quizanswer_quizattempt_id', 'quizanswer', ['quizattempt_id'])
    op.create_index('ix_quizanswer_question_id', 'quizanswer', ['question_id'])


def downgrade() -> None:
    op.drop_index('ix_quizanswer_question_id', table_name='quizanswer')
    op.drop_index('ix_quizanswer_quizattempt_id', table_name='quizanswer')
    op.drop_table('quizanswer')
    op.drop_index('ix_quizattempt_user_id', table_name='quizattempt')
    op.drop_index('ix_quizattempt_quiz_id', table_name='quizattempt')
    op.drop_index('ix_quizattempt_quizattempt_uuid', table_name='quizattempt')
    op.drop_table('quizattempt')
