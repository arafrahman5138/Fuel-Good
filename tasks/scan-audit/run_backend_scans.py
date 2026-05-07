#!/usr/bin/env python3
"""Drive the scan backend end-to-end against all 18 test images.

Posts meal images to /api/scan/meal and label images to /api/scan/product/image.
Writes per-image JSON results + a summary table for accuracy audit.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / "images"
OUT_DIR = ROOT / "observations"
OUT_DIR.mkdir(exist_ok=True, parents=True)

API = "http://localhost:8000"
EMAIL = "newtester0418x@example.com"
PASSWORD = "ScanAudit123!"

MEAL_IMAGES = sorted([p.name for p in IMG_DIR.glob("meal_*.png")])
LABEL_IMAGES = sorted([p.name for p in IMG_DIR.glob("label_*.png")])
EDGE_IMAGES = sorted([p.name for p in IMG_DIR.glob("edge_*.png")])

# Edge cases: blurry meal → scan as meal; menu → scan as label (pathological);
# coffee → scan as meal (borderline food).
EDGE_ROUTE = {
    "edge_01_blurry_dim_meal.png": "meal",
    "edge_02_restaurant_menu.png": "label",
    "edge_03_coffee_latte.png": "meal",
}


def login(client: httpx.Client) -> str:
    r = client.post(
        f"{API}/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=15.0,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def scan_meal(client: httpx.Client, token: str, img_path: Path) -> dict:
    with img_path.open("rb") as f:
        r = client.post(
            f"{API}/api/scan/meal",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": (img_path.name, f, "image/png")},
            data={"source_context": "home"},
            timeout=180.0,
        )
    return {"status": r.status_code, "body": _safe_json(r)}


def scan_label(client: httpx.Client, token: str, img_path: Path) -> dict:
    with img_path.open("rb") as f:
        r = client.post(
            f"{API}/api/scan/product/image",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": (img_path.name, f, "image/png")},
            data={"capture_type": "ingredients"},
            timeout=180.0,
        )
    return {"status": r.status_code, "body": _safe_json(r)}


def _safe_json(r: httpx.Response) -> dict:
    try:
        return r.json()
    except Exception:
        return {"raw": r.text[:2000]}


def _meal_summary(result: dict) -> dict:
    b = result.get("body", {}) or {}
    return {
        "http": result.get("status"),
        "label": b.get("meal_label"),
        "fuel_score": b.get("fuel_score"),
        "status": b.get("whole_food_status"),
        "mes": (b.get("mes") or {}).get("score"),
        "mes_tier": (b.get("mes") or {}).get("tier"),
        "confidence": b.get("confidence"),
        "ingredients": b.get("estimated_ingredients") or [],
        "flags": [f.get("reason") or f.get("ingredient") for f in (b.get("whole_food_flags") or [])],
        "upgrade_suggestions": b.get("upgrade_suggestions") or [],
        "calories": (b.get("nutrition_estimate") or {}).get("calories"),
        "protein": (b.get("nutrition_estimate") or {}).get("protein"),
        "carbs": (b.get("nutrition_estimate") or {}).get("carbs"),
        "fat": (b.get("nutrition_estimate") or {}).get("fat"),
        "fiber": (b.get("nutrition_estimate") or {}).get("fiber"),
        "is_not_food": b.get("is_not_food"),
        "is_degraded": b.get("is_degraded"),
        "multi_dish": b.get("multi_dish"),
        "dishes": [d.get("meal_label") for d in (b.get("dishes") or [])],
    }


def _label_summary(result: dict) -> dict:
    b = result.get("body", {}) or {}
    return {
        "http": result.get("status"),
        "product_name": b.get("product_name"),
        "brand": b.get("brand"),
        "score": b.get("score"),
        "tier": b.get("tier"),
        "verdict": b.get("verdict"),
        "ingredient_count": b.get("ingredient_count"),
        "confidence": b.get("confidence"),
        "highlights": b.get("highlights") or [],
        "concerns": b.get("concerns") or [],
        "processing_flags": b.get("processing_flags") or {},
        "ingredients_text": (b.get("ingredients_text") or "")[:280],
        "nutrition": b.get("nutrition_snapshot"),
    }


def main() -> int:
    records: list[dict] = []
    with httpx.Client() as client:
        token = login(client)
        print(f"[auth] ok")
        for name in MEAL_IMAGES:
            img = IMG_DIR / name
            print(f"[meal] {name} ...", flush=True)
            t0 = time.time()
            r = scan_meal(client, token, img)
            dt = time.time() - t0
            records.append({"image": name, "route": "meal", "duration_s": round(dt, 1), **_meal_summary(r)})
            (OUT_DIR / f"{name}.json").write_text(json.dumps(r["body"], indent=2, default=str))
            print(f"    → fuel={r['body'].get('fuel_score')} mes={(r['body'].get('mes') or {}).get('score')} conf={r['body'].get('confidence')} ({dt:.1f}s)")
        for name in LABEL_IMAGES:
            img = IMG_DIR / name
            print(f"[label] {name} ...", flush=True)
            t0 = time.time()
            r = scan_label(client, token, img)
            dt = time.time() - t0
            records.append({"image": name, "route": "label", "duration_s": round(dt, 1), **_label_summary(r)})
            (OUT_DIR / f"{name}.json").write_text(json.dumps(r["body"], indent=2, default=str))
            print(f"    → score={r['body'].get('score')} tier={r['body'].get('tier')} conf={r['body'].get('confidence')} ({dt:.1f}s)")
        for name in EDGE_IMAGES:
            img = IMG_DIR / name
            route = EDGE_ROUTE.get(name, "meal")
            print(f"[edge/{route}] {name} ...", flush=True)
            t0 = time.time()
            if route == "meal":
                r = scan_meal(client, token, img)
                summary = _meal_summary(r)
            else:
                r = scan_label(client, token, img)
                summary = _label_summary(r)
            dt = time.time() - t0
            records.append({"image": name, "route": f"edge/{route}", "duration_s": round(dt, 1), **summary})
            (OUT_DIR / f"{name}.json").write_text(json.dumps(r["body"], indent=2, default=str))

    (OUT_DIR / "summary.json").write_text(json.dumps(records, indent=2, default=str))
    print(f"\nWrote {len(records)} records to {OUT_DIR}/summary.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
