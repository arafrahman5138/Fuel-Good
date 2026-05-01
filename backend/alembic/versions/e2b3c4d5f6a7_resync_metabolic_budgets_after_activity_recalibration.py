"""Re-sync metabolic_budgets after activity-multiplier recalibration.

Revision ID: e2b3c4d5f6a7
Revises: d1a2b3c4e5f6
Create Date: 2026-04-23

Activity multipliers were rebalanced so each tier's multiplier matches what
the onboarding label promised (see metabolic_engine.calc_tdee). This means
every existing user's cached `tdee` and `calorie_target_kcal` in
metabolic_budgets is now stale. Re-derive them from each user's profile.

Effect for a typical user with activity_level='active':
  before: tdee = bmr × 1.725  (e.g. 5'7" 165lb 26M ≈ 2910)
  after:  tdee = bmr × 1.55   (e.g. same user      ≈ 2615)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "e2b3c4d5f6a7"
down_revision = "d1a2b3c4e5f6"
branch_labels = None
depends_on = None


# Goal-based deficit/surplus modifiers shared by upgrade + downgrade.
_GOAL_CASE = """
    CASE LOWER(COALESCE(mp.goal, 'maintenance'))
        WHEN 'muscle_gain'     THEN 1.10
        WHEN 'gain'            THEN 1.10
        WHEN 'bulk'            THEN 1.10
        WHEN 'fat_loss'        THEN 0.80
        WHEN 'fat-loss'        THEN 0.80
        WHEN 'lose'            THEN 0.80
        WHEN 'cut'             THEN 0.80
        WHEN 'metabolic_reset' THEN 0.90
        ELSE                        1.00
    END
"""

_BMR_CASE = """
    CASE
        WHEN mp.sex = 'male'
            THEN 10 * (mp.weight_lb / 2.20462) + 6.25 * mp.height_cm - 5 * mp.age + 5
        ELSE 10 * (mp.weight_lb / 2.20462) + 6.25 * mp.height_cm - 5 * mp.age - 161
    END
"""

_NEW_ACTIVITY_CASE = """
    CASE LOWER(COALESCE(mp.activity_level, 'moderate'))
        WHEN 'sedentary'   THEN 1.2
        WHEN 'light'       THEN 1.375
        WHEN 'moderate'    THEN 1.375
        WHEN 'active'      THEN 1.55
        WHEN 'high'        THEN 1.725
        WHEN 'athletic'    THEN 1.725
        ELSE                    1.375
    END
"""

_OLD_ACTIVITY_CASE = """
    CASE LOWER(COALESCE(mp.activity_level, 'moderate'))
        WHEN 'sedentary'   THEN 1.2
        WHEN 'light'       THEN 1.55
        WHEN 'moderate'    THEN 1.55
        WHEN 'active'      THEN 1.725
        WHEN 'high'        THEN 1.9
        WHEN 'athletic'    THEN 1.9
        ELSE                    1.55
    END
"""


def _resync_sql(activity_case: str) -> str:
    return f"""
        UPDATE metabolic_budgets AS mb
        SET tdee = sub.new_tdee,
            calorie_target_kcal = sub.new_calorie_target,
            updated_at = NOW()
        FROM (
            SELECT
                mp.user_id,
                ROUND((({_BMR_CASE}) * ({activity_case}))::numeric, 1)::float8 AS new_tdee,
                ROUND((({_BMR_CASE}) * ({activity_case}) * ({_GOAL_CASE}))::numeric, 0)::int AS new_calorie_target
            FROM metabolic_profiles mp
            WHERE mp.weight_lb IS NOT NULL
              AND mp.weight_lb > 0
              AND mp.height_cm IS NOT NULL
              AND mp.height_cm > 0
              AND mp.age IS NOT NULL
              AND mp.age > 0
              AND mp.sex IS NOT NULL
        ) AS sub
        WHERE mb.user_id = sub.user_id;
    """


def upgrade() -> None:
    op.execute(sa.text(_resync_sql(_NEW_ACTIVITY_CASE)))


def downgrade() -> None:
    op.execute(sa.text(_resync_sql(_OLD_ACTIVITY_CASE)))
