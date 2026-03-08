"""add scanned meal logs

Revision ID: 7d2c4b9e3a11
Revises: f2c1d8b7a001
Create Date: 2026-03-07 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d2c4b9e3a11"
down_revision: Union[str, None] = "b7e2a5f31c09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scanned_meal_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("meal_label", sa.String(), nullable=False),
        sa.Column("scan_mode", sa.String(), nullable=True),
        sa.Column("meal_context", sa.String(), nullable=True),
        sa.Column("meal_type", sa.String(), nullable=True),
        sa.Column("portion_size", sa.String(), nullable=True),
        sa.Column("source_context", sa.String(), nullable=True),
        sa.Column("estimated_ingredients", sa.JSON(), nullable=True),
        sa.Column("normalized_ingredients", sa.JSON(), nullable=True),
        sa.Column("nutrition_estimate", sa.JSON(), nullable=True),
        sa.Column("whole_food_status", sa.String(), nullable=True),
        sa.Column("whole_food_flags", sa.JSON(), nullable=True),
        sa.Column("suggested_swaps", sa.JSON(), nullable=True),
        sa.Column("mes_score", sa.Float(), nullable=True),
        sa.Column("mes_tier", sa.String(), nullable=True),
        sa.Column("mes_sub_scores", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("confidence_breakdown", sa.JSON(), nullable=True),
        sa.Column("source_model", sa.String(), nullable=True),
        sa.Column("matched_recipe_id", sa.String(), nullable=True),
        sa.Column("logged_food_log_id", sa.String(length=36), nullable=True),
        sa.Column("logged_to_chronometer", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["logged_food_log_id"], ["food_logs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scanned_meal_logs_user_id"), "scanned_meal_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scanned_meal_logs_user_id"), table_name="scanned_meal_logs")
    op.drop_table("scanned_meal_logs")
