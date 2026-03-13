#!/usr/bin/env python3
from __future__ import annotations

import json

from sqlalchemy import create_engine, text

from app.config import get_settings


PAIRING_PROFILES = {
    "Lentil Tabbouleh": {
        "fiber_class": "high",
        "acid": True,
        "healthy_fat": True,
        "veg_density": "high",
        "recommended_timing": "before_meal",
    },
    "Kale and White Bean Salad": {
        "fiber_class": "high",
        "acid": True,
        "healthy_fat": True,
        "veg_density": "high",
        "recommended_timing": "before_meal",
    },
    "Black Bean and Corn Salad": {
        "fiber_class": "high",
        "acid": True,
        "healthy_fat": True,
        "veg_density": "high",
        "recommended_timing": "with_meal",
    },
    "Kachumber Salad": {
        "fiber_class": "med",
        "acid": True,
        "healthy_fat": False,
        "veg_density": "high",
        "recommended_timing": "before_meal",
    },
    "Cucumber Tomato Herb Salad": {
        "fiber_class": "med",
        "acid": True,
        "healthy_fat": True,
        "veg_density": "high",
        "recommended_timing": "before_meal",
    },
    "Cilantro Lime Cabbage Slaw": {
        "fiber_class": "med",
        "acid": True,
        "healthy_fat": True,
        "veg_density": "high",
        "recommended_timing": "before_meal",
    },
    "Mediterranean Cucumber Tomato Salad": {
        "fiber_class": "med",
        "acid": True,
        "healthy_fat": True,
        "veg_density": "high",
        "recommended_timing": "before_meal",
    },
}


def main() -> None:
    engine = create_engine(get_settings().database_url)
    with engine.begin() as conn:
        for title, profile in PAIRING_PROFILES.items():
            conn.execute(
                text(
                    """
                    update recipes
                    set pairing_synergy_profile = cast(:profile as jsonb)
                    where title = :title
                    """
                ),
                {"title": title, "profile": json.dumps(profile)},
            )

        rows = conn.execute(
            text(
                """
                select title, pairing_synergy_profile
                from recipes
                where pairing_synergy_profile is not null
                order by title
                """
            )
        ).fetchall()
        print(f"Seeded {len(rows)} pairing synergy profiles.")
        for row in rows:
            print(row.title, row.pairing_synergy_profile)


if __name__ == "__main__":
    main()
