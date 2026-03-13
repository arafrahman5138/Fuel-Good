from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.nutrition import FoodLog
from app.models.recipe import Recipe
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.routers.nutrition import _compute_daily
from app.services.meal_scan import analyze_meal_scan, recompute_meal_scan
from app.services.metabolic_engine import on_food_log_created
from app.services.product_label_scan import analyze_product_label_image
from app.services.whole_food_scoring import analyze_whole_food_product
from app.routers.whole_food_scan import WholeFoodAnalyzeRequest, _extract_product_payload

import httpx


router = APIRouter()
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


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
    include_recommended_pairing: bool = False


def _serialize_snack_profile(scan: ScannedMealLog) -> dict[str, Any] | None:
    if scan.meal_context != "snack":
        return None
    nutrition = scan.nutrition_estimate or {}
    protein = float(nutrition.get("protein", 0) or nutrition.get("protein_g", 0) or 0)
    carbs = float(nutrition.get("carbs", 0) or nutrition.get("carbs_g", 0) or 0)
    sugar = max(0.0, round(carbs * 0.18, 1))
    high_flags = any(str((flag or {}).get("severity", "")) == "high" for flag in (scan.whole_food_flags or []))
    healthy = (
        scan.whole_food_status == "pass"
        and not high_flags
        and (protein >= 12 or (carbs <= 18 and sugar <= 10))
    )
    return {
        "is_snack": True,
        "is_healthy_snack": healthy,
        "label": "Healthy snack" if healthy else "Snack",
    }


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
        "upgrade_suggestions": scan.upgrade_suggestions or [],
        "recovery_plan": scan.recovery_plan or [],
        "mes": mes,
        "snack_profile": _serialize_snack_profile(scan),
        "confidence": float(scan.confidence or 0),
        "confidence_breakdown": scan.confidence_breakdown or {},
        "source_model": scan.source_model,
        "grounding_source": scan.grounding_source,
        "grounding_candidates": scan.grounding_candidates or [],
        "prompt_version": scan.prompt_version,
        "matched_recipe_id": scan.matched_recipe_id,
        "matched_recipe_confidence": float(scan.matched_recipe_confidence or 0),
        "logged_to_chronometer": bool(scan.logged_to_chronometer),
        "whole_food_summary": (scan.nutrition_estimate or {}).get("whole_food_summary") or None,
        "pairing_opportunity": bool(scan.pairing_opportunity),
        "pairing_recommended_recipe_id": scan.pairing_recommended_recipe_id,
        "pairing_recommended_title": scan.pairing_recommended_title,
        "pairing_projected_mes": float(scan.pairing_projected_mes or 0) if scan.pairing_projected_mes is not None else None,
        "pairing_projected_delta": float(scan.pairing_projected_delta or 0) if scan.pairing_projected_delta is not None else None,
        "pairing_reasons": scan.pairing_reasons or [],
        "pairing_timing": scan.pairing_timing,
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
        "ingredients_text": body.ingredients_text or "",
        "confidence": 1.0 if body.ingredients_text else 0.35,
        "confidence_breakdown": {
            "ocr": 1.0,
            "ingredients": 1.0 if body.ingredients_text else 0.35,
            "nutrition": 1.0 if any([
                body.calories is not None,
                body.protein_g is not None,
                body.fiber_g is not None,
                body.sugar_g is not None,
                body.carbs_g is not None,
                body.sodium_mg is not None,
            ]) else 0.0,
            "metadata": 1.0 if (body.product_name or body.brand) else 0.0,
        },
        "recoverable": not bool(body.ingredients_text),
        "notes": [],
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
        "ingredients_text": payload.get("ingredients_text") or "",
        "confidence": 0.98,
        "confidence_breakdown": {
            "ocr": 1.0,
            "ingredients": 0.98,
            "nutrition": 0.98,
            "metadata": 0.98,
        },
        "recoverable": False,
        "notes": [],
        **result,
    }


