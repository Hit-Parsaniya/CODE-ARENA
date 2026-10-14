from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Float,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class Difficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class VerdictEnum(str, enum.Enum):
    pending = "Pending"
    accepted = "Accepted"
    wrong_answer = "Wrong Answer"
    time_limit_exceeded = "Time Limit Exceeded"
    runtime_error = "Runtime Error"
    compile_error = "Compile Error"
    internal_error = "Internal Error"


class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)          # Markdown
    difficulty = Column(
        SAEnum(Difficulty, name="difficulty_enum", create_type=False),
        nullable=False,
        index=True
    )
    tags = Column(JSON, nullable=False, default=list)   # e.g. ["array", "hash-map"]
    time_limit_ms = Column(Integer, nullable=False, default=2000)
    memory_limit_kb = Column(Integer, nullable=False, default=262144)  # 256 MB
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    test_cases = relationship("TestCase", cascade="all, delete-orphan", order_by="TestCase.id")

    @property
    def hidden_test_cases_count(self) -> int:
        """
        Count of TestCases with is_sample == False (hidden testcase).
        """
        if not self.test_cases:
            return 0
        return sum(1 for tc in self.test_cases if not tc.is_sample)

    @property
    def test_cases_count(self) -> int:
        """
        Total count of TestCases (sample + hidden).
        """
        if not self.test_cases:
            return 0
        return len(self.test_cases)

    @property
    def is_ready(self) -> bool:
        """
        True if the problem has at least 3 TestCases with is_sample == False (hidden testcase),
        False otherwise.
        """
        return self.hidden_test_cases_count >= 3

    def __repr__(self) -> str:
        return f"<Problem id={self.id} title={self.title!r} difficulty={self.difficulty} ready={self.is_ready}>"


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    problem_id = Column(
        Integer,
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    input = Column(Text, nullable=False, default="")
    expected_output = Column(Text, nullable=False)
    is_sample = Column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<TestCase id={self.id} problem_id={self.problem_id} sample={self.is_sample}>"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    problem_id = Column(
        Integer,
        ForeignKey("problems.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    code = Column(Text, nullable=False)
    language = Column(String(32), nullable=False)
    verdict = Column(String(64), nullable=False, default="Pending")
    score = Column(Float, nullable=False, default=0.0)   # 0.0 – 1.0 fraction of passing TCs
    sample_results = Column(JSON, nullable=False, default=list)
    ai_review = Column(JSON, nullable=True)
    submitted_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<Submission id={self.id} user={self.user_id} problem={self.problem_id} verdict={self.verdict!r}>"
