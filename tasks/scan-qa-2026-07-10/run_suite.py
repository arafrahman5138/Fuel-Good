#!/usr/bin/env python3
"""Run the 2026-07-10 scan-QA suite against /api/scan/smart and score it
against ground_truth.json.

Scores per image:
  - classification: actual scan_type in expected_types
  - fuel/label score inside expected range
  - component recall (meals): fraction of ground-truth components found
  - calories inside expected range (meals)
  - latency

Usage:
    TOKEN=... python tasks/scan-qa-2026-07-10/run_suite.py [--only NAME]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / "images"
OUT_DIR = ROOT / "results"
OUT_DIR.mkdir(exist_ok=True, parents=True)

API = os.environ.get("API_BASE", "http://localhost:8000")
TOKEN = os.environ.get("TOKEN", "")
if not TOKEN:
    try:
        TOKEN = Path("/tmp/fuelgood-token.txt").read_text().strip()
    except FileNotFoundError:
        pass

GT = json.loads((ROOT / "ground_truth.json").read_text())


def scan_smart(client: httpx.Client, img_path: Path) -> tuple[dict, float]:
    t0 = time.time()
    with img_path.open("rb") as f:
        r = client.post(
            f"{API}/api/scan/smart",
            headers={"Authorization": f"Bearer {TOKEN}"},
            files={"image": (img_path.name, f, "image/png")},
            data={"source_context": "home"},
            timeout=180.0,
        )
    dt = time.time() - t0
    try:
        return r.json(), dt
    except Exception:
        return {"error": r.text[:500], "http_status": r.status_code}, dt


def _component_names(meal: dict) -> list[str]:
    names: list[str] = []
    for key in ("estimated_ingredients", "normalized_ingredients", "components"):
        for item in meal.get(key) or []:
            if isinstance(item, dict):
                n = item.get("name") or item.get("ingredient") or ""
            else:
                n = str(item)
            if n:
                names.append(n.lower())
    if meal.get("meal_label"):
        names.append(str(meal["meal_label"]).lower())
    return names


def _extract_calories(meal: dict) -> float | None:
    for key in ("nutrition_estimate", "nutrition"):
        n = meal.get(key)
        if isinstance(n, dict) and n.get("calories") is not None:
            try:
                return float(n["calories"])
            except (TypeError, ValueError):
                return None
    return None


def evaluate(name: str, gt: dict, body: dict, dt: float) -> dict:
    actual_type = body.get("scan_type") or ("error" if body.get("error") else "unknown")
    rec: dict = {
        "image": name,
        "category": gt.get("category"),
        "expected_types": gt["expected_types"],
        "actual_type": actual_type,
        "classification_ok": actual_type in gt["expected_types"],
        "duration_s": round(dt, 2),
    }

    if actual_type == "meal":
        meal = body.get("meal") or {}
        fuel = meal.get("fuel_score")
        rec["fuel_score"] = fuel
        rec["fuel_tier"] = meal.get("fuel_tier") or meal.get("tier")
        rec["meal_label"] = meal.get("meal_label")
        rec["confidence"] = meal.get("confidence")
        rec["source_model"] = meal.get("source_model")
        rec["degraded"] = bool(meal.get("is_degraded"))
        lo, hi = gt.get("fuel_range", [0, 100])
        rec["fuel_in_range"] = fuel is not None and lo <= fuel <= hi
        rec["fuel_expected"] = [lo, hi]

        kcal = _extract_calories(meal)
        rec["calories"] = kcal
        if gt.get("kcal_range"):
            klo, khi = gt["kcal_range"]
            rec["kcal_in_range"] = kcal is not None and klo <= kcal <= khi
            rec["kcal_expected"] = [klo, khi]

        if gt.get("components"):
            names = _component_names(meal)
            joined = " | ".join(names)
            hits = []
            for syns in gt["components"]:
                hits.append(any(s in joined for s in syns))
            rec["component_recall"] = round(sum(hits) / len(hits), 2)
            rec["components_found"] = names[:12]
            rec["components_missed"] = [
                syns[0] for syns, h in zip(gt["components"], hits) if not h
            ]

    elif actual_type == "label":
        label = body.get("label") or {}
        score = label.get("score")
        rec["label_score"] = score
        rec["tier"] = label.get("tier")
        rec["product_name"] = label.get("product_name")
        rec["confidence"] = label.get("confidence")
        if gt.get("expect_needs_better_capture"):
            # Front-of-pack with no readable ingredients must NOT get a made-up
            # score — it should route the user to barcode/panel capture.
            rec["needs_better_capture_ok"] = bool(label.get("needs_better_capture")) and score is None
        elif gt.get("score_range"):
            lo, hi = gt["score_range"]
            rec["score_in_range"] = score is not None and lo <= score <= hi
            rec["score_expected"] = [lo, hi]
        hint = (gt.get("product_hint") or "").lower()
        if hint:
            rec["product_hint_ok"] = hint in str(label.get("product_name", "")).lower()

    elif actual_type == "beverage":
        bev = body.get("beverage") or {}
        rec["fuel_score"] = bev.get("fuel_score")
        rec["meal_label"] = bev.get("meal_label")

    elif actual_type == "degraded":
        rec["reason"] = (body.get("degraded") or {}).get("degraded_reason", "")

    elif actual_type == "not_food":
        rec["reason"] = (body.get("not_food") or {}).get("reason", "")[:120]

    else:
        rec["error"] = str(body.get("error") or body)[:300]

    return rec


def pct(vals: list[float], p: float) -> float:
    if not vals:
        return 0.0
    v = sorted(vals)
    k = min(len(v) - 1, int(round((p / 100.0) * (len(v) - 1))))
    return round(v[k], 2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", action="append", default=None)
    parser.add_argument(
        "--assert-baseline",
        default=None,
        help="Path to a previous summary.json; exit 1 on metric regression.",
    )
    args = parser.parse_args()

    if not TOKEN:
        print("ERROR: set TOKEN env var or /tmp/fuelgood-token.txt", file=sys.stderr)
        return 2

    names = [n for n in GT if not args.only or n in args.only]
    records: list[dict] = []
    latencies: list[float] = []

    print(f"[api ] {API}")
    print(f"[scan] {len(names)} images")

    with httpx.Client() as client:
        for name in names:
            img = IMG_DIR / f"{name}.png"
            if not img.exists():
                print(f"  [!] missing {name}.png")
                continue
            print(f"  {name:32s} ... ", end="", flush=True)
            body, dt = scan_smart(client, img)
            (OUT_DIR / f"{name}.json").write_text(json.dumps(body, indent=2, default=str))
            rec = evaluate(name, GT[name], body, dt)
            records.append(rec)
            latencies.append(dt)
            bits = [
                "OK  " if rec["classification_ok"] else "MISS",
                f"type={rec['actual_type']:<8s}",
            ]
            if "fuel_score" in rec:
                mark = "✓" if rec.get("fuel_in_range") else "✗"
                bits.append(f"fuel={rec['fuel_score']}{mark}")
            if "label_score" in rec:
                mark = "✓" if rec.get("score_in_range") else "✗"
                bits.append(f"score={rec['label_score']}{mark}")
            if rec.get("component_recall") is not None:
                bits.append(f"recall={rec['component_recall']}")
            if rec.get("calories") is not None:
                mark = "✓" if rec.get("kcal_in_range") else "✗"
                bits.append(f"kcal={rec['calories']:.0f}{mark}")
            bits.append(f"{dt:.1f}s")
            print("  ".join(bits))

    n = len(records)
    cls_ok = sum(1 for r in records if r["classification_ok"])
    fuel_scored = [r for r in records if "fuel_in_range" in r]
    fuel_ok = sum(1 for r in fuel_scored if r["fuel_in_range"])
    lab_scored = [r for r in records if "score_in_range" in r]
    lab_ok = sum(1 for r in lab_scored if r["score_in_range"])
    handoff = [r for r in records if "needs_better_capture_ok" in r]
    handoff_ok = sum(1 for r in handoff if r["needs_better_capture_ok"])
    kcal_scored = [r for r in records if "kcal_in_range" in r]
    kcal_ok = sum(1 for r in kcal_scored if r["kcal_in_range"])
    recalls = [r["component_recall"] for r in records if r.get("component_recall") is not None]

    # Model share: which model actually served the scans (QA 2026-07-10 found
    # the fallback winning ~83% of races).
    model_counts: dict[str, int] = {}
    for r in records:
        model = str(r.get("source_model") or "")
        if model:
            base = model.replace("+cached", "")
            model_counts[base] = model_counts.get(base, 0) + 1
    n_models = sum(model_counts.values())
    primary_model = os.environ.get("PRIMARY_MODEL", "gemini-3.1-flash-lite")
    primary_share = (
        round(100.0 * sum(v for k, v in model_counts.items() if k == primary_model) / n_models, 1)
        if n_models else None
    )

    # Quantization detector: distinct label scores across the label images.
    label_scores = sorted({r["label_score"] for r in records if r.get("label_score") is not None})

    summary = {
        "api": API,
        "n": n,
        "classification": {"ok": cls_ok, "n": n, "pct": round(100 * cls_ok / n, 1) if n else 0},
        "fuel_score_in_range": {"ok": fuel_ok, "n": len(fuel_scored)},
        "label_score_in_range": {"ok": lab_ok, "n": len(lab_scored)},
        "capture_handoff": {"ok": handoff_ok, "n": len(handoff)},
        "kcal_in_range": {"ok": kcal_ok, "n": len(kcal_scored)},
        "mean_component_recall": round(sum(recalls) / len(recalls), 3) if recalls else None,
        "source_model_counts": model_counts,
        "primary_model_share_pct": primary_share,
        "distinct_label_scores": label_scores,
        "latency": {
            "n": len(latencies),
            "p50": pct(latencies, 50),
            "p90": pct(latencies, 90),
            "min": round(min(latencies), 2) if latencies else 0,
            "max": round(max(latencies), 2) if latencies else 0,
        },
        "per_image": records,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))

    print()
    print(f"[classification] {cls_ok}/{n}")
    print(f"[fuel in range ] {fuel_ok}/{len(fuel_scored)}")
    print(f"[label in range] {lab_ok}/{len(lab_scored)}")
    print(f"[capture handoff] {handoff_ok}/{len(handoff)}")
    print(f"[kcal in range ] {kcal_ok}/{len(kcal_scored)}")
    print(f"[mean recall   ] {summary['mean_component_recall']}")
    print(f"[models        ] {model_counts} primary_share={primary_share}%")
    print(f"[label scores  ] {label_scores}")
    print(f"[latency       ] p50={summary['latency']['p50']}s p90={summary['latency']['p90']}s max={summary['latency']['max']}s")
    print(f"[out] {OUT_DIR}/summary.json")

    if args.assert_baseline:
        base = json.loads(Path(args.assert_baseline).read_text())
        failures = []
        if cls_ok < base["classification"]["ok"] - 1:
            failures.append(f"classification {cls_ok} < {base['classification']['ok']} - 1")
        if fuel_ok < base["fuel_score_in_range"]["ok"]:
            failures.append(f"fuel_in_range {fuel_ok} < {base['fuel_score_in_range']['ok']}")
        if lab_ok < base["label_score_in_range"]["ok"]:
            failures.append(f"label_in_range {lab_ok} < {base['label_score_in_range']['ok']}")
        if kcal_ok < base["kcal_in_range"]["ok"]:
            failures.append(f"kcal_in_range {kcal_ok} < {base['kcal_in_range']['ok']}")
        if summary["latency"]["p50"] > base["latency"]["p50"] * 1.2 + 1.0:
            failures.append(f"latency_p50 {summary['latency']['p50']} > {base['latency']['p50']} +20%")
        if failures:
            print(f"[REGRESSION] vs {args.assert_baseline}:")
            for f in failures:
                print(f"  - {f}")
            return 1
        print(f"[baseline] no regressions vs {args.assert_baseline}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
