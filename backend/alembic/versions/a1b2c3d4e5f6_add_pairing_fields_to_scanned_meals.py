"""add pairing fields to scanned meals

Revision ID: a1b2c3d4e5f6
Revises: f7a8c1d2e4b5
Create Date: 2026-03-12 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7a8c1d2e4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scanned_meal_logs", sa.Column("pairing_opportunity", sa.Boolean(), nullable=True))
    op.add_column("scanned_meal_logs", sa.Column("pairing_recommended_recipe_id", sa.String(), nullable=True))
    op.add_column("scanned_meal_logs", sa.Column("pairing_recommended_title", sa.String(), nullable=True))
    op.add_column("scanned_meal_logs", sa.Column("pairing_projected_mes", sa.Float(), nullable=True))
    op.add_column("scanned_meal_logs", sa.Column("pairing_projected_delta", sa.Float(), nullable=True))
    op.add_column("scanned_meal_logs", sa.Column("pairing_reasons", sa.JSON(), nullable=True))
    op.add_column("scanned_meal_logs", sa.Column("pairing_timing", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("scanned_meal_logs", "pairing_timing")
    op.drop_column("scanned_meal_logs", "pairing_reasons")
    op.drop_column("scanned_meal_logs", "pairing_projected_delta")
    op.drop_column("scanned_meal_logs", "pairing_projected_mes")
    op.drop_column("scanned_meal_logs", "pairing_recommended_title")
    op.drop_column("scanned_meal_logs", "pairing_recommended_recipe_id")
    op.drop_column("scanned_meal_logs", "pairing_opportunity")
