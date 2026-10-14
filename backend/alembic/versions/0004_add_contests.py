"""add contests and contest submissions

Revision ID: 0004_add_contests
Revises: 0003_add_ai_review_to_submissions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_add_contests"
down_revision: Union[str, None] = "0003_add_ai_review_to_submissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contests_id", "contests", ["id"], unique=False)
    op.create_index("ix_contests_start_time", "contests", ["start_time"], unique=False)
    op.create_index("ix_contests_end_time", "contests", ["end_time"], unique=False)
    op.create_table(
        "contest_problems",
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("problem_id", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("contest_id", "problem_id"),
    )
    op.create_table(
        "contest_participants",
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("contest_id", "user_id"),
    )
    op.create_table(
        "contest_submissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("contest_id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("points_awarded", sa.Float(), nullable=False),
        sa.Column("wrong_attempts_before_accept", sa.Integer(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["contest_id"], ["contests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("submission_id"),
    )
    op.create_index("ix_contest_submissions_id", "contest_submissions", ["id"], unique=False)
    op.create_index("ix_contest_submissions_contest_id", "contest_submissions", ["contest_id"], unique=False)
    op.create_index("ix_contest_submissions_submitted_at", "contest_submissions", ["submitted_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_contest_submissions_submitted_at", table_name="contest_submissions")
    op.drop_index("ix_contest_submissions_contest_id", table_name="contest_submissions")
    op.drop_index("ix_contest_submissions_id", table_name="contest_submissions")
    op.drop_table("contest_submissions")
    op.drop_table("contest_participants")
    op.drop_table("contest_problems")
    op.drop_index("ix_contests_end_time", table_name="contests")
    op.drop_index("ix_contests_start_time", table_name="contests")
    op.drop_index("ix_contests_id", table_name="contests")
    op.drop_table("contests")