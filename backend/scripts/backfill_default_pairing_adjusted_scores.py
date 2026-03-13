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
from app.db import SessionLocal
from app.models.recipe import Recipe
from app.services.metabolic_engine import DEFAULT_COMPUTED_BUDGET, compute_meal_mes, compute_meal_mes_with_pairing


def main() -> None:
    session = SessionLocal()
    updated = 0
    try:
        meals = (
            session.query(Recipe)
            .filter(Recipe.recipe_role == "full_meal")
            .filter(Recipe.is_component.is_(False))
            .filter(Recipe.needs_default_pairing.is_(True))
            .all()
        )

        for meal in meals:
            nutrition = dict(meal.nutrition_info or {})
            default_pairing_id = nutrition.get("mes_default_pairing_id")
            pairing = None

            if default_pairing_id:
                pairing = session.query(Recipe).filter(Recipe.id == str(default_pairing_id)).first()

            if pairing is None:
                default_ids = getattr(meal, "default_pairing_ids", None) or []
                if not default_ids:
                    continue
                pairing = session.query(Recipe).filter(Recipe.id == str(default_ids[0])).first()

            if pairing is None:
                continue

            base_result = compute_meal_mes(nutrition, DEFAULT_COMPUTED_BUDGET)
            paired_result = compute_meal_mes_with_pairing(
                nutrition,
                pairing_recipe=pairing,
                budget=DEFAULT_COMPUTED_BUDGET,
                pairing_nutrition=pairing.nutrition_info or {},
            )

            macro_only = paired_result.get("macro_only_score") or paired_result["score"]
            adjusted = paired_result["score"]
            adjusted_total = round(float(adjusted["total_score"] or 0), 1)
            macro_only_total = round(float(macro_only["total_score"] or 0), 1)
            base_total = round(float(base_result["total_score"] or nutrition.get("mes_score") or 0), 1)

            nutrition["mes_score_with_default_pairing"] = macro_only_total
            nutrition["mes_default_pairing_adjusted_score"] = adjusted_total
            nutrition["mes_default_pairing_delta"] = round(adjusted_total - base_total, 1)
            nutrition["mes_default_pairing_synergy_bonus"] = float(paired_result.get("pairing_synergy_bonus") or 0)
            nutrition["mes_default_pairing_gis_bonus"] = float(paired_result.get("pairing_gis_bonus") or 0)
            nutrition["mes_default_pairing_id"] = str(pairing.id)
            nutrition["mes_default_pairing_title"] = pairing.title
            nutrition["mes_default_pairing_role"] = getattr(pairing, "recipe_role", None) or "veg_side"
            nutrition["mes_default_pairing_reasons"] = paired_result.get("pairing_reasons") or []

            meal.default_pairing_ids = [str(pairing.id)]
            meal.nutrition_info = nutrition
            updated += 1

        session.commit()
        print(f"Backfilled {updated} default-paired full meals.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
