from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Difficulty = Literal["easy", "medium", "hard"]


class ProblemFields(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    difficulty: Difficulty
    tags: list[str] = Field(default_factory=list)
    time_limit_ms: int = Field(default=2000, gt=0, le=300000)
    memory_limit_kb: int = Field(default=262144, gt=0, le=1048576)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        if isinstance(v, list):
            return [str(t).strip() for t in v if str(t).strip()]
        return []


class ProblemCreate(ProblemFields):
    pass


class ProblemUpdate(ProblemFields):
    pass


class TestCaseCreate(BaseModel):
    input: str
    expected_output: str
    is_sample: bool = False


class TestCaseUpdate(TestCaseCreate):
    pass


class TestCaseAdmin(TestCaseCreate):
    id: int
    problem_id: int
    model_config = ConfigDict(from_attributes=True)


class SampleTestCase(BaseModel):
    id: int
    input: str
    expected_output: str
    is_sample: bool = True
    model_config = ConfigDict(from_attributes=True)


class ProblemSummary(ProblemFields):
    id: int
    created_by: int
    created_at: datetime
    is_ready: bool = False
    hidden_test_cases_count: int = 0
    test_cases_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class ProblemDetail(ProblemSummary):
    sample_test_cases: list[SampleTestCase]


class SubmissionCreate(BaseModel):
    problem_id: int = Field(gt=0, description="Target problem ID")
    code: str = Field(
        ...,
        min_length=1,
        max_length=20000,
        description="Source code (max 20,000 characters)"
    )
    language: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Programming language (whitelist: python, c, cpp, java)"
    )

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Source code cannot be empty or whitespace only.")
        return v


class SampleTestResult(BaseModel):
    test_case_id: int
    input: str
    expected_output: str
    actual_output: str | None
    passed: bool


class AIReview(BaseModel):
    correctness: int = Field(ge=1, le=10)
    readability: int = Field(ge=1, le=10)
    efficiency: int = Field(ge=1, le=10)
    best_practices: int = Field(ge=1, le=10)
    overall_score: float = Field(ge=1, le=10)
    feedback: str = Field(min_length=1)


class SubmissionResponse(BaseModel):
    id: int
    user_id: int
    problem_id: int
    code: str
    language: str
    verdict: str
    score: float
    submitted_at: datetime
    sample_results: list[SampleTestResult]
    ai_review: AIReview | None = None
    model_config = ConfigDict(from_attributes=True)