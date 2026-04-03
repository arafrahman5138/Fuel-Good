"""add scan_favorites table

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-04-02 13:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "b5c6d7e8f9a0"
down_revision = "a4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())
    if "scan_favorites" in table_names:
        return

    op.create_table(
        "scan_favorites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("scan_type", sa.String(), nullable=False),
        sa.Column("source_scan_id", sa.String(36), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("ingredients", sa.JSON(), nullable=True),
        sa.Column("nutrition_snapshot", sa.JSON(), nullable=True),
        sa.Column("fuel_score", sa.Float(), nullable=True),
        sa.Column("whole_food_status", sa.String(), nullable=True),
        sa.Column("image_bucket", sa.String(), nullable=True),
        sa.Column("image_path", sa.String(), nullable=True),
        sa.Column("image_mime_type", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("barcode", sa.String(), nullable=True),
        sa.Column("brand", sa.String(), nullable=True),
        sa.Column("product_tier", sa.String(), nullable=True),
        sa.Column("product_analysis", sa.JSON(), nullable=True),
        sa.Column("meal_type", sa.String(), nullable=True),
        sa.Column("portion_size", sa.String(), nullable=True),
        sa.Column("source_context", sa.String(), nullable=True),
        sa.Column("use_count", sa.Integer(), default=0),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())
    if "scan_favorites" in table_names:
        op.drop_table("scan_favorites")
