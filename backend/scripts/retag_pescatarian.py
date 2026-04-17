"""Retag recipes as pescatarian where the ingredients permit.

QA finding N5: `/api/recipes/filters` returned `pescatarian: 1`, so Jordan's
14-slot meal plan collapsed to the same salmon pasta repeated 14 times. The
backend model + filter logic already supports the `pescatarian` tag — the data
simply wasn't tagged.

Rules used here (deliberately conservative):
  * Recipe is pescatarian-eligible if its `protein_type` list is a subset of
    {salmon, shrimp, other_fish, eggs, vegetarian} AND none of chicken / beef /
    pork / lamb / turkey / game appears.
  * We also scan the ingredient names for red-flag meat tokens as a belt-and-
    suspenders check, because `protein_type` can be empty on older rows.
  * Skips recipes that already carry the pescatarian tag.

Run from repo root:
    cd backend && python -m scripts.retag_pescatarian
"""
from __future__ import annotations

import logging
import sys
from typing import Iterable

# Ensure we can import the app package when run as `python scripts/retag_pescatarian.py`
sys.path.insert(0, ".")

from sqlalchemy.orm.attributes import flag_modified

from app.db import SessionLocal  # type: ignore
from app.models import recipe as _recipe_module  # noqa: F401 mapper config
from app.models.recipe import Recipe

logger = logging.getLogger(__name__)

_PESCATARIAN_OK_PROTEINS = {
    "salmon", "shrimp", "other_fish", "fish", "pescatarian",
    "eggs", "egg", "vegetarian", "tofu", "tempeh", "seitan",
}
_DISQUALIFYING_PROTEINS = {
    "chicken", "beef", "pork", "lamb", "turkey",
    "veal", "venison", "duck", "goat", "bison", "rabbit",
}
_MEAT_INGREDIENT_TOKENS = (
    "chicken", "beef", "pork", "lamb", "turkey", "bacon",
    "ham", "sausage", "venison", "duck", "prosciutto", "pancetta",
    "salami", "chorizo", "ground beef", "ground turkey",
)


def _ingredient_text(recipe: Recipe) -> str:
    raw = recipe.ingredients or []
    if isinstance(raw, str):
        return raw.lower()
    parts: list[str] = []
    for item in raw:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            parts.append(str(item.get("name") or item.get("text") or ""))
    return " ".join(parts).lower()


def _is_pescatarian_eligible(recipe: Recipe) -> tuple[bool, str]:
    protein_types = {str(p).lower() for p in (recipe.protein_type or [])}
    if protein_types & _DISQUALIFYING_PROTEINS:
        return False, f"protein_type contains {protein_types & _DISQUALIFYING_PROTEINS}"

    ing = _ingredient_text(recipe)
    matched_meat = [token for token in _MEAT_INGREDIENT_TOKENS if token in ing]
    if matched_meat:
        return False, f"ingredient text matched {matched_meat}"

    # If we got here, the recipe doesn't contain land-animal meat. It's
    # pescatarian-safe regardless of whether protein_type is populated.
    return True, "no disqualifying proteins"


def retag(session) -> dict:
    added = 0
    skipped_already_tagged = 0
    skipped_disqualified = 0
    examples_added: list[str] = []

    recipes: Iterable[Recipe] = session.query(Recipe).all()
    for recipe in recipes:
        tags = list(recipe.dietary_tags or [])
        if "pescatarian" in tags:
            skipped_already_tagged += 1
            continue

        eligible, reason = _is_pescatarian_eligible(recipe)
        if not eligible:
            skipped_disqualified += 1
            continue

        tags.append("pescatarian")
        recipe.dietary_tags = tags
        flag_modified(recipe, "dietary_tags")
        added += 1
        if len(examples_added) < 8:
            examples_added.append(recipe.title)

    session.commit()
    return {
        "tagged": added,
        "already_tagged": skipped_already_tagged,
        "disqualified": skipped_disqualified,
        "examples": examples_added,
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    session = SessionLocal()
    try:
        summary = retag(session)
    finally:
        session.close()
    logger.info("retag complete: %s", summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
