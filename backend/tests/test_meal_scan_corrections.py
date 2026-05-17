from app.routers.scan import _summarize_scan_correction
from app.services.meal_scan import _apply_correction_heuristic


def test_fresh_sourdough_correction_replaces_generic_bun():
    corrected = _apply_correction_heuristic(
        ["beef patty", "lettuce", "bun"],
        "The bread was fresh sourdough from a local bakery, made with flour, water, salt, and starter.",
    )

    assert "fresh sourdough bread" in corrected
    assert "bun" not in corrected
    assert "beef patty" in corrected


def test_no_seed_oils_removes_inferred_oil_component():
    corrected = _apply_correction_heuristic(
        ["chicken", "vegetables", "vegetable oil"],
        "No seed oils, this was cooked in olive oil.",
    )

    assert "vegetable oil" not in corrected
    assert "chicken" in corrected


def test_oil_swap_replaces_seed_oil_with_healthy_fat():
    corrected = _apply_correction_heuristic(
        ["salmon", "rice", "vegetable oil"],
        "Cooked in olive oil not vegetable oil.",
    )

    assert "olive oil" in corrected
    assert "vegetable oil" not in corrected


def test_homemade_dressing_preserves_component_name():
    corrected = _apply_correction_heuristic(
        ["chicken", "salad", "dressing"],
        "The dressing is homemade.",
    )

    assert "homemade dressing" in corrected
    assert "homemade" not in corrected


def test_correction_summary_explains_sourdough_update():
    summary = _summarize_scan_correction(
        ["beef", "bun", "lettuce"],
        ["beef", "fresh sourdough bread", "lettuce"],
        "The bread was fresh sourdough from a local bakery.",
    )

    assert summary["strategy"] == "heuristic_v2"
    assert "sourdough" in summary["text"].lower()
    assert summary["added"] == ["fresh sourdough bread"]
    assert summary["removed"] == ["bun"]
