"""add cascade delete for scan_favorites and notification retry fields

Revision ID: c7d8e9f0a1b2
Revises: b5c6d7e8f9a0
Create Date: 2026-04-16 17:00:00.000000

Two changes bundled because both are iOS-submission prep:
1. scan_favorites.user_id FK is missing ON DELETE CASCADE. Without this the
   Delete Account flow fails for any user with saved favorites, violating
   App Store Guideline 5.1.1(v).
2. notification_deliveries gains retry_count / next_retry_at so transient
   APNs failures are retried instead of silently dropped. These columns are
   already added opportunistically in ensure_legacy_schema_columns, but we
   want them to come in via Alembic on fresh databases too.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # ── 1. scan_favorites cascade ────────────────────────────────────────
    if "scan_favorites" in inspector.get_table_names():
        fk_name = "scan_favorites_user_id_fkey"
        try:
            op.drop_constraint(fk_name, "scan_favorites", type_="foreignkey")
        except Exception:
            # FK may have a different auto-generated name on some deploys.
            existing = inspector.get_foreign_keys("scan_favorites")
            for fk in existing:
                if fk.get("constrained_columns") == ["user_id"]:
                    op.drop_constraint(fk["name"], "scan_favorites", type_="foreignkey")
                    break
        op.create_foreign_key(
            fk_name,
            "scan_favorites",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # ── 2. notification_deliveries retry columns ────────────────────────
    if "notification_deliveries" in inspector.get_table_names():
        columns = {col["name"] for col in inspector.get_columns("notification_deliveries")}
        if "retry_count" not in columns:
            op.add_column(
                "notification_deliveries",
                sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
            )
            # Drop the server_default so the ORM default (0) governs going forward.
            op.alter_column("notification_deliveries", "retry_count", server_default=None)
        if "next_retry_at" not in columns:
            op.add_column(
                "notification_deliveries",
                sa.Column("next_retry_at", sa.DateTime(), nullable=True),
            )
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("notification_deliveries")}
        if "ix_notification_deliveries_next_retry_at" not in existing_indexes:
            op.create_index(
                "ix_notification_deliveries_next_retry_at",
                "notification_deliveries",
                ["next_retry_at"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Revert notification_deliveries additions.
    if "notification_deliveries" in inspector.get_table_names():
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("notification_deliveries")}
        if "ix_notification_deliveries_next_retry_at" in existing_indexes:
            op.drop_index(
                "ix_notification_deliveries_next_retry_at",
                table_name="notification_deliveries",
            )
        columns = {col["name"] for col in inspector.get_columns("notification_deliveries")}
        if "next_retry_at" in columns:
            op.drop_column("notification_deliveries", "next_retry_at")
        if "retry_count" in columns:
            op.drop_column("notification_deliveries", "retry_count")

    # Revert scan_favorites cascade.
    if "scan_favorites" in inspector.get_table_names():
        fk_name = "scan_favorites_user_id_fkey"
        try:
            op.drop_constraint(fk_name, "scan_favorites", type_="foreignkey")
        except Exception:
            existing = inspector.get_foreign_keys("scan_favorites")
            for fk in existing:
                if fk.get("constrained_columns") == ["user_id"]:
                    op.drop_constraint(fk["name"], "scan_favorites", type_="foreignkey")
                    break
        op.create_foreign_key(
            fk_name,
            "scan_favorites",
            "users",
            ["user_id"],
            ["id"],
        )
