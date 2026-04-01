"""add_password_reset_attempts_and_cascade_delete

Revision ID: 2e4861eab987
Revises: b1c2d3e4f5a6
Create Date: 2026-03-30 19:35:04.548290

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = '2e4861eab987'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every table with a user_id FK that needs ON DELETE CASCADE at DB level.
_USER_FK_TABLES = [
    "chat_sessions",
    "chat_usage_events",
    "daily_fuel_summaries",
    "daily_nutrition_summary",
    "daily_quests",
    "food_logs",
    "grocery_lists",
    "meal_plans",
    "metabolic_budgets",
    "metabolic_profiles",
    "metabolic_scores",
    "metabolic_streaks",
    "notification_deliveries",
    "notification_events",
    "notification_preferences",
    "nutrition_streaks",
    "nutrition_targets",
    "product_label_scans",
    "saved_recipes",
    "scanned_meal_logs",
    "user_achievements",
    "user_push_tokens",
    "weekly_fuel_summaries",
    "xp_transactions",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_reset_attempts" not in user_columns:
        op.add_column('users', sa.Column('password_reset_attempts', sa.Integer(), nullable=True))

    for table in _USER_FK_TABLES:
        fk_name = f"{table}_user_id_fkey"
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, "users", ["user_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_reset_attempts" in user_columns:
        op.drop_column('users', 'password_reset_attempts')

    for table in _USER_FK_TABLES:
        fk_name = f"{table}_user_id_fkey"
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, "users", ["user_id"], ["id"])
