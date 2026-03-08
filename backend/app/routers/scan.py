from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.nutrition import FoodLog
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.routers.nutrition import _compute_daily
from app.services.meal_scan import analyze_meal_scan, recompute_meal_scan
from app.services.metabolic_engine import on_food_log_created
from app.services.whole_food_scoring import analyze_whole_food_product
from app.routers.whole_food_scan import WholeFoodAnalyzeRequest, _extract_product_payload

import httpx


router = APIRouter()


class MealScanUpdateRequest(BaseModel):
    meal_label: str
    meal_type: str = "lunch"
    portion_size: str = "medium"
    source_context: str = "home"
    ingredients: list[str] = Field(default_factory=list)


class MealScanLogRequest(BaseModel):
    date: Optional[str] = None
    meal_type: Optional[str] = None
    servings: float = 1.0
    quantity: float = 1.0


def _serialize_scan(scan: ScannedMealLog) -> dict[str, Any]:
    mes = None
    if scan.mes_score is not None:
        mes = {
            "score": float(scan.mes_score),
            "tier": scan.mes_tier,
            "sub_scores": scan.mes_sub_scores or {},
        }
    return {
        "id": str(scan.id),
        "meal_label": scan.meal_label,
        "meal_type": scan.meal_type,
        "meal_context": scan.meal_context,
        "portion_size": scan.portion_size,
        "source_context": scan.source_context,
        "estimated_ingredients": scan.estimated_ingredients or [],
        "normalized_ingredients": scan.normalized_ingredients or [],
        "nutrition_estimate": scan.nutrition_estimate or {},
        "whole_food_status": scan.whole_food_status,
        "whole_food_flags": scan.whole_food_flags or [],
        "suggested_swaps": scan.suggested_swaps or {},
        "mes": mes,
        "confidence": float(scan.confidence or 0),
        "confidence_breakdown": scan.confidence_breakdown or {},
        "source_model": scan.source_model,
        "matched_recipe_id": scan.matched_recipe_id,
        "logged_to_chronometer": bool(scan.logged_to_chronometer),
        "whole_food_summary": (scan.nutrition_estimate or {}).get("whole_food_summary") or None,
    }


