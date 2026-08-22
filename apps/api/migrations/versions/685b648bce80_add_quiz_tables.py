"""add quiz tables

Revision ID: 685b648bce80
Revises: e8861c4dd570
Create Date: 2026-08-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '685b648bce80'
down_revision: Union[str, None] = 'e8861c4dd570'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Quiz: a channel's quiz — a curated, ordered set of Question bank items
    # a student actually opens. quiz_type ("standard" | "exam_practice")
    # covers both the "Quizzes" and "Exam practice" roadmap items as one
    # entity — see docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)".
    op.create_table(
        'quiz',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quiz_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('org_id', sa.Integer(), sa.ForeignKey('organization.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('quiz_type', sa.String(), nullable=False, server_default='standard'),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('pass_threshold_percentage', sa.Float(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('visibility', sa.String(), nullable=False, server_default='public'),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.Column('update_date', sa.String(), nullable=False, server_default=''),
        sa.Column('subject', sa.String(), nullable=True),
        sa.Column('topic', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=True),
        sa.Column('institution_context', sa.String(), nullable=True),
    )
    op.create_index('ix_quiz_quiz_uuid', 'quiz', ['quiz_uuid'])
    op.create_index('ix_quiz_org_id', 'quiz', ['org_id'])

    # QuizQuestion: ordered join recording a Question's membership in a
    # Quiz — the only place that membership is recorded, so a Question stays
    # reusable across many quizzes.
    op.create_table(
        'quizquestion',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('quiz_id', sa.Integer(), sa.ForeignKey('quiz.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_id', sa.Integer(), sa.ForeignKey('question.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('quiz_id', 'question_id', name='uq_quizquestion_quiz_question'),
    )
    op.create_index('ix_quizquestion_quiz_id', 'quizquestion', ['quiz_id'])
    op.create_index('ix_quizquestion_question_id', 'quizquestion', ['question_id'])


def downgrade() -> None:
    op.drop_index('ix_quizquestion_question_id', table_name='quizquestion')
    op.drop_index('ix_quizquestion_quiz_id', table_name='quizquestion')
    op.drop_table('quizquestion')
    op.drop_index('ix_quiz_org_id', table_name='quiz')
    op.drop_index('ix_quiz_quiz_uuid', table_name='quiz')
    op.drop_table('quiz')
