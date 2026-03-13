"""add scan guidance fields

Revision ID: e1c4f2ad9b10
Revises: 7d2c4b9e3a11
Create Date: 2026-03-08 17:05:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e1c4f2ad9b10"
down_revision = "7d2c4b9e3a11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scanned_meal_logs",
        sa.Column("upgrade_suggestions", sa.JSON(), nullable=True),
    )
    op.add_column(
        "scanned_meal_logs",
        sa.Column("recovery_plan", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scanned_meal_logs", "recovery_plan")
    op.drop_column("scanned_meal_logs", "upgrade_suggestions")
