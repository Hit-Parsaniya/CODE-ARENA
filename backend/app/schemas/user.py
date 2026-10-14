from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    # Allows login with either username or email
    username_or_email: str = Field(..., description="Username or Email address")
    password: str = Field(..., min_length=1)
    intended_role: Optional[str] = Field(None, description="Intended role from UI toggle for logging/analytics")


class UserResponse(UserBase):
    id: int
    role: str = "user"
    is_admin: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRoleUpdate(BaseModel):
    role: str = Field(..., pattern=r"^(admin|user)$", description="New user role: 'admin' or 'user'")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str
    exp: int


class UserStats(BaseModel):
    problems_solved: int
    total_submissions: int
    average_ai_score: float
    contests_entered: int


class BestScorePerProblem(BaseModel):
    problem_id: int
    problem_title: str
    difficulty: str
    best_score: float
    best_verdict: str
    attempts_count: int
    is_solved: bool
    last_attempted_at: datetime


class AIReviewTrendItem(BaseModel):
    submission_id: int
    date: datetime
    overall_score: float
    correctness: Optional[float] = None
    readability: Optional[float] = None
    efficiency: Optional[float] = None
    best_practices: Optional[float] = None
    problem_title: str


class ContestHistoryItem(BaseModel):
    contest_id: int
    contest_title: str
    start_time: datetime
    end_time: datetime
    rank: int
    total_points: float
    total_participants: int
    joined_at: Optional[datetime] = None


class SubmissionHistoryItem(BaseModel):
    id: int
    problem_id: int
    problem_title: str
    code: str
    language: str
    verdict: str
    score: float
    submitted_at: datetime
    ai_review: Optional[dict] = None


class PaginatedSubmissions(BaseModel):
    items: list[SubmissionHistoryItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime
    is_admin: bool = False
    stats: UserStats
    best_scores: list[BestScorePerProblem]
    ai_review_trend: list[AIReviewTrendItem]
    contest_history: list[ContestHistoryItem]
    submission_history: PaginatedSubmissions

    model_config = ConfigDict(from_attributes=True)

