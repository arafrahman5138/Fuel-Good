"""add barcode column to product_label_scans

Revision ID: a4b5c6d7e8f9
Revises: 2e4861eab987
Create Date: 2026-04-02 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a4b5c6d7e8f9"
down_revision = "2e4861eab987"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_label_scans",
        sa.Column("barcode", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_product_label_scans_barcode",
        "product_label_scans",
        ["barcode"],
    )


def downgrade() -> None:
    op.drop_index("ix_product_label_scans_barcode", table_name="product_label_scans")
    op.drop_column("product_label_scans", "barcode")
