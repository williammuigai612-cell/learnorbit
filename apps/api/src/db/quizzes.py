from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class Quiz(SQLModel, table=True):
    """A channel's quiz — a curated, ordered set of `Question` bank items a
    student actually opens (via `QuizQuestion`).

    Purpose-built, channel-scoped domain — not a thin wrapper over an
    existing `Activity`. `quiz_type` covers both the roadmap's "Quizzes" and
    "Exam practice" items as one entity (a `Quiz` in `exam_practice` mode
    additionally carries a `time_limit_minutes`), rather than two
    near-identical tables. See docs/ARCHITECTURE.md § "Exams & Practice
    (Phase 6A)" for the full decision.
    """

    __tablename__ = "quiz"

    id: Optional[int] = Field(default=None, primary_key=True)
    quiz_uuid: str = Field(default="", index=True)
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    title: str
    description: Optional[str] = None
    # "standard" | "exam_practice" — plain growable string, same convention
    # as ChannelVideo.content_format.
    quiz_type: str = Field(default="standard")
    time_limit_minutes: Optional[int] = None
    pass_threshold_percentage: Optional[float] = None
    published: bool = Field(default=False)
    visibility: str = Field(default="public")
    creation_date: str = ""
    update_date: str = ""
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None


class QuizQuestion(SQLModel, table=True):
    """Ordered join recording a `Question` bank item's membership in a
    `Quiz`. The only place that membership is recorded — a `Question` row
    itself carries no back-reference, so it stays reusable across many
    quizzes."""

    __tablename__ = "quizquestion"
    __table_args__ = (
        UniqueConstraint("quiz_id", "question_id", name="uq_quizquestion_quiz_question"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    quiz_id: int = Field(
        sa_column=Column(Integer, ForeignKey("quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    question_id: int = Field(
        sa_column=Column(Integer, ForeignKey("question.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    order: int = Field(default=0)
