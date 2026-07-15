"""Add components JSON to scanned_meal_logs

Persists the full extractor component detail (name/role/nova/methods/
mass_fraction) so ingredient-cache hits can recompute the same fuel score
as the fresh scan instead of synthesizing lossy components from bare names.

Revision ID: a9f3d1c27e40
Revises: e2b3c4d5f6a7
Create Date: 2026-07-11
"""
from alembic import op
import sqlalchemy as sa

revision = "a9f3d1c27e40"
down_revision = "e2b3c4d5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scanned_meal_logs", sa.Column("components", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("scanned_meal_logs", "components")
