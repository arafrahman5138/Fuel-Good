import unittest

from fastapi.routing import APIRoute

from app.main import app


def _get_route(path: str, method: str) -> APIRoute:
    for route in app.routes:
        if isinstance(route, APIRoute) and route.path == path and method in route.methods:
            return route
    raise AssertionError(f"Route not found for {method} {path}")


def _dependency_names(route: APIRoute) -> set[str]:
    return {getattr(dep.call, "__name__", "") for dep in route.dependant.dependencies}


class PaywallEnforcementTests(unittest.TestCase):
    def test_premium_routes_require_premium_dependency(self) -> None:
        # Premium = metabolic pillar + decision-relief features
        # (tasks/real-food-metabolic-plan.md Phase 3 freemium matrix).
        premium_routes = [
            ("POST", "/api/chat/healthify"),
            ("GET", "/api/meal-plans/history"),
            ("GET", "/api/grocery/current"),
            ("GET", "/api/metabolic/score/daily"),
            ("GET", "/api/metabolic/score/weekly"),
            ("GET", "/api/metabolic/meal-suggestions"),
        ]

        for method, path in premium_routes:
            route = _get_route(path, method)
            self.assertIn("require_premium_user", _dependency_names(route), f"{method} {path} is missing premium enforcement")

    def test_free_tier_routes_remain_accessible_without_premium_dependency(self) -> None:
        # Free = the real-food pillar: tracker, logging, scanning, curated
        # meal browsing, food search, gamification.
        allowed_routes = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/billing/status"),
            ("GET", "/api/metabolic/profile"),
            ("GET", "/api/metabolic/budget"),
            ("POST", "/api/metabolic/profile"),
            ("GET", "/api/fuel/weekly"),
            ("GET", "/api/nutrition/targets"),
            ("GET", "/api/recipes/browse"),
            ("GET", "/api/foods/search"),
            ("GET", "/api/game/stats"),
            ("GET", "/api/scan/product/barcode/{barcode}"),
            ("POST", "/api/scan/meal"),
        ]

        for method, path in allowed_routes:
            route = _get_route(path, method)
            self.assertNotIn("require_premium_user", _dependency_names(route), f"{method} {path} should stay outside the premium guard")

    def test_ai_scan_routes_enforce_free_tier_quota(self) -> None:
        # AI scans are free but rate-limited per day; barcode lookups uncapped.
        quota_routes = [
            ("POST", "/api/scan/meal"),
            ("POST", "/api/scan/meal/stream"),
            ("POST", "/api/scan/smart"),
            ("POST", "/api/scan/product/image"),
            ("POST", "/api/scan/product/analyze"),
        ]
        for method, path in quota_routes:
            route = _get_route(path, method)
            self.assertIn("enforce_ai_scan_quota", _dependency_names(route), f"{method} {path} is missing the free-tier scan quota")

        barcode_route = _get_route("/api/scan/product/barcode/{barcode}", "GET")
        self.assertNotIn("enforce_ai_scan_quota", _dependency_names(barcode_route), "barcode lookups must stay uncapped")


if __name__ == "__main__":
    unittest.main()
