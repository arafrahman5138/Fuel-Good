from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.models.local_food import LocalFood


CATALOG_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "food_catalog_seed.json"
MACRO_KEYS = {"calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "omega3_g"}


def _round(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _scale_nutrition(nutrition: dict[str, Any], factor: float) -> dict[str, float]:
    return {key: _round(value) * factor for key, value in (nutrition or {}).items()}


def canonicalize_nutrition(nutrition: dict[str, Any]) -> dict[str, float]:
    base = {key: _round(value) for key, value in (nutrition or {}).items() if value is not None}
    calories = _round(base.get("calories"))
    protein = _round(base.get("protein_g") or base.get("protein"))
    carbs = _round(base.get("carbs_g") or base.get("carbs"))
    fat = _round(base.get("fat_g") or base.get("fat"))
    fiber = _round(base.get("fiber_g") or base.get("fiber"))
    sugar = _round(base.get("sugar_g") or base.get("sugar"))
    omega3 = _round(base.get("omega3_g"))

    micros = {
        key: _round(value)
        for key, value in base.items()
        if key not in {"protein", "protein_g", "carbs", "carbs_g", "fat", "fat_g", "fiber", "fiber_g", "sugar", "sugar_g", "calories"}
    }

    return {
        "calories": calories,
        "protein": protein,
        "protein_g": protein,
        "carbs": carbs,
        "carbs_g": carbs,
        "fat": fat,
        "fat_g": fat,
        "fiber": fiber,
        "fiber_g": fiber,
        "sugar": sugar,
        "sugar_g": sugar,
        "omega3_g": omega3,
        **micros,
    }


def _catalog_id(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"wholefoodlabs.food.{name.strip().lower()}"))


def _build_serving_options(seed: dict[str, Any], per_100g: dict[str, Any]) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for raw in seed.get("serving_options", []) or []:
      grams = _round(raw.get("grams"))
      if grams <= 0:
          continue
      label = str(raw.get("label") or f"{grams:g} g").strip()
      option_id = str(raw.get("id") or label.lower().replace(" ", "_").replace("/", "_"))
      nutrition = canonicalize_nutrition(_scale_nutrition(per_100g, grams / 100.0))
      options.append({
          "id": option_id,
          "label": label,
          "grams": grams,
          "nutrition": nutrition,
      })
    return options


def build_food_payload(seed: dict[str, Any]) -> dict[str, Any]:
    name = str(seed["name"]).strip()
    per_100g = canonicalize_nutrition(seed.get("nutrition_per_100g") or {})
    default_serving_grams = _round(seed.get("default_serving_grams") or 100)
    default_serving_label = str(seed.get("default_serving_label") or f"{default_serving_grams:g} g").strip()
    nutrition_per_serving = canonicalize_nutrition(_scale_nutrition(per_100g, default_serving_grams / 100.0))
    serving_options = _build_serving_options(seed, per_100g)
    if not any(option["label"] == default_serving_label for option in serving_options):
        serving_options.insert(0, {
            "id": "default",
            "label": default_serving_label,
            "grams": default_serving_grams,
            "nutrition": nutrition_per_serving,
        })

    return {
        "id": seed.get("id") or _catalog_id(name),
        "name": name,
        "brand": seed.get("brand"),
        "category": seed.get("category") or "Whole Foods",
        "source_kind": seed.get("source_kind") or "whole_food",
        "aliases": seed.get("aliases") or [],
        "default_serving_label": default_serving_label,
        "default_serving_grams": default_serving_grams,
        "serving_options": serving_options,
        "nutrition_per_100g": per_100g,
        "nutrition_per_serving": nutrition_per_serving,
        "mes_ready_nutrition": {
            key: nutrition_per_serving.get(key, 0)
            for key in ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g")
        },
        "micronutrients": {
            key: value for key, value in nutrition_per_serving.items()
            if key not in {"calories", "protein", "protein_g", "carbs", "carbs_g", "fat", "fat_g", "fiber", "fiber_g", "sugar", "sugar_g"}
        },
        "nutrition_info": nutrition_per_serving,
        "serving": default_serving_label,
        "tags": seed.get("tags") or [],
        "is_active": seed.get("is_active", True),
    }


def load_catalog_seed() -> list[dict[str, Any]]:
    with CATALOG_SEED_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return [build_food_payload(item) for item in data]


def seed_food_catalog(db: Session) -> int:
    seeded = 0
    for payload in load_catalog_seed():
        row = db.query(LocalFood).filter(LocalFood.id == payload["id"]).first()
        if not row:
            row = db.query(LocalFood).filter(LocalFood.name == payload["name"]).first()
        if not row:
            row = LocalFood(id=payload["id"], name=payload["name"])
            db.add(row)
            seeded += 1

        for key, value in payload.items():
            setattr(row, key, value)
    db.commit()
    return seeded


def serialize_food_search(food: LocalFood) -> dict[str, Any]:
    return {
        "id": str(food.id),
        "name": food.name,
        "brand": food.brand,
        "category": food.category,
        "source_kind": food.source_kind,
        "default_serving_label": food.default_serving_label or food.serving or "1 serving",
        "default_serving_grams": _round(food.default_serving_grams),
        "nutrition_preview": {
            key: _round((food.nutrition_per_serving or food.nutrition_info or {}).get(key, 0))
            for key in ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g")
        },
    }


def serialize_food_detail(food: LocalFood) -> dict[str, Any]:
    return {
        "id": str(food.id),
        "name": food.name,
        "brand": food.brand,
        "category": food.category,
        "source_kind": food.source_kind,
        "default_serving_label": food.default_serving_label or food.serving or "1 serving",
        "default_serving_grams": _round(food.default_serving_grams),
        "nutrition_per_serving": canonicalize_nutrition(food.nutrition_per_serving or food.nutrition_info or {}),
        "nutrition_per_100g": canonicalize_nutrition(food.nutrition_per_100g or {}),
        "mes_ready_nutrition": canonicalize_nutrition(food.mes_ready_nutrition or food.nutrition_per_serving or {}),
        "micronutrients": {key: _round(value) for key, value in (food.micronutrients or {}).items()},
        "serving_options": food.serving_options or [],
        "serving": food.default_serving_label or food.serving or "1 serving",
        "source": "catalog",
    }


def resolve_food_db_nutrition(
    food: LocalFood,
    serving_option_id: str | None = None,
    grams: float | None = None,
) -> dict[str, float]:
    if grams is not None and grams > 0:
        return canonicalize_nutrition(_scale_nutrition(food.nutrition_per_100g or {}, grams / 100.0))

    if serving_option_id:
        for option in food.serving_options or []:
            if str(option.get("id")) == serving_option_id:
                return canonicalize_nutrition(option.get("nutrition") or {})

    return canonicalize_nutrition(food.nutrition_per_serving or food.nutrition_info or {})
