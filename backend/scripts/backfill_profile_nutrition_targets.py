#!/usr/bin/env python3
from __future__ import annotations

import app.models.user  # noqa: F401
import app.models.metabolic  # noqa: F401
import app.models.metabolic_profile  # noqa: F401
import app.models.nutrition  # noqa: F401
import app.models.meal_plan  # noqa: F401
import app.models.gamification  # noqa: F401
import app.models.grocery  # noqa: F401
import app.models.saved_recipe  # noqa: F401
import app.models.local_food  # noqa: F401
import app.models.scanned_meal  # noqa: F401
import app.models.notification  # noqa: F401
import app.models.recipe_embedding  # noqa: F401
from sqlalchemy.exc import OperationalError
from app.db import SessionLocal
from app.models.metabolic import MetabolicBudget
from app.models.metabolic_profile import MetabolicProfile
from app.models.nutrition import NutritionTarget
from app.services.metabolic_engine import derive_protein_target_g, derive_sugar_ceiling, load_budget_for_user


def main() -> None:
    session = SessionLocal()
    updated = 0

    try:
        try:
            profiles = session.query(MetabolicProfile).all()
        except OperationalError as exc:
            print(f"Skipped backfill: metabolic profile tables are not available in the current DB ({exc.__class__.__name__}).")
            return

        for profile in profiles:
            if not profile.user_id or profile.weight_lb is None:
                continue

            profile_dict = {
                "sex": profile.sex,
                "age": getattr(profile, "age", None),
                "weight_lb": profile.weight_lb,
                "goal": profile.goal,
                "target_weight_lb": profile.target_weight_lb,
                "body_fat_pct": profile.body_fat_pct,
                "height_cm": profile.height_cm,
            }

            profile.protein_target_g = derive_protein_target_g(profile_dict)

            budget_row = (
                session.query(MetabolicBudget)
                .filter(MetabolicBudget.user_id == profile.user_id)
                .first()
            )
            if budget_row is None:
                budget_row = MetabolicBudget(user_id=profile.user_id)
                session.add(budget_row)

            budget_row.protein_target_g = profile.protein_target_g
            budget_row.sugar_ceiling_g = derive_sugar_ceiling(profile_dict)

            computed = load_budget_for_user(session, profile.user_id)
            target_row = (
                session.query(NutritionTarget)
                .filter(NutritionTarget.user_id == profile.user_id)
                .first()
            )
            if target_row is None:
                target_row = NutritionTarget(user_id=profile.user_id)
                session.add(target_row)

            target_row.calories_target = round(float(computed.calorie_target_kcal or computed.tdee or 0), 1)
            target_row.protein_g_target = round(float(computed.protein_g or 0), 1)
            target_row.carbs_g_target = round(float(computed.carb_ceiling_g or 0), 1)
            target_row.fat_g_target = round(float(computed.fat_g or 0), 1)
            target_row.fiber_g_target = round(float(computed.fiber_g or 0), 1)

            updated += 1

        session.commit()
        print(f"Backfilled profile-driven nutrition targets for {updated} users.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
