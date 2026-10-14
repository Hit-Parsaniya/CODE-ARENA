"""add AI review to submissions

Revision ID: 0003_add_ai_review_to_submissions
Revises: 0002_add_problems_and_submissions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_add_ai_review_to_submissions"
down_revision: Union[str, None] = "0002_add_problems_and_submissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("ai_review", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "ai_review")