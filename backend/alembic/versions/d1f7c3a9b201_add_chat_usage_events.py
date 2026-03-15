"""add chat usage events

Revision ID: d1f7c3a9b201
Revises: c9d8e7f6a5b4
Create Date: 2026-03-14 21:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1f7c3a9b201"
down_revision: Union[str, Sequence[str], None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.create_index(op.f("ix_chat_usage_events_user_id"), "chat_usage_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_chat_usage_events_created_at"), "chat_usage_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_usage_events_created_at"), table_name="chat_usage_events")
    op.drop_index(op.f("ix_chat_usage_events_user_id"), table_name="chat_usage_events")
    op.drop_table("chat_usage_events")
