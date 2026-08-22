from typing import Dict, Optional
from sqlalchemy import Column, ForeignKey, Integer, JSON
from sqlmodel import Field, SQLModel


class Question(SQLModel, table=True):
    """A channel's reusable exam-prep question bank item.

    Channel-scoped and reusable across many `Quiz`zes (including
    `exam_practice`-mode quizzes that mix questions from across the bank) —
    not a thin wrapper over an existing `Activity`. See
    docs/ARCHITECTURE.md § "Exams & Practice (Phase 6A)" for the full
    decision, including why this is a purpose-built domain rather than a
    repurposed `Assignment`/`AssignmentTask`.
    """

    __tablename__ = "question"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_uuid: str = Field(default="", index=True)
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    question_type: str
    prompt: str
    # Type-specific payload: {"options": [{"id", "text", "is_correct"}, ...]}
    # for multiple_choice, {"accepted_answers": [...]} for short_answer/
    # number_answer. Mirrors AssignmentTaskBase.contents's polymorphic-JSON
    # convention.
    contents: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    explanation: Optional[str] = None
    published: bool = Field(default=False)
    creation_date: str = ""
    update_date: str = ""
    subject: Optional[str] = None
    topic: Optional[str] = None
    level: Optional[str] = None
    institution_context: Optional[str] = None
