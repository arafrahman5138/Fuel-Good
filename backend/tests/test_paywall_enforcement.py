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
        premium_routes = [
            ("POST", "/api/chat/healthify"),
            ("GET", "/api/meal-plans/history"),
            ("GET", "/api/recipes/browse"),
            ("GET", "/api/foods/search"),
            ("GET", "/api/nutrition/targets"),
            ("GET", "/api/grocery/current"),
            ("GET", "/api/game/stats"),
            ("POST", "/api/scan/product/analyze"),
            ("POST", "/api/whole-food-scan/analyze"),
            ("GET", "/api/metabolic/score/daily"),
            ("GET", "/api/metabolic/meal-suggestions"),
        ]

        for method, path in premium_routes:
            route = _get_route(path, method)
            self.assertIn("require_premium_user", _dependency_names(route), f"{method} {path} is missing premium enforcement")

    def test_allowed_routes_remain_accessible_without_premium_dependency(self) -> None:
        allowed_routes = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/billing/status"),
            ("GET", "/api/metabolic/profile"),
            ("GET", "/api/metabolic/budget"),
            ("POST", "/api/metabolic/profile"),
        ]

        for method, path in allowed_routes:
            route = _get_route(path, method)
            self.assertNotIn("require_premium_user", _dependency_names(route), f"{method} {path} should stay outside the premium guard")


if __name__ == "__main__":
    unittest.main()
