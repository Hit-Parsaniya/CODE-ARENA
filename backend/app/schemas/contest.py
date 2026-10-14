from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class ContestProblemInput(BaseModel):
    problem_id: int = Field(gt=0)
    points: int = Field(gt=0)


class ContestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    start_time: datetime
    end_time: datetime
    visibility: str = Field(default="public", pattern=r"^(public|private)$")
    problems: list[ContestProblemInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_times_and_problems(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if self.problems and len({item.problem_id for item in self.problems}) != len(self.problems):
            raise ValueError("A problem may only appear once in a contest")
        return self


class ContestUpdate(ContestCreate):
    pass


class InviteEmailPayload(BaseModel):
    email: EmailStr = Field(..., description="Email address to invite to private contest")


class BulkInvitePayload(BaseModel):
    emails: list[str] = Field(default_factory=list, description="List of emails to invite")


class BulkInviteResponse(BaseModel):
    added: list[str]
    skipped_duplicates: list[str]
    invalid: list[str]


class ContestInviteResponse(BaseModel):
    contest_id: int
    invited_email: str
    invited_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ContestProblemResponse(BaseModel):
    problem_id: int
    title: str
    difficulty: str
    points: int
    is_ready: bool = False
    hidden_test_cases_count: int = 0
    test_cases_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class ContestProblemAttach(BaseModel):
    problem_id: int = Field(gt=0, description="Existing problem ID to attach")
    points: int = Field(default=100, gt=0, description="Points awarded for solving this problem in the contest")


class ContestSummary(BaseModel):
    id: int
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    visibility: str = "public"
    created_by: int
    model_config = ConfigDict(from_attributes=True)


class ContestDetail(ContestSummary):
    problems: list[ContestProblemResponse]


class ContestJoinResponse(BaseModel):
    contest_id: int
    joined: bool


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    total_points: float
    reached_score_at: datetime | None