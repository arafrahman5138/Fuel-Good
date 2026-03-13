"""Audit metabolic targets across a broad profile matrix.

Run with:
PYTHONPATH=backend python3 backend/scripts/audit_metabolic_profiles.py
"""
from __future__ import annotations

import itertools
import json

from app.services.metabolic_engine import (
    ActivityLevel,
    Goal,
    MetabolicProfileInput,
    build_metabolic_budget,
    calc_protein_target_g,
    derive_protein_target_g,
)


WEIGHTS = [110, 130, 165, 200, 260, 320]
HEIGHTS = [(4, 11), (5, 4), (5, 7), (6, 0), (6, 4)]
AGES = [18, 30, 45, 60, 75]
SEXES = ["male", "female"]
ACTIVITIES = [
    ActivityLevel.SEDENTARY,
    ActivityLevel.MODERATE,
    ActivityLevel.ACTIVE,
    ActivityLevel.ATHLETIC,
]
GOALS = [
    Goal.FAT_LOSS,
    Goal.MAINTENANCE,
    Goal.MUSCLE_GAIN,
    Goal.METABOLIC_RESET,
]
HEALTH_FLAGS = [
    {},
    {"prediabetes": True},
    {"insulin_resistant": True},
    {"type_2_diabetes": True},
]


def main() -> None:
    issues: list[dict] = []
    checked = 0

    for sex, weight, (height_ft, height_in), age, activity, goal, flags in itertools.product(
        SEXES, WEIGHTS, HEIGHTS, AGES, ACTIVITIES, GOALS, HEALTH_FLAGS,
    ):
        profile = MetabolicProfileInput(
            weight_lb=weight,
            height_ft=height_ft,
            height_in=height_in,
            age=age,
            sex=sex,
            activity_level=activity,
            goal=goal,
            **flags,
        )
        budget = build_metabolic_budget(profile)
        checked += 1

        protein_floor_ok = budget.protein_g + 1e-6 >= weight
        fat_ratio = budget.fat_g / weight
        derived_protein = derive_protein_target_g(
            {"sex": sex, "age": age, "weight_lb": weight, "goal": goal.value},
        )
        calc_protein = calc_protein_target_g(profile)

        if not protein_floor_ok:
            issues.append({
                "kind": "protein_floor",
                "sex": sex,
                "weight_lb": weight,
                "age": age,
                "activity": activity.value,
                "goal": goal.value,
                "protein_g": budget.protein_g,
            })

        if abs(derived_protein - calc_protein) > 0.05:
            issues.append({
                "kind": "protein_path_mismatch",
                "sex": sex,
                "weight_lb": weight,
                "age": age,
                "goal": goal.value,
                "derived_protein_g": derived_protein,
                "computed_protein_g": calc_protein,
            })

        if budget.fat_g < 25.0 or fat_ratio > 0.65:
            issues.append({
                "kind": "fat_ratio_out_of_bounds",
                "sex": sex,
                "weight_lb": weight,
                "age": age,
                "activity": activity.value,
                "goal": goal.value,
                "fat_g": budget.fat_g,
                "fat_ratio": round(fat_ratio, 3),
            })

        if budget.calorie_target_kcal - budget.tdee > 0.05:
            issues.append({
                "kind": "calorie_target_above_tdee",
                "sex": sex,
                "weight_lb": weight,
                "age": age,
                "activity": activity.value,
                "goal": goal.value,
                "calorie_target_kcal": budget.calorie_target_kcal,
                "tdee_kcal": budget.tdee,
            })

    print(json.dumps({
        "profiles_checked": checked,
        "issue_count": len(issues),
        "issues": issues[:100],
    }, indent=2))


if __name__ == "__main__":
    main()
