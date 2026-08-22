from typing import Dict, Optional
from sqlalchemy import Column, Boolean, ForeignKey, Float, Integer, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


class QuizAttempt(SQLModel, table=True):
    """One row per attempt at taking a `Quiz` — not reset-in-place like
    `AssignmentUserSubmission`; every attempt is its own row (no unique
    constraint on `(user_id, quiz_id)`), so attempt history is preserved for
    the later Results (6G) and progress-tracking (6H) increments. See
    docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" for the full
    decision.
    """

    __tablename__ = "quizattempt"

    id: Optional[int] = Field(default=None, primary_key=True)
    quizattempt_uuid: str = Field(default="", index=True)
    quiz_id: int = Field(
        sa_column=Column(Integer, ForeignKey("quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    # "in_progress" | "submitted" | "graded" — see 6A decision. All V1
    # question types are auto-gradable, so submit_quiz_attempt moves an
    # attempt directly from "in_progress" to "graded" in one step; there is
    # no persisted "submitted"-but-not-yet-graded state in V1.
    status: str = Field(default="in_progress")
    score_percentage: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0.0"))
    attempt_number: int = Field(default=1)
    started_at: str = ""
    submitted_at: Optional[str] = None


class QuizAnswer(SQLModel, table=True):
    """One row per `(attempt, question)` — the learner's submitted answer
    and its auto-graded correctness. `answer`'s shape is question-type
    specific; see docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" for
    the grading contract."""

    __tablename__ = "quizanswer"
    __table_args__ = (
        UniqueConstraint("quizattempt_id", "question_id", name="uq_quizanswer_attempt_question"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    quizattempt_id: int = Field(
        sa_column=Column(Integer, ForeignKey("quizattempt.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    question_id: int = Field(
        sa_column=Column(Integer, ForeignKey("question.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    answer: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    is_correct: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="false"))
