from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Contest(Base):
    __tablename__ = "contests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False, index=True)
    visibility = Column(String(20), nullable=False, default="public", server_default="public")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class ContestProblem(Base):
    __tablename__ = "contest_problems"

    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    problem_id = Column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True)
    points = Column(Integer, nullable=False)


class ContestInvite(Base):
    __tablename__ = "contest_invites"

    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    invited_email = Column(String(255), primary_key=True, index=True, nullable=False)
    invited_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ContestParticipant(Base):
    __tablename__ = "contest_participants"

    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ContestSubmission(Base):
    __tablename__ = "contest_submissions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), nullable=False, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, unique=True)
    points_awarded = Column(Float, nullable=False, default=0)
    wrong_attempts_before_accept = Column(Integer, nullable=False, default=0)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)