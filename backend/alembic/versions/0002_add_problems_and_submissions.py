"""add problems, test cases, submissions, and admin flag

Revision ID: 0002_add_problems_and_submissions
Revises: 0001_create_users_table
Create Date: 2026-09-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_add_problems_and_submissions"
down_revision: Union[str, None] = "0001_create_users_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_table(
        "problems",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("difficulty", sa.Enum("easy", "medium", "hard", name="difficulty_enum"), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("time_limit_ms", sa.Integer(), nullable=False),
        sa.Column("memory_limit_kb", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_problems_id"), "problems", ["id"], unique=False)
    op.create_index(op.f("ix_problems_title"), "problems", ["title"], unique=False)
    op.create_index(op.f("ix_problems_difficulty"), "problems", ["difficulty"], unique=False)
    op.create_table(
        "test_cases",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column("input", sa.Text(), nullable=False),
        sa.Column("expected_output", sa.Text(), nullable=False),
        sa.Column("is_sample", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_test_cases_id"), "test_cases", ["id"], unique=False)
    op.create_index(op.f("ix_test_cases_problem_id"), "test_cases", ["problem_id"], unique=False)
    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=32), nullable=False),
        sa.Column("verdict", sa.String(length=64), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("sample_results", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_submissions_id"), "submissions", ["id"], unique=False)
    op.create_index(op.f("ix_submissions_user_id"), "submissions", ["user_id"], unique=False)
    op.create_index(op.f("ix_submissions_problem_id"), "submissions", ["problem_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_submissions_user_id"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_problem_id"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_id"), table_name="submissions")
    op.drop_table("submissions")
    op.drop_index(op.f("ix_test_cases_id"), table_name="test_cases")
    op.drop_index(op.f("ix_test_cases_problem_id"), table_name="test_cases")
    op.drop_table("test_cases")
    op.drop_index(op.f("ix_problems_id"), table_name="problems")
    op.drop_index(op.f("ix_problems_title"), table_name="problems")
    op.drop_index(op.f("ix_problems_difficulty"), table_name="problems")
    op.drop_table("problems")
    op.drop_column("users", "is_admin")
    sa.Enum(name="difficulty_enum").drop(op.get_bind(), checkfirst=True)