from app.services.meal_scan import _recovery_plan, _upgrade_suggestions


class _Budget:
    protein_target_g = 130.0
    fiber_floor_g = 30.0
    sugar_ceiling_g = 200.0


def test_snack_guidance_avoids_full_meal_language(monkeypatch):
    monkeypatch.setattr("app.services.meal_scan.load_budget_for_user", lambda db, user_id: _Budget())
    monkeypatch.setattr(
        "app.services.meal_scan._today_totals",
        lambda db, user_id: {"calories": 900.0, "protein": 35.0, "carbs": 90.0, "fat": 30.0, "fiber": 10.0},
    )

    nutrition = {"calories": 180.0, "protein": 1.0, "carbs": 28.0, "fat": 0.0, "fiber": 2.0}

    upgrades = _upgrade_suggestions([], nutrition, "fresh", meal_context="snack")
    recovery = _recovery_plan(None, "user-1", nutrition, "pass", meal_context="snack")

    upgrade_text = " ".join(upgrades).lower()
    recovery_text = " ".join(recovery).lower()

    assert "meal holds you longer" not in upgrade_text
    assert "bean, lentil, or vegetable side" not in upgrade_text
    assert "aim for about" not in recovery_text
    assert "pair fruit or other quick carbs" in upgrade_text
    assert "next meal" in recovery_text