@router.post("/product/analyze")
async def analyze_product(
    body: WholeFoodAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    del current_user
    result = analyze_whole_food_product(body.model_dump())
    return {
        "product_name": body.product_name or "Label check",
        "brand": body.brand,
        "barcode": body.barcode,
        "source": body.source,
        **result,
    }


@router.get("/product/barcode/{barcode}")
async def analyze_product_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
):
    del current_user
    if not barcode.strip():
        raise HTTPException(status_code=400, detail="Barcode is required.")

    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    params = {
        "fields": ",".join([
            "product_name",
            "product_name_en",
            "brands",
            "ingredients_text",
            "ingredients_text_en",
            "nutriments",
            "image_front_small_url",
            "image_front_url",
        ])
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Unable to reach barcode product database right now.")

    if data.get("status") != 1 or not data.get("product"):
        raise HTTPException(status_code=404, detail="Product not found for that barcode.")

    payload = _extract_product_payload(data["product"], barcode)
    result = analyze_whole_food_product(payload)
    return {
        "product_name": payload["product_name"],
        "brand": payload.get("brand"),
        "barcode": barcode,
        "image_url": payload.get("image_url"),
        "source": "barcode",
        **result,
    }


@router.post("/meal")
async def scan_meal(
    image: UploadFile = File(...),
    meal_type: Optional[str] = Form(default=None),
    portion_size: Optional[str] = Form(default=None),
    source_context: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Meal scan requires an image upload.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is too large. Keep it under 8MB.")

    result = await analyze_meal_scan(
        db=db,
        user_id=current_user.id,
        image_bytes=image_bytes,
        mime_type=image.content_type,
        context={
            "meal_type": meal_type,
            "portion_size": portion_size,
            "source_context": source_context,
        },
    )

    scan = ScannedMealLog(
        user_id=current_user.id,
        image_url=None,
        meal_label=result["meal_label"],
        scan_mode="meal",
        meal_context=result["meal_context"],
        meal_type=result["meal_type"],
        portion_size=result["portion_size"],
        source_context=result["source_context"],
        estimated_ingredients=result["estimated_ingredients"],
        normalized_ingredients=result["normalized_ingredients"],
        nutrition_estimate={
            **(result["nutrition_estimate"] or {}),
            "whole_food_summary": result.get("whole_food_summary"),
        },
        whole_food_status=result["whole_food_status"],
        whole_food_flags=result["whole_food_flags"],
        suggested_swaps=result["suggested_swaps"],
        mes_score=(result["mes"] or {}).get("score"),
        mes_tier=(result["mes"] or {}).get("tier"),
        mes_sub_scores=(result["mes"] or {}).get("sub_scores") or {},
        confidence=result["confidence"],
        confidence_breakdown=result["confidence_breakdown"],
        source_model=result["source_model"],
        matched_recipe_id=result.get("matched_recipe_id"),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return _serialize_scan(scan)


@router.patch("/meal/{scan_id}")
async def update_meal_scan(
    scan_id: str,
    body: MealScanUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan = db.query(ScannedMealLog).filter(ScannedMealLog.id == scan_id, ScannedMealLog.user_id == current_user.id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Meal scan not found.")

    result = recompute_meal_scan(
        db=db,
        user_id=current_user.id,
        meal_label=body.meal_label,
        meal_type=body.meal_type,
        portion_size=body.portion_size,
        source_context=body.source_context,
        ingredients=body.ingredients,
        existing_source_model=scan.source_model,
    )

    scan.meal_label = result["meal_label"]
    scan.meal_context = result["meal_context"]
    scan.meal_type = result["meal_type"]
    scan.portion_size = result["portion_size"]
    scan.source_context = result["source_context"]
    scan.estimated_ingredients = result["estimated_ingredients"]
    scan.normalized_ingredients = result["normalized_ingredients"]
    scan.nutrition_estimate = {
        **(result["nutrition_estimate"] or {}),
        "whole_food_summary": result.get("whole_food_summary"),
    }
    scan.whole_food_status = result["whole_food_status"]
    scan.whole_food_flags = result["whole_food_flags"]
    scan.suggested_swaps = result["suggested_swaps"]
    scan.mes_score = (result["mes"] or {}).get("score")
    scan.mes_tier = (result["mes"] or {}).get("tier")
    scan.mes_sub_scores = (result["mes"] or {}).get("sub_scores") or {}
    scan.confidence = result["confidence"]
    scan.confidence_breakdown = result["confidence_breakdown"]
    scan.matched_recipe_id = result.get("matched_recipe_id")
    db.commit()
    db.refresh(scan)
    return _serialize_scan(scan)


@router.post("/meal/{scan_id}/log")
async def log_meal_scan(
    scan_id: str,
    body: MealScanLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan = db.query(ScannedMealLog).filter(ScannedMealLog.id == scan_id, ScannedMealLog.user_id == current_user.id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Meal scan not found.")

    if scan.logged_food_log_id:
        return {"ok": True, "food_log_id": str(scan.logged_food_log_id), "already_logged": True}

    log_date = datetime.utcnow().date()
    if body.date:
        try:
            log_date = datetime.fromisoformat(body.date).date()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    nutrition_snapshot = {
        **(scan.nutrition_estimate or {}),
        "estimated": True,
        "scan_confidence": float(scan.confidence or 0),
        "scan_confidence_breakdown": scan.confidence_breakdown or {},
        "whole_food_status": scan.whole_food_status,
        "whole_food_flags": scan.whole_food_flags or [],
        "scan_snapshot_id": str(scan.id),
        "scan_mes_score": scan.mes_score,
        "scan_mes_tier": scan.mes_tier,
    }

    log = FoodLog(
        user_id=current_user.id,
        date=log_date,
        meal_type=body.meal_type or scan.meal_type or "meal",
        source_type="scan",
        source_id=str(scan.id),
        title=scan.meal_label,
        servings=body.servings,
        quantity=body.quantity,
        nutrition_snapshot=nutrition_snapshot,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        on_food_log_created(db, current_user.id, log)
    except Exception:
        pass

    _compute_daily(db, current_user.id, log_date)

    scan.logged_food_log_id = log.id
    scan.logged_to_chronometer = True
    db.commit()

    return {"ok": True, "food_log_id": str(log.id), "meal_label": scan.meal_label}
