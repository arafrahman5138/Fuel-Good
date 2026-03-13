"""add pairing synergy profile to recipes

Revision ID: f7a8c1d2e4b5
Revises: d4e29c10b6af
Create Date: 2026-03-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8c1d2e4b5"
down_revision: Union[str, None] = "d4e29c10b6af"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("pairing_synergy_profile", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("recipes", "pairing_synergy_profile")
