"""Add metabolic profile safety flags (lactation / HTN / IBD / ED-recovery).

Revision ID: c7d8e9f0a1b2
Revises: b5c6d7e8f9a0
Create Date: 2026-04-16

Batch 2 of the fix plan (see tasks/persona-qa-report-2026-04-16.md findings
N1-N4). Adds 8 columns to `metabolic_profiles` so the onboarding can capture
physiological + life-stage states the app was unsafe for as-shipped:

  lactation  → calorie bonus (+350 kcal), overrides fat-loss deficit
  hypertension → sodium ceiling 1500 mg (AHA) overrides generic 2300
  IBD / low-residue → fiber floor inverted to 5 g (from ~25–30)
  ED recovery → frontend intuitive_mode = true (hide streaks/Fuel/targets)

All columns nullable or default False so existing rows are unaffected.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers
revision = "c7d8e9f0a1b2"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("metabolic_profiles")}

    columns_to_add = [
        sa.Column("lactating", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("months_postpartum", sa.Integer(), nullable=True),
        sa.Column("hypertension", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("systolic_mmhg", sa.Integer(), nullable=True),
        sa.Column("diastolic_mmhg", sa.Integer(), nullable=True),
        sa.Column("ibd_active_flare", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("low_residue_required", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("eating_disorder_recovery", sa.Boolean(), nullable=True, server_default=sa.text("false")),
    ]

    for column in columns_to_add:
        if column.name not in existing_columns:
            op.add_column("metabolic_profiles", column)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("metabolic_profiles")}

    for column_name in [
        "eating_disorder_recovery",
        "low_residue_required",
        "ibd_active_flare",
        "diastolic_mmhg",
        "systolic_mmhg",
        "hypertension",
        "months_postpartum",
        "lactating",
    ]:
        if column_name in existing_columns:
            op.drop_column("metabolic_profiles", column_name)
