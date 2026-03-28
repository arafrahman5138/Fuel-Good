"""add clean_eating_pct to users

Revision ID: b1c2d3e4f5a6
Revises: a1f2b3c4d5e6, c4d5e6f7a8b9
Create Date: 2026-03-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = ("a1f2b3c4d5e6", "c4d5e6f7a8b9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    if "clean_eating_pct" not in existing_columns:
        op.add_column("users", sa.Column("clean_eating_pct", sa.Integer(), nullable=True, server_default="80"))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    if "clean_eating_pct" in existing_columns:
        op.drop_column("users", "clean_eating_pct")
