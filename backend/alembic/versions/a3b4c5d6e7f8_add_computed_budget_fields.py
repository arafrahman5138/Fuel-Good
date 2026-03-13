"""add computed budget fields to metabolic_budgets

Adds fat_target_g, tdee, calorie_target_kcal, ism, tier_thresholds_json
so the ORM budget can carry full personalization from the engine.

Revision ID: a3b4c5d6e7f8
Revises: f7a8c1d2e4b5
Create Date: 2026-03-12 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f7a8c1d2e4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("metabolic_budgets")}

    if "fat_target_g" not in existing:
        op.add_column("metabolic_budgets", sa.Column("fat_target_g", sa.Float(), nullable=True))
    if "tdee" not in existing:
        op.add_column("metabolic_budgets", sa.Column("tdee", sa.Float(), nullable=True))
    if "calorie_target_kcal" not in existing:
        op.add_column("metabolic_budgets", sa.Column("calorie_target_kcal", sa.Float(), nullable=True))
    if "ism" not in existing:
        op.add_column("metabolic_budgets", sa.Column("ism", sa.Float(), server_default=sa.text("1.0"), nullable=True))
    if "tier_thresholds_json" not in existing:
        op.add_column("metabolic_budgets", sa.Column("tier_thresholds_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("metabolic_budgets", "tier_thresholds_json")
    op.drop_column("metabolic_budgets", "ism")
    op.drop_column("metabolic_budgets", "calorie_target_kcal")
    op.drop_column("metabolic_budgets", "tdee")
    op.drop_column("metabolic_budgets", "fat_target_g")
