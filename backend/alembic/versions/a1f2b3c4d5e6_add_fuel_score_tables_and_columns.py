"""add fuel score tables and columns

Revision ID: a1f2b3c4d5e6
Revises: d1f7c3a9b201
Create Date: 2026-03-15 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a1f2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "d1f7c3a9b201"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    def has_column(table_name: str, column_name: str) -> bool:
        return column_name in {column["name"] for column in inspector.get_columns(table_name)}

    if not has_column("food_logs", "fuel_score"):
        op.add_column("food_logs", sa.Column("fuel_score", sa.Float(), nullable=True))

    if not has_column("recipes", "fuel_score"):
        op.add_column("recipes", sa.Column("fuel_score", sa.Float(), nullable=True))

    if not has_column("scanned_meal_logs", "fuel_score"):
        op.add_column("scanned_meal_logs", sa.Column("fuel_score", sa.Float(), nullable=True))

    if not has_column("users", "fuel_target"):
        op.add_column("users", sa.Column("fuel_target", sa.Integer(), nullable=True))
    if not has_column("users", "expected_meals_per_week"):
        op.add_column("users", sa.Column("expected_meals_per_week", sa.Integer(), nullable=True))

    table_names = set(inspector.get_table_names())

    if "daily_fuel_summaries" not in table_names:
        op.create_table(
            "daily_fuel_summaries",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("avg_fuel_score", sa.Float(), default=0.0),
            sa.Column("meal_count", sa.Integer(), default=0),
            sa.Column("total_score_points", sa.Float(), default=0.0),
            sa.Column("created_at", sa.DateTime()),
            sa.Column("updated_at", sa.DateTime()),
            sa.UniqueConstraint("user_id", "date", name="uq_daily_fuel_user_date"),
        )
    if "weekly_fuel_summaries" not in table_names:
        op.create_table(
            "weekly_fuel_summaries",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("week_start", sa.Date(), nullable=False),
            sa.Column("avg_fuel_score", sa.Float(), default=0.0),
            sa.Column("meal_count", sa.Integer(), default=0),
            sa.Column("total_score_points", sa.Float(), default=0.0),
            sa.Column("flex_meals_used", sa.Integer(), default=0),
            sa.Column("flex_budget_total", sa.Float(), default=0.0),
            sa.Column("flex_budget_remaining", sa.Float(), default=0.0),
            sa.Column("target_met", sa.Boolean(), default=False),
            sa.Column("streak_weeks", sa.Integer(), default=0),
            sa.Column("created_at", sa.DateTime()),
            sa.Column("updated_at", sa.DateTime()),
            sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_fuel_user_week"),
        )

    daily_indexes = {index["name"] for index in inspector.get_indexes("daily_fuel_summaries")} if "daily_fuel_summaries" in set(inspector.get_table_names()) else set()
    if op.f("ix_daily_fuel_summaries_user_id") not in daily_indexes:
        op.create_index(op.f("ix_daily_fuel_summaries_user_id"), "daily_fuel_summaries", ["user_id"], unique=False)
    if op.f("ix_daily_fuel_summaries_date") not in daily_indexes:
        op.create_index(op.f("ix_daily_fuel_summaries_date"), "daily_fuel_summaries", ["date"], unique=False)

    weekly_indexes = {index["name"] for index in inspector.get_indexes("weekly_fuel_summaries")} if "weekly_fuel_summaries" in set(inspector.get_table_names()) else set()
    if op.f("ix_weekly_fuel_summaries_user_id") not in weekly_indexes:
        op.create_index(op.f("ix_weekly_fuel_summaries_user_id"), "weekly_fuel_summaries", ["user_id"], unique=False)
    if op.f("ix_weekly_fuel_summaries_week_start") not in weekly_indexes:
        op.create_index(op.f("ix_weekly_fuel_summaries_week_start"), "weekly_fuel_summaries", ["week_start"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    table_names = set(inspector.get_table_names())
    if "weekly_fuel_summaries" in table_names:
        weekly_indexes = {index["name"] for index in inspector.get_indexes("weekly_fuel_summaries")}
        if op.f("ix_weekly_fuel_summaries_week_start") in weekly_indexes:
            op.drop_index(op.f("ix_weekly_fuel_summaries_week_start"), table_name="weekly_fuel_summaries")
        if op.f("ix_weekly_fuel_summaries_user_id") in weekly_indexes:
            op.drop_index(op.f("ix_weekly_fuel_summaries_user_id"), table_name="weekly_fuel_summaries")
        op.drop_table("weekly_fuel_summaries")
    if "daily_fuel_summaries" in table_names:
        daily_indexes = {index["name"] for index in inspector.get_indexes("daily_fuel_summaries")}
        if op.f("ix_daily_fuel_summaries_date") in daily_indexes:
            op.drop_index(op.f("ix_daily_fuel_summaries_date"), table_name="daily_fuel_summaries")
        if op.f("ix_daily_fuel_summaries_user_id") in daily_indexes:
            op.drop_index(op.f("ix_daily_fuel_summaries_user_id"), table_name="daily_fuel_summaries")
        op.drop_table("daily_fuel_summaries")

    if "expected_meals_per_week" in {column["name"] for column in inspector.get_columns("users")}:
        op.drop_column("users", "expected_meals_per_week")
    if "fuel_target" in {column["name"] for column in inspector.get_columns("users")}:
        op.drop_column("users", "fuel_target")
    if "fuel_score" in {column["name"] for column in inspector.get_columns("scanned_meal_logs")}:
        op.drop_column("scanned_meal_logs", "fuel_score")
    if "fuel_score" in {column["name"] for column in inspector.get_columns("recipes")}:
        op.drop_column("recipes", "fuel_score")
    if "fuel_score" in {column["name"] for column in inspector.get_columns("food_logs")}:
        op.drop_column("food_logs", "fuel_score")