@router.post("/product/image")
async def analyze_product_image(
    image: UploadFile = File(...),
    capture_type: Optional[str] = Form(default="front_label"),
    current_user: User = Depends(get_current_user),
):
    del current_user
    if image.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Packaged food scan requires an image upload.")

    image_bytes = await image.read()
    await image.close()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is too large. Keep it under 8MB.")

    try:
        return await analyze_product_label_image(
            image_bytes=image_bytes,
            mime_type=image.content_type,
            capture_type=(capture_type or "front_label").strip() or "front_label",
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Unable to analyze that label photo right now.")
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/meal")
async def scan_meal(
    image: UploadFile = File(...),
    meal_type: Optional[str] = Form(default=None),
    portion_size: Optional[str] = Form(default=None),
    source_context: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if image.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Meal scan requires an image upload.")

    image_bytes = await image.read()
    await image.close()
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

    # Non-food image — return immediately without persisting a scan record
    if result.get("is_not_food"):
        return {
            "is_not_food": True,
            "not_food_reason": result.get("not_food_reason", "No food detected in image"),
        }

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
        upgrade_suggestions=result["upgrade_suggestions"],
        recovery_plan=result["recovery_plan"],
        mes_score=(result["mes"] or {}).get("score"),
        mes_tier=(result["mes"] or {}).get("tier"),
        mes_sub_scores=(result["mes"] or {}).get("sub_scores") or {},
        pairing_opportunity=bool(result.get("pairing_opportunity")),
        pairing_recommended_recipe_id=result.get("pairing_recommended_recipe_id"),
        pairing_recommended_title=result.get("pairing_recommended_title"),
        pairing_projected_mes=result.get("pairing_projected_mes"),
        pairing_projected_delta=result.get("pairing_projected_delta"),
        pairing_reasons=result.get("pairing_reasons") or [],
        pairing_timing=result.get("pairing_timing"),
        confidence=result["confidence"],
        confidence_breakdown=result["confidence_breakdown"],
        source_model=result["source_model"],
        grounding_source=result.get("grounding_source"),
        grounding_candidates=result.get("grounding_candidates") or [],
        prompt_version=result.get("prompt_version"),
        matched_recipe_id=result.get("matched_recipe_id"),
        matched_recipe_confidence=result.get("matched_recipe_confidence"),
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

    result = await recompute_meal_scan(
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
    scan.upgrade_suggestions = result["upgrade_suggestions"]
    scan.recovery_plan = result["recovery_plan"]
    scan.mes_score = (result["mes"] or {}).get("score")
    scan.mes_tier = (result["mes"] or {}).get("tier")
    scan.mes_sub_scores = (result["mes"] or {}).get("sub_scores") or {}
    scan.pairing_opportunity = bool(result.get("pairing_opportunity"))
    scan.pairing_recommended_recipe_id = result.get("pairing_recommended_recipe_id")
    scan.pairing_recommended_title = result.get("pairing_recommended_title")
    scan.pairing_projected_mes = result.get("pairing_projected_mes")
    scan.pairing_projected_delta = result.get("pairing_projected_delta")
    scan.pairing_reasons = result.get("pairing_reasons") or []
    scan.pairing_timing = result.get("pairing_timing")
    scan.confidence = result["confidence"]
    scan.confidence_breakdown = result["confidence_breakdown"]
    scan.grounding_source = result.get("grounding_source")
    scan.grounding_candidates = result.get("grounding_candidates") or []
    scan.prompt_version = result.get("prompt_version")
    scan.matched_recipe_id = result.get("matched_recipe_id")
    scan.matched_recipe_confidence = result.get("matched_recipe_confidence")
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
        "meal_context": scan.meal_context,
        "scan_confidence": float(scan.confidence or 0),
        "scan_confidence_breakdown": scan.confidence_breakdown or {},
        "whole_food_status": scan.whole_food_status,
        "whole_food_flags": scan.whole_food_flags or [],
        "scan_snapshot_id": str(scan.id),
        "scan_mes_score": scan.mes_score,
        "scan_mes_tier": scan.mes_tier,
    }

    group_id = None
    group_mes_score = None
    group_mes_tier = None
    paired_recipe = None
    if body.include_recommended_pairing and scan.pairing_recommended_recipe_id:
        paired_recipe = db.query(Recipe).filter(Recipe.id == scan.pairing_recommended_recipe_id).first()
        if paired_recipe and scan.pairing_projected_mes is not None:
            group_id = str(uuid.uuid4())
            group_mes_score = float(scan.pairing_projected_mes)
            group_mes_tier = (
                "optimal" if group_mes_score >= 80
                else "stable" if group_mes_score >= 60
                else "shaky" if group_mes_score >= 40
                else "crash_risk"
            )

    log = FoodLog(
        user_id=current_user.id,
        date=log_date,
        meal_type=body.meal_type or scan.meal_type or "meal",
        source_type="scan",
        source_id=str(scan.id),
        group_id=group_id,
        group_mes_score=group_mes_score,
        group_mes_tier=group_mes_tier,
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
        logger.warning("MES scoring failed for scan log %s", log.id, exc_info=True)

    if paired_recipe and group_id:
        side_log = FoodLog(
            user_id=current_user.id,
            date=log_date,
            meal_type=body.meal_type or scan.meal_type or "meal",
            source_type="recipe",
            source_id=str(paired_recipe.id),
            group_id=group_id,
            group_mes_score=group_mes_score,
            group_mes_tier=group_mes_tier,
            title=paired_recipe.title,
            servings=1.0,
            quantity=1.0,
            nutrition_snapshot=paired_recipe.nutrition_info or {},
        )
        db.add(side_log)
        db.commit()
        db.refresh(side_log)
        try:
            on_food_log_created(db, current_user.id, side_log)
        except Exception:
            logger.warning("MES scoring failed for scan pairing log %s", side_log.id, exc_info=True)

    _compute_daily(db, current_user.id, log_date)

    scan.logged_food_log_id = log.id
    scan.logged_to_chronometer = True
    db.commit()

    return {"ok": True, "food_log_id": str(log.id), "meal_label": scan.meal_label}
