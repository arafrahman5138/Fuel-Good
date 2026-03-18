"""add recipe glycemic profile

Revision ID: c4d5e6f7a8b9
Revises: d1f7c3a9b201
Create Date: 2026-03-16 15:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "d1f7c3a9b201"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("recipes")}
    if "glycemic_profile" not in columns:
        op.add_column("recipes", sa.Column("glycemic_profile", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("recipes")}
    if "glycemic_profile" in columns:
        op.drop_column("recipes", "glycemic_profile")
