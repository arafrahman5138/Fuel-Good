"""expand local_foods for owned catalog

Revision ID: 5f6d9d12c001
Revises: e1c4f2ad9b10
Create Date: 2026-03-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5f6d9d12c001"
down_revision: Union[str, None] = "e1c4f2ad9b10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("local_foods", sa.Column("brand", sa.String(), nullable=True))
    op.add_column("local_foods", sa.Column("source_kind", sa.String(), nullable=True, server_default="whole_food"))
    op.add_column("local_foods", sa.Column("aliases", sa.JSON(), nullable=True))
    op.add_column("local_foods", sa.Column("default_serving_label", sa.String(), nullable=True, server_default="1 serving"))
    op.add_column("local_foods", sa.Column("default_serving_grams", sa.Float(), nullable=True, server_default="100"))
    op.add_column("local_foods", sa.Column("serving_options", sa.JSON(), nullable=True))
    op.add_column("local_foods", sa.Column("nutrition_per_100g", sa.JSON(), nullable=True))
    op.add_column("local_foods", sa.Column("nutrition_per_serving", sa.JSON(), nullable=True))
    op.add_column("local_foods", sa.Column("mes_ready_nutrition", sa.JSON(), nullable=True))
    op.add_column("local_foods", sa.Column("micronutrients", sa.JSON(), nullable=True))
    op.add_column("local_foods", sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("local_foods", "is_active")
    op.drop_column("local_foods", "micronutrients")
    op.drop_column("local_foods", "mes_ready_nutrition")
    op.drop_column("local_foods", "nutrition_per_serving")
    op.drop_column("local_foods", "nutrition_per_100g")
    op.drop_column("local_foods", "serving_options")
    op.drop_column("local_foods", "default_serving_grams")
    op.drop_column("local_foods", "default_serving_label")
    op.drop_column("local_foods", "aliases")
    op.drop_column("local_foods", "source_kind")
    op.drop_column("local_foods", "brand")
