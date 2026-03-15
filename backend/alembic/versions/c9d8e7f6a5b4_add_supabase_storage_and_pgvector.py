"""add supabase storage and pgvector support

Revision ID: c9d8e7f6a5b4
Revises: 5f6d9d12c001, a1b2c3d4e5f6, a3b4c5d6e7f8
Create Date: 2026-03-14 11:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = ("5f6d9d12c001", "a1b2c3d4e5f6", "a3b4c5d6e7f8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("ALTER TABLE scanned_meal_logs ADD COLUMN IF NOT EXISTS image_bucket VARCHAR")
        op.execute("ALTER TABLE scanned_meal_logs ADD COLUMN IF NOT EXISTS image_path VARCHAR")
        op.execute("ALTER TABLE scanned_meal_logs ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR")
    else:
        existing_columns = {col["name"] for col in inspector.get_columns("scanned_meal_logs")}
        if "image_bucket" not in existing_columns:
            op.add_column("scanned_meal_logs", sa.Column("image_bucket", sa.String(), nullable=True))
        if "image_path" not in existing_columns:
            op.add_column("scanned_meal_logs", sa.Column("image_path", sa.String(), nullable=True))
        if "image_mime_type" not in existing_columns:
            op.add_column("scanned_meal_logs", sa.Column("image_mime_type", sa.String(), nullable=True))

    if "product_label_scans" not in set(inspector.get_table_names()):
        op.create_table(
            "product_label_scans",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("capture_type", sa.String(), nullable=True),
            sa.Column("image_url", sa.String(), nullable=True),
            sa.Column("image_bucket", sa.String(), nullable=True),
            sa.Column("image_path", sa.String(), nullable=True),
            sa.Column("image_mime_type", sa.String(), nullable=True),
            sa.Column("product_name", sa.String(), nullable=True),
            sa.Column("brand", sa.String(), nullable=True),
            sa.Column("ingredients_text", sa.String(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("confidence_breakdown", sa.JSON(), nullable=True),
            sa.Column("analysis", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    existing_indexes = {index["name"] for index in inspector.get_indexes("product_label_scans")} if "product_label_scans" in set(inspector.get_table_names()) else set()
    if op.f("ix_product_label_scans_user_id") not in existing_indexes:
        op.create_index(op.f("ix_product_label_scans_user_id"), "product_label_scans", ["user_id"], unique=False)

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE recipe_embeddings ADD COLUMN IF NOT EXISTS embedding vector(768)")
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_recipe_embeddings_embedding_ivfflat "
            "ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_recipe_embeddings_embedding_ivfflat")
        op.execute("ALTER TABLE recipe_embeddings DROP COLUMN IF EXISTS embedding")

    op.drop_index(op.f("ix_product_label_scans_user_id"), table_name="product_label_scans")
    op.drop_table("product_label_scans")

    op.drop_column("scanned_meal_logs", "image_mime_type")
    op.drop_column("scanned_meal_logs", "image_path")
    op.drop_column("scanned_meal_logs", "image_bucket")
