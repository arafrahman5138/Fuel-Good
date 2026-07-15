"""enforce cascade FKs for account deletion

Revision ID: e5f6a7b8c9d0
Revises: a9f3d1c27e40
Create Date: 2026-07-11 10:00:00.000000

DELETE /api/auth/account relies on DB-level ON DELETE rules (the User
relationships use passive_deletes=True), but databases bootstrapped from
ORM metadata (Base.metadata.create_all) and then stamped got plain RESTRICT
FKs — 2e4861eab987 / c7d8e9f0a1b2 never actually ran there, so deletion
500s with ForeignKeyViolation (observed on xp_transactions).

This migration re-applies the delete rules idempotently on every child FK:
1. Every user_id FK gets ON DELETE CASCADE (including scan_favorites, which
   c7d8e9f0a1b2 covers on migrated DBs but stamped DBs are missing).
2. Nested FKs: meal_plan_items.meal_plan_id cascades with its plan; the
   nullable references (grocery_lists.meal_plan_id,
   notification_deliveries.push_token_id, scanned_meal_logs.logged_food_log_id,
   metabolic_scores.food_log_id) get ON DELETE SET NULL so those rows survive
   their parent's deletion.

Constraint names are resolved via inspector.get_foreign_keys() first (some
deploys have auto-generated names), falling back to the conventional
<table>_<column>_fkey. Looking the name up before dropping — instead of
dropping in a try/except — keeps the transactional DDL from aborting when
the conventional name doesn't exist.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "a9f3d1c27e40"
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
    "scan_favorites",
    "scanned_meal_logs",
    "user_achievements",
    "user_push_tokens",
    "weekly_fuel_summaries",
    "xp_transactions",
]

# Non-user FKs: (table, column, referent_table, ondelete).
# CASCADE where the child row is meaningless without its parent
# (meal_plan_items); SET NULL where the column is nullable and the row
# should survive its parent's deletion.
_NESTED_FKS = [
    ("meal_plan_items", "meal_plan_id", "meal_plans", "CASCADE"),
    ("grocery_lists", "meal_plan_id", "meal_plans", "SET NULL"),
    ("notification_deliveries", "push_token_id", "user_push_tokens", "SET NULL"),
    ("scanned_meal_logs", "logged_food_log_id", "food_logs", "SET NULL"),
    ("metabolic_scores", "food_log_id", "food_logs", "SET NULL"),
]


def _recreate_fk(
    table: str,
    column: str,
    referent: str,
    ondelete: Union[str, None],
) -> None:
    """Drop the FK on table.column (whatever it is named) and recreate it
    with the given ON DELETE rule (None = plain FK, for downgrade)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        return
    fk_name = f"{table}_{column}_fkey"
    # FK may have a different auto-generated name on some deploys — prefer
    # the name the database actually reports.
    for fk in inspector.get_foreign_keys(table):
        if fk.get("constrained_columns") == [column] and fk.get("name"):
            fk_name = fk["name"]
            op.drop_constraint(fk_name, table, type_="foreignkey")
            break
    op.create_foreign_key(
        f"{table}_{column}_fkey",
        table,
        referent,
        [column],
        ["id"],
        ondelete=ondelete,
    )


def upgrade() -> None:
    for table in _USER_FK_TABLES:
        _recreate_fk(table, "user_id", "users", "CASCADE")
    for table, column, referent, ondelete in _NESTED_FKS:
        _recreate_fk(table, column, referent, ondelete)


def downgrade() -> None:
    for table, column, referent, _ondelete in _NESTED_FKS:
        _recreate_fk(table, column, referent, None)
    for table in _USER_FK_TABLES:
        _recreate_fk(table, "user_id", "users", None)
