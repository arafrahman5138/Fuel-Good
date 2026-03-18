"""add chat usage events

Revision ID: d1f7c3a9b201
Revises: c9d8e7f6a5b4
Create Date: 2026-03-14 21:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "d1f7c3a9b201"
down_revision: Union[str, Sequence[str], None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "chat_usage_events" not in table_names:
        op.create_table(
            "chat_usage_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("route", sa.String(), nullable=False),
            sa.Column("response_mode", sa.String(), nullable=False),
            sa.Column("cost_units", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        existing_columns = {column["name"] for column in inspector.get_columns("chat_usage_events")}
        missing_columns = (
            ("id", sa.String(length=36), False),
            ("user_id", sa.String(length=36), False),
            ("route", sa.String(), False),
            ("response_mode", sa.String(), False),
            ("cost_units", sa.Float(), False),
            ("created_at", sa.DateTime(), False),
        )
        for column_name, column_type, nullable in missing_columns:
            if column_name not in existing_columns:
                op.add_column("chat_usage_events", sa.Column(column_name, column_type, nullable=nullable))

    existing_indexes = {index["name"] for index in inspector.get_indexes("chat_usage_events")}
    if op.f("ix_chat_usage_events_user_id") not in existing_indexes:
        op.create_index(op.f("ix_chat_usage_events_user_id"), "chat_usage_events", ["user_id"], unique=False)
    if op.f("ix_chat_usage_events_created_at") not in existing_indexes:
        op.create_index(op.f("ix_chat_usage_events_created_at"), "chat_usage_events", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())

    if "chat_usage_events" not in table_names:
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("chat_usage_events")}
    if op.f("ix_chat_usage_events_created_at") in existing_indexes:
        op.drop_index(op.f("ix_chat_usage_events_created_at"), table_name="chat_usage_events")
    if op.f("ix_chat_usage_events_user_id") in existing_indexes:
        op.drop_index(op.f("ix_chat_usage_events_user_id"), table_name="chat_usage_events")
    op.drop_table("chat_usage_events")
