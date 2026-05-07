#!/usr/bin/env python3
"""Drive /api/scan/smart against all 18 audit fixtures.

Collects per-image classification + scoring + latency, then produces a
summary JSON usable by the QA report.

Usage:
    TOKEN=... python tasks/scan-audit/run_smart_scans.py
"""
from __future__ import annotations

import json
import os
import statistics
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / "images"
OUT_DIR = ROOT / "smart-qa"
OUT_DIR.mkdir(exist_ok=True, parents=True)

API = os.environ.get("API_BASE", "http://localhost:8000")
TOKEN = os.environ.get("TOKEN", "")
if not TOKEN:
    try:
        TOKEN = Path("/tmp/fuelgood-token.txt").read_text().strip()
    except FileNotFoundError:
        pass
if not TOKEN:
    print("ERROR: set TOKEN env var or create /tmp/fuelgood-token.txt", file=sys.stderr)
    sys.exit(2)


# Ground truth: what scan_type each fixture ought to produce.
EXPECTED: dict[str, str] = {}
for name in sorted(IMG_DIR.glob("meal_*.png")):
    EXPECTED[name.name] = "meal"
for name in sorted(IMG_DIR.glob("label_*.png")):
    EXPECTED[name.name] = "label"
EXPECTED["edge_01_blurry_dim_meal.png"] = "meal"
EXPECTED["edge_02_restaurant_menu.png"] = "not_food"
EXPECTED["edge_03_coffee_latte.png"] = "beverage"


def scan_smart(client: httpx.Client, img_path: Path, *, force: str | None = None) -> tuple[dict, float]:
    t0 = time.time()
    data = {"source_context": "home"}
    if force:
        data["force_scan_type"] = force
    with img_path.open("rb") as f:
        r = client.post(
            f"{API}/api/scan/smart",
            headers={"Authorization": f"Bearer {TOKEN}"},
            files={"image": (img_path.name, f, "image/png")},
            data=data,
            timeout=180.0,
        )
    dt = time.time() - t0
    try:
        return r.json(), dt
    except Exception:
        return {"error": r.text[:500], "http_status": r.status_code}, dt


def summarize(body: dict) -> dict:
    st = body.get("scan_type") or ("error" if body.get("error") else "unknown")
    out = {"scan_type": st}
    if st == "meal":
        meal = body.get("meal") or {}
        out["fuel_score"] = meal.get("fuel_score")
        out["meal_label"] = meal.get("meal_label")
        out["confidence"] = meal.get("confidence")
        out["source_model"] = meal.get("source_model")
        out["flags"] = [
            f.get("label") or f.get("ingredient") or f.get("tag")
            for f in (meal.get("whole_food_flags") or [])
        ][:5]
    elif st == "label":
        label = body.get("label") or {}
        out["product_name"] = label.get("product_name")
        out["tier"] = label.get("tier")
        out["score"] = label.get("score")
        out["confidence"] = label.get("confidence")
        out["concerns_n"] = len(label.get("concerns") or [])
    elif st == "beverage":
        bev = body.get("beverage") or {}
        out["meal_label"] = bev.get("meal_label")
        out["fuel_score"] = bev.get("fuel_score")
        out["fuel_tier"] = bev.get("fuel_tier")
    elif st == "not_food":
        out["reason"] = (body.get("not_food") or {}).get("reason", "")[:100]
    elif st == "degraded":
        out["reason"] = (body.get("degraded") or {}).get("degraded_reason", "")
    else:
        out["error"] = str(body.get("error") or body)[:200]
    return out


def pct(vals: list[float], p: float) -> float:
    if not vals:
        return 0.0
    vals_sorted = sorted(vals)
    k = min(len(vals_sorted) - 1, int(round((p / 100.0) * (len(vals_sorted) - 1))))
    return round(vals_sorted[k], 2)


def main() -> int:
    records: list[dict] = []
    latencies_by_path: dict[str, list[float]] = {
        "meal": [], "label": [], "beverage": [], "not_food": [], "other": []
    }

    print(f"[auth] token ok (len {len(TOKEN)})")
    print(f"[api ] {API}")
    print(f"[scan] {len(EXPECTED)} fixtures")
    print()

    with httpx.Client() as client:
        for name, expected in EXPECTED.items():
            img = IMG_DIR / name
            if not img.exists():
                print(f"  [!] missing fixture {name}")
                continue
            print(f"  {name:40s} expected={expected:<9s} ... ", end="", flush=True)
            body, dt = scan_smart(client, img)
            (OUT_DIR / f"{name}.json").write_text(json.dumps(body, indent=2, default=str))
            s = summarize(body)
            actual = s["scan_type"]
            ok = actual == expected
            records.append({
                "image": name,
                "expected": expected,
                "actual": actual,
                "classification_ok": ok,
                "duration_s": round(dt, 2),
                **s,
            })
            bucket = actual if actual in latencies_by_path else "other"
            latencies_by_path[bucket].append(dt)
            tag = "OK  " if ok else "MISS"
            extra = (
                f"fuel={s.get('fuel_score')}" if actual == "meal"
                else f"tier={s.get('tier')} score={s.get('score')}" if actual == "label"
                else f"fuel={s.get('fuel_score')}" if actual == "beverage"
                else ""
            )
            print(f"{tag} actual={actual:<9s} {extra:<28s} {dt:>5.1f}s")

    # Summary
    correct = sum(1 for r in records if r["classification_ok"])
    total = len(records)
    print()
    print(f"[result] classification accuracy: {correct}/{total} = {100.0*correct/total:.1f}%")

    summary = {
        "api": API,
        "fixtures_tested": total,
        "correct": correct,
        "accuracy_pct": round(100.0 * correct / total, 1) if total else 0.0,
        "per_fixture": records,
        "latency_by_path": {
            bucket: {
                "n": len(vals),
                "p50": pct(vals, 50),
                "p90": pct(vals, 90),
                "p99": pct(vals, 99),
                "min": round(min(vals), 2) if vals else 0.0,
                "max": round(max(vals), 2) if vals else 0.0,
            }
            for bucket, vals in latencies_by_path.items()
            if vals
        },
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))

    print()
    print("Latency by path:")
    for bucket, stats in summary["latency_by_path"].items():
        print(f"  {bucket:10s} n={stats['n']:<3d} p50={stats['p50']}s  p90={stats['p90']}s  max={stats['max']}s")

    print(f"\n[out] {OUT_DIR}/summary.json")
    return 0 if correct / max(total, 1) >= 0.85 else 1


if __name__ == "__main__":
    raise SystemExit(main())
