#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from statistics import mean, median

from app.services.metabolic_engine import (
    DEFAULT_COMPUTED_BUDGET,
    calc_fas,
    calc_fs,
    calc_gis,
    calc_metabolic_stability_bonus,
    calc_pas,
)


ROOT = Path(__file__).resolve().parents[1]
MEALS_PATH = ROOT / "official_meals.json"


def current_gis(net_carbs_g: float) -> float:
    if net_carbs_g <= 10:
        return 100.0
    if net_carbs_g <= 20:
        return 100.0 - ((net_carbs_g - 10) / 10) * 20
    if net_carbs_g <= 35:
        return 80.0 - ((net_carbs_g - 20) / 15) * 25
    if net_carbs_g <= 55:
        return 55.0 - ((net_carbs_g - 35) / 20) * 30
    if net_carbs_g <= 80:
        return 25.0 - ((net_carbs_g - 55) / 25) * 20
    return max(0.0, 5.0 - ((net_carbs_g - 80) / 20) * 5)


def tier(score: float) -> str:
    if score >= 82:
        return "optimal"
    if score >= 65:
        return "good"
    if score >= 50:
        return "moderate"
    if score >= 35:
        return "low"
    return "critical"


def score_meal(
    protein: float,
    fiber: float,
    carbs: float,
    fat: float,
    calories: float,
    *,
    gis_fn,
    weights: tuple[float, float, float, float],
    stability_bonus: bool = False,
) -> dict[str, float | str]:
    protein_target = DEFAULT_COMPUTED_BUDGET.protein_g / 3
    net_carbs = max(0.0, carbs - fiber)
    gis = gis_fn(net_carbs)
    pas = calc_pas(protein, protein_target)
    fs = calc_fs(fiber)
    fas = calc_fas(fat)
    bonus = 0.0
    if stability_bonus:
        bonus = calc_metabolic_stability_bonus(
            protein_g=protein,
            fiber_g=fiber,
            carbs_g=carbs,
            fat_g=fat,
            calories=calories,
            budget=DEFAULT_COMPUTED_BUDGET,
        )
    total = round(weights[0] * gis + weights[1] * pas + weights[2] * fs + weights[3] * fas + bonus, 1)
    return {
        "score": total,
        "tier": tier(total),
        "gis": round(gis, 1),
        "pas": round(pas, 1),
        "fs": round(fs, 1),
        "fas": round(fas, 1),
        "stability_bonus": round(bonus, 2),
    }


def main() -> None:
    meals = json.loads(MEALS_PATH.read_text())["meals"]
    scoreable: list[dict[str, object]] = []
    for meal in meals:
        if (meal.get("recipe_role") or "full_meal") != "full_meal":
            continue
        if meal.get("is_component"):
            continue
        if meal.get("is_mes_scoreable") is False:
            continue
        nutrition = meal.get("nutrition_info") or {}
        protein = float(nutrition.get("protein_g", nutrition.get("protein", 0)) or 0)
        fiber = float(nutrition.get("fiber_g", nutrition.get("fiber", 0)) or 0)
        carbs = float(nutrition.get("carbs_g", nutrition.get("carbs", 0)) or 0)
        fat = float(nutrition.get("fat_g", nutrition.get("fat", 0)) or 0)
        calories = float(nutrition.get("calories", nutrition.get("calories_kcal", 0)) or 0)
        if protein == fiber == carbs == fat == 0:
            continue
        scoreable.append(
            {
                "title": meal["title"],
                "protein": protein,
                "fiber": fiber,
                "carbs": carbs,
                "fat": fat,
                "calories": calories,
            }
        )

    scenarios = {
        "current": {"gis_fn": current_gis, "weights": (0.35, 0.30, 0.20, 0.15)},
        "retuned_general_baseline": {"gis_fn": lambda n: calc_gis(n, "general"), "weights": (0.24, 0.34, 0.24, 0.18)},
        "retuned_general_v2": {"gis_fn": lambda n: calc_gis(n, "general"), "weights": (0.24, 0.34, 0.24, 0.18), "stability_bonus": True},
        "retuned_strict": {"gis_fn": lambda n: calc_gis(n, "strict"), "weights": (0.36, 0.28, 0.22, 0.14)},
    }

    all_results: dict[str, list[dict[str, object]]] = {}
    for name, config in scenarios.items():
        rows: list[dict[str, object]] = []
        for meal in scoreable:
            result = score_meal(
                float(meal["protein"]),
                float(meal["fiber"]),
                float(meal["carbs"]),
                float(meal["fat"]),
                float(meal["calories"]),
                gis_fn=config["gis_fn"],
                weights=config["weights"],
                stability_bonus=bool(config.get("stability_bonus")),
            )
            rows.append({"title": meal["title"], **result})
        all_results[name] = rows

    print(f"scoreable_count={len(scoreable)}")
    current_scores = {row["title"]: float(row["score"]) for row in all_results["current"]}
    for name, rows in all_results.items():
        scores = [float(row["score"]) for row in rows]
        tier_counts: dict[str, int] = {}
        for row in rows:
            tier_counts[str(row["tier"])] = tier_counts.get(str(row["tier"]), 0) + 1
        print(f"\nSCENARIO {name}")
        print(f"avg={mean(scores):.1f} median={median(scores):.1f} min={min(scores):.1f} max={max(scores):.1f}")
        print(f"tiers={tier_counts}")
        if name != "current":
            deltas = [round(float(row["score"]) - current_scores[str(row["title"])], 1) for row in rows]
            print(f"delta_avg={mean(deltas):.1f} delta_min={min(deltas):.1f} delta_max={max(deltas):.1f}")
            biggest = sorted(rows, key=lambda row: float(row["score"]) - current_scores[str(row["title"])], reverse=True)[:10]
            print("top_gainers=", [(row["title"], round(float(row["score"]) - current_scores[str(row["title"])], 1), row["score"]) for row in biggest])


if __name__ == "__main__":
    main()
