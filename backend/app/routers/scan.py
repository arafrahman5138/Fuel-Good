from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import re
import uuid
from datetime import UTC, datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from enum import Enum
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.nutrition import FoodLog
from app.models.product_label_scan import ProductLabelScan
from app.models.recipe import Recipe
from app.models.scan_favorite import ScanFavorite
from app.models.scanned_meal import ScannedMealLog
from app.models.user import User
from app.routers.nutrition import _compute_daily
from app.services.meal_scan import analyze_meal_scan, recompute_meal_scan
from app.services.metabolic_engine import build_glycemic_nutrition_input, on_food_log_created
from app.services.product_label_scan import analyze_product_label_image
from app.services.supabase_storage import (
    SupabaseStorageUnavailable,
    build_private_object_path,
    create_signed_object_url,
    is_supabase_storage_configured,
    upload_private_object,
)
from app.services.whole_food_scoring import analyze_whole_food_product
from app.routers.whole_food_scan import WholeFoodAnalyzeRequest, _extract_product_payload
from app.config import get_settings
from app.services.fuel_score import compute_fuel_score

import httpx


router = APIRouter()
settings = get_settings()
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


def _validate_image_magic_bytes(data: bytes) -> str | None:
    """Return detected MIME type from magic bytes, or None if unrecognized."""
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1", b"heif"}:
            return "image/heic"
    return None


class MealTypeEnum(str, Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"
    dessert = "dessert"
    meal = "meal"


class PortionSizeEnum(str, Enum):
    small = "small"
    medium = "medium"
    large = "large"


class SourceContextEnum(str, Enum):
    home = "home"
    restaurant = "restaurant"
    takeout = "takeout"
    meal_prep = "meal_prep"


class MealScanUpdateRequest(BaseModel):
    meal_label: str
    meal_type: MealTypeEnum = MealTypeEnum.lunch
    portion_size: PortionSizeEnum = PortionSizeEnum.medium
    source_context: SourceContextEnum = SourceContextEnum.home
    ingredients: list[str] = Field(default_factory=list)


class MealScanLogRequest(BaseModel):
    date: Optional[str] = None
    meal_type: Optional[str] = None
    servings: float = 1.0
    quantity: float = 1.0
    include_recommended_pairing: bool = False


def _build_degraded_meal_scan_result(
    *,
    meal_type: str | None,
    portion_size: str | None,
    source_context: str | None,
) -> dict[str, Any]:
    resolved_meal_type = (meal_type or "lunch").strip().lower() or "lunch"
    resolved_portion_size = (portion_size or "medium").strip().lower() or "medium"
    resolved_source_context = (source_context or "home").strip().lower() or "home"
    return {
        "meal_label": "Scanned meal",
        "meal_context": "full_meal",
        "meal_type": resolved_meal_type,
        "portion_size": resolved_portion_size,
        "source_context": resolved_source_context,
        "estimated_ingredients": [],
        "normalized_ingredients": [],
        "nutrition_estimate": {
            "calories": 450,
            "protein": 25,
            "carbs": 40,
            "fat": 18,
            "fiber": 5,
            "sugar": 8,
        },
        "whole_food_status": "unknown",
        "whole_food_flags": [],
        "suggested_swaps": {},
        "upgrade_suggestions": [
            "Retake the photo in brighter light for a more accurate meal scan.",
        ],
        "recovery_plan": [
            "You can edit the meal name, ingredients, and portion size after this scan finishes.",
        ],
        "mes": None,
        "confidence": 0.1,
        "confidence_breakdown": {
            "extraction": 0.0,
            "portion": 0.0,
            "grounding": 0.0,
            "nutrition": 0.0,
            "estimate_mode": "fallback",
            "review_required": True,
        },
        "source_model": "degraded_fallback",
        "grounding_source": None,
        "grounding_candidates": [],
        "prompt_version": None,
        "matched_recipe_id": None,
        "matched_recipe_confidence": None,
        "whole_food_summary": "We couldn't confidently analyze this meal yet.",
        "pairing_opportunity": False,
        "pairing_recommended_recipe_id": None,
        "pairing_recommended_title": None,
        "pairing_projected_mes": None,
        "pairing_projected_delta": None,
        "pairing_reasons": [],
        "pairing_timing": None,
        "is_degraded": True,
        "degraded_reason": "AI analysis temporarily unavailable. You can correct this scan manually.",
    }


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
            "ingredient_gis_adjustment": float((scan.nutrition_estimate or {}).get("ingredient_gis_adjustment", 0) or 0),
            "ingredient_gis_reasons": (scan.nutrition_estimate or {}).get("ingredient_gis_reasons") or [],
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
        "glycemic_profile": (scan.nutrition_estimate or {}).get("glycemic_profile"),
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
        "fuel_score": float(scan.fuel_score) if scan.fuel_score is not None else None,
        "fuel_reasoning": [],
        "image": _serialize_storage_reference(
            bucket=scan.image_bucket,
            path=scan.image_path,
            mime_type=scan.image_mime_type,
            fallback_url=scan.image_url,
        ),
    }


def _extension_for_mime_type(mime_type: str) -> str:
    guessed = mimetypes.guess_extension(mime_type or "")
    if guessed:
        return guessed.strip(".")
    return "jpg"


async def _store_scan_image(
    *,
    user_id: str,
    namespace: str,
    bucket: str,
    image_bytes: bytes,
    mime_type: str,
) -> dict[str, Any]:
    extension = _extension_for_mime_type(mime_type)
    path = build_private_object_path(user_id=user_id, namespace=namespace, extension=extension)
    await upload_private_object(bucket=bucket, path=path, content=image_bytes, mime_type=mime_type)
    signed = await create_signed_object_url(bucket=bucket, path=path)
    return {
        "bucket": bucket,
        "path": path,
        "mime_type": mime_type,
        "signed_url": signed["signed_url"],
        "signed_url_expires_in": signed["expires_in"],
    }


def _serialize_storage_reference(
    *,
    bucket: str | None,
    path: str | None,
    mime_type: str | None,
    fallback_url: str | None,
) -> dict[str, Any] | None:
    if not any([bucket, path, fallback_url]):
        return None
    payload: dict[str, Any] = {
        "bucket": bucket,
        "path": path,
        "mime_type": mime_type,
        "signed_url": fallback_url,
    }
    return payload


async def _storage_reference_async(
    *,
    bucket: str | None,
    path: str | None,
    mime_type: str | None,
    fallback_url: str | None,
) -> dict[str, Any] | None:
    if not any([bucket, path, fallback_url]):
        return None
    signed_url = fallback_url
    expires_in = None
    if bucket and path and is_supabase_storage_configured():
        try:
            signed = await create_signed_object_url(bucket=bucket, path=path)
            signed_url = signed["signed_url"]
            expires_in = signed["expires_in"]
        except Exception:
            signed_url = fallback_url
    return {
        "bucket": bucket,
        "path": path,
        "mime_type": mime_type,
        "signed_url": signed_url,
        "signed_url_expires_in": expires_in,
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


#: Batch 4 (QA N16): real barcodes are 8–14 digits (EAN-8/13, UPC-A/E, ITF-14).
#: Malformed inputs previously fell through to a generic "Product not found"
#: 404, indistinguishable from a legitimate not-found.
_BARCODE_RE = re.compile(r"^\d{8,14}$")


@router.get("/product/barcode/{barcode}")
async def analyze_product_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barcode = barcode.strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode is required.")
    # Batch 4 (N16): reject malformed barcodes with 422 (not 404) so the
    # frontend can surface a distinct message ("that doesn't look like a
    # barcode") separate from the "not in database" 404 case.
    if not _BARCODE_RE.match(barcode):
        raise HTTPException(
            status_code=422,
            detail="Barcode must be 8–14 digits (EAN/UPC format).",
        )

    # ── Check cache: reuse recent scan of same barcode (< 7 days old) ──
    from datetime import timedelta
    cache_cutoff = datetime.now(UTC) - timedelta(days=7)
    cached = (
        db.query(ProductLabelScan)
        .filter(
            ProductLabelScan.barcode == barcode.strip(),
            ProductLabelScan.created_at >= cache_cutoff,
        )
        .order_by(ProductLabelScan.created_at.desc())
        .first()
    )
    if cached and cached.analysis:
        return {
            **cached.analysis,
            "scan_id": str(cached.id),
            "product_name": cached.product_name,
            "brand": cached.brand,
            "barcode": barcode,
            "source": "barcode",
            "cached": True,
        }

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
    # Batch 4 (QA N8): common UPCs (Lay's, Oreos, Quaker, La Croix, whole milk,
    # rolled oats — 6 of 8 tested) used to return 502 because the 10-second
    # timeout + zero retries against the public OpenFoodFacts endpoint is
    # fragile. Retry twice with exponential backoff, bump timeout to 30s, and
    # degrade gracefully to 404 with a `fallback` hint so the frontend can
    # offer the label-scan CTA instead of a dead end.
    data = None
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
            break
        except httpx.HTTPError as err:
            last_error = err
            if attempt < 2:
                await asyncio.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s
                continue
    if data is None:
        logger.warning("barcode lookup failed after retries: %s", last_error)
        raise HTTPException(
            status_code=404,
            detail={
                "detail": "Product not found — try scanning the label directly.",
                "fallback": "label_scan",
                "barcode": barcode,
            },
        )

    if data.get("status") != 1 or not data.get("product"):
        raise HTTPException(
            status_code=404,
            detail={
                "detail": "Product not found for that barcode.",
                "fallback": "label_scan",
                "barcode": barcode,
            },
        )

    payload = _extract_product_payload(data["product"], barcode)
    result = analyze_whole_food_product(payload)

    full_result = {
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

    # ── Persist barcode scan for caching ──
    record = ProductLabelScan(
        user_id=current_user.id,
        capture_type="barcode",
        barcode=barcode.strip(),
        product_name=payload["product_name"],
        brand=payload.get("brand"),
        ingredients_text=payload.get("ingredients_text"),
        confidence=0.98,
        analysis=full_result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    full_result["scan_id"] = str(record.id)
    return full_result


@router.post("/product/image")
async def analyze_product_image(
    image: UploadFile = File(...),
    capture_type: Optional[str] = Form(default="front_label"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if image.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Packaged food scan requires an image upload.")

    image_bytes = await image.read()
    await image.close()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is too large. Keep it under 8MB.")

    detected_mime = _validate_image_magic_bytes(image_bytes)
    if detected_mime is None or detected_mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Uploaded file is not a supported image format.")

    try:
        storage_ref = None
        if is_supabase_storage_configured():
            try:
                storage_ref = await _store_scan_image(
                    user_id=current_user.id,
                    namespace="label-scans",
                    bucket=settings.supabase_storage_label_scans_bucket,
                    image_bytes=image_bytes,
                    mime_type=image.content_type,
                )
            except Exception:
                logger.warning("Label scan image storage request failed; continuing without stored image", exc_info=True)

        result = await analyze_product_label_image(
            image_bytes=image_bytes,
            mime_type=image.content_type,
            capture_type=(capture_type or "front_label").strip() or "front_label",
        )
        record = ProductLabelScan(
            user_id=current_user.id,
            capture_type=(capture_type or "front_label").strip() or "front_label",
            image_url=(storage_ref or {}).get("signed_url"),
            image_bucket=(storage_ref or {}).get("bucket"),
            image_path=(storage_ref or {}).get("path"),
            image_mime_type=(storage_ref or {}).get("mime_type"),
            product_name=result.get("product_name"),
            brand=result.get("brand"),
            ingredients_text=result.get("ingredients_text"),
            confidence=float(result.get("confidence", 0) or 0),
            confidence_breakdown=result.get("confidence_breakdown") or {},
            analysis=result,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {
            **result,
            "scan_id": str(record.id),
            "image": await _storage_reference_async(
                bucket=record.image_bucket,
                path=record.image_path,
                mime_type=record.image_mime_type,
                fallback_url=record.image_url,
            ),
        }
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Unable to analyze that label photo right now.")
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        logger.exception("Label scan parsing error")
        raise HTTPException(status_code=502, detail="Could not read the label clearly. Try a closer, well-lit photo of the ingredients list.")
    except RuntimeError as exc:
        logger.exception("Label scan runtime error")
        raise HTTPException(status_code=502, detail="Unable to complete label analysis right now.")
    except SupabaseStorageUnavailable as exc:
        logger.exception("Supabase storage unavailable during label scan")
        raise HTTPException(status_code=500, detail="Image storage is temporarily unavailable.")
    except Exception as exc:
        logger.exception("Unexpected label scan error: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Something went wrong analyzing that label. Try a clearer photo of the ingredients list.")


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

    detected_mime = _validate_image_magic_bytes(image_bytes)
    if detected_mime is None or detected_mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Uploaded file is not a supported image format.")

    try:
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
    except Exception as exc:
        logger.exception("LLM meal scan failed, returning degraded result")
        result = _build_degraded_meal_scan_result(
            meal_type=meal_type,
            portion_size=portion_size,
            source_context=source_context,
        )

    # Non-food image — return immediately without persisting a scan record
    if result.get("is_not_food"):
        return {
            "is_not_food": True,
            "not_food_reason": result.get("not_food_reason", "No food detected in image"),
        }

    storage_ref = None
    if is_supabase_storage_configured():
        try:
            storage_ref = await _store_scan_image(
                user_id=current_user.id,
                namespace="meal-scans",
                bucket=settings.supabase_storage_meal_scans_bucket,
                image_bytes=image_bytes,
                mime_type=image.content_type,
            )
        except SupabaseStorageUnavailable:
            logger.exception("Supabase storage unavailable during meal scan")
        except httpx.HTTPError:
            logger.exception("Meal scan image storage request failed; continuing without stored image")
        except Exception:
            logger.exception("Unexpected meal scan image storage failure; continuing without stored image")

    # ── Fuel Score for scanned meal ──
    # Skip fuel scoring for degraded results (LLM failure fallback) —
    # generic placeholder nutrition would produce a misleading score.
    scan_fuel_score = None
    scan_fuel_reasoning = []
    if not result.get("is_degraded"):
        try:
            fuel_result = compute_fuel_score(
                source_type="scan",
                nutrition=result.get("nutrition_estimate"),
                components=result.get("components") or [],
                source_context=result.get("source_context"),
                whole_food_status=result.get("whole_food_status"),
                whole_food_flags=result.get("whole_food_flags"),
            )
            scan_fuel_score = fuel_result.score
            scan_fuel_reasoning = fuel_result.reasoning
        except Exception:
            logger.warning("Fuel score computation failed for scan", exc_info=True)

    scan = ScannedMealLog(
        user_id=current_user.id,
        image_url=(storage_ref or {}).get("signed_url"),
        image_bucket=(storage_ref or {}).get("bucket"),
        image_path=(storage_ref or {}).get("path"),
        image_mime_type=(storage_ref or {}).get("mime_type"),
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
        fuel_score=scan_fuel_score,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    serialized = _serialize_scan(scan)
    if result.get("is_degraded"):
        serialized["is_degraded"] = True
        serialized["degraded_reason"] = result.get("degraded_reason")
    serialized["fuel_reasoning"] = scan_fuel_reasoning
    serialized["image"] = await _storage_reference_async(
        bucket=scan.image_bucket,
        path=scan.image_path,
        mime_type=scan.image_mime_type,
        fallback_url=scan.image_url,
    )
    return serialized


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
    serialized = _serialize_scan(scan)
    serialized["image"] = await _storage_reference_async(
        bucket=scan.image_bucket,
        path=scan.image_path,
        mime_type=scan.image_mime_type,
        fallback_url=scan.image_url,
    )
    return serialized


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

    # Acquire a row-level lock to prevent duplicate logging from concurrent requests
    locked_scan = db.query(ScannedMealLog).filter(
        ScannedMealLog.id == scan_id,
    ).with_for_update().first()
    if locked_scan and locked_scan.logged_food_log_id:
        return {"ok": True, "food_log_id": str(locked_scan.logged_food_log_id), "already_logged": True}

    log_date = datetime.now(UTC).date()
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
                "optimal" if group_mes_score >= 82
                else "stable" if group_mes_score >= 65
                else "shaky" if group_mes_score >= 50
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
        fuel_score=float(scan.fuel_score) if scan.fuel_score is not None else None,
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
            nutrition_snapshot=build_glycemic_nutrition_input(paired_recipe.nutrition_info or {}, source=paired_recipe),
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


class MealScanCorrectionRequest(BaseModel):
    correction_text: str = Field(..., min_length=3, max_length=500)


@router.patch("/meal/{scan_id}/correct")
async def correct_meal_scan(
    scan_id: str,
    body: MealScanCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply a user's text correction to a scanned meal and recompute scores.

    The correction text is sent to Gemini along with the original scan data
    to produce updated components and nutrition. Fuel Score and MES are
    then recomputed on the updated data.
    """
    scan = (
        db.query(ScannedMealLog)
        .filter(ScannedMealLog.id == scan_id, ScannedMealLog.user_id == current_user.id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Meal scan not found.")

    # Build a corrected ingredient list by merging user feedback
    raw_list = scan.normalized_ingredients or scan.estimated_ingredients or []
    original_ingredients = [
        comp.get("name", "") if isinstance(comp, dict) else str(comp)
        for comp in raw_list
    ]
    corrected_ingredients = original_ingredients.copy()

    # Simple heuristic: user says "X was actually Y" or "remove X" or "add Y"
    correction_lower = body.correction_text.lower()
    recomputed_fuel_reasoning: list[str] = []
    if corrected_ingredients or correction_lower:
        # Re-run the scan pipeline with updated ingredient names
        result = await recompute_meal_scan(
            db=db,
            user_id=current_user.id,
            meal_label=scan.meal_label,
            meal_type=scan.meal_type or "lunch",
            portion_size=scan.portion_size or "medium",
            source_context=scan.source_context or "home",
            ingredients=original_ingredients,
            existing_source_model=scan.source_model,
            correction_text=body.correction_text,
        )

        scan.estimated_ingredients = result.get("estimated_ingredients", scan.estimated_ingredients)
        scan.normalized_ingredients = result.get("normalized_ingredients", scan.normalized_ingredients)
        scan.nutrition_estimate = {
            **(result.get("nutrition_estimate") or {}),
            "whole_food_summary": result.get("whole_food_summary"),
            "correction_applied": body.correction_text,
        }
        scan.whole_food_status = result.get("whole_food_status", scan.whole_food_status)
        scan.whole_food_flags = result.get("whole_food_flags", scan.whole_food_flags)
        scan.upgrade_suggestions = result.get("upgrade_suggestions", scan.upgrade_suggestions)
        scan.recovery_plan = result.get("recovery_plan", scan.recovery_plan)
        scan.mes_score = (result.get("mes") or {}).get("score", scan.mes_score)
        scan.mes_tier = (result.get("mes") or {}).get("tier", scan.mes_tier)
        scan.mes_sub_scores = (result.get("mes") or {}).get("sub_scores") or scan.mes_sub_scores

        # Recompute Fuel Score with corrected data
        try:
            # Normalize ingredients to dicts for compute_fuel_score (expects {name, role})
            raw_ingredients = result.get("normalized_ingredients") or result.get("estimated_ingredients") or []
            normalized_components = [
                ing if isinstance(ing, dict) else {"name": str(ing), "role": "other"}
                for ing in raw_ingredients
            ]
            fuel_result = compute_fuel_score(
                source_type="scan",
                nutrition=result.get("nutrition_estimate"),
                components=normalized_components,
                source_context=scan.source_context,
                whole_food_status=result.get("whole_food_status"),
                whole_food_flags=result.get("whole_food_flags"),
            )
            scan.fuel_score = fuel_result.score
            recomputed_fuel_reasoning = fuel_result.reasoning
        except Exception:
            logger.warning("Fuel score recomputation failed after correction", exc_info=True)

    db.commit()
    db.refresh(scan)

    # If already logged to chronometer, update the linked FoodLog too
    if scan.logged_food_log_id:
        food_log = db.query(FoodLog).filter(FoodLog.id == scan.logged_food_log_id).first()
        if food_log:
            food_log.nutrition_snapshot = build_glycemic_nutrition_input(scan.nutrition_estimate or food_log.nutrition_snapshot)
            food_log.fuel_score = scan.fuel_score
            db.commit()
            _compute_daily(db, current_user.id, food_log.date)

    serialized = _serialize_scan(scan)
    if recomputed_fuel_reasoning:
        serialized["fuel_reasoning"] = recomputed_fuel_reasoning
    try:
        serialized["image"] = await _storage_reference_async(
            bucket=scan.image_bucket,
            path=scan.image_path,
            mime_type=scan.image_mime_type,
            fallback_url=scan.image_url,
        )
    except Exception:
        serialized["image"] = None
    return serialized


# ── Scan History Endpoints ─────────────────────────────────────────


class MealScanRelogRequest(BaseModel):
    date: Optional[str] = None
    meal_type: Optional[str] = None
    servings: float = 1.0
    quantity: float = 1.0
    portion_size: Optional[str] = None


@router.get("/meal/history")
async def get_meal_scan_history(
    limit: int = 20,
    cursor: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return paginated list of past meal scans for the current user."""
    from sqlalchemy import desc

    query = db.query(ScannedMealLog).filter(
        ScannedMealLog.user_id == current_user.id,
    ).order_by(desc(ScannedMealLog.created_at), desc(ScannedMealLog.id))

    if cursor:
        # cursor is "created_at|id" composite
        try:
            cursor_date_str, cursor_id = cursor.rsplit("|", 1)
            cursor_date = datetime.fromisoformat(cursor_date_str)
            query = query.filter(
                (ScannedMealLog.created_at < cursor_date)
                | (
                    (ScannedMealLog.created_at == cursor_date)
                    & (ScannedMealLog.id < cursor_id)
                )
            )
        except (ValueError, TypeError):
            pass

    limit = min(limit, 50)
    scans = query.limit(limit + 1).all()

    has_more = len(scans) > limit
    scans = scans[:limit]

    items = []
    for scan in scans:
        items.append({
            "id": str(scan.id),
            "meal_label": scan.meal_label,
            "fuel_score": float(scan.fuel_score) if scan.fuel_score is not None else None,
            "meal_type": scan.meal_type,
            "whole_food_status": scan.whole_food_status,
            "logged_to_chronometer": bool(scan.logged_to_chronometer),
            "created_at": scan.created_at.isoformat() if scan.created_at else None,
            "image": _serialize_storage_reference(
                bucket=scan.image_bucket,
                path=scan.image_path,
                mime_type=scan.image_mime_type,
                fallback_url=scan.image_url,
            ),
        })

    next_cursor = None
    if has_more and scans:
        last = scans[-1]
        next_cursor = f"{last.created_at.isoformat()}|{last.id}"

    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}


@router.get("/product/history")
async def get_product_scan_history(
    limit: int = 20,
    cursor: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return paginated list of past product scans for the current user."""
    from sqlalchemy import desc

    query = db.query(ProductLabelScan).filter(
        ProductLabelScan.user_id == current_user.id,
    ).order_by(desc(ProductLabelScan.created_at), desc(ProductLabelScan.id))

    if cursor:
        try:
            cursor_date_str, cursor_id = cursor.rsplit("|", 1)
            cursor_date = datetime.fromisoformat(cursor_date_str)
            query = query.filter(
                (ProductLabelScan.created_at < cursor_date)
                | (
                    (ProductLabelScan.created_at == cursor_date)
                    & (ProductLabelScan.id < cursor_id)
                )
            )
        except (ValueError, TypeError):
            pass

    limit = min(limit, 50)
    scans = query.limit(limit + 1).all()

    has_more = len(scans) > limit
    scans = scans[:limit]

    items = []
    for scan in scans:
        analysis = scan.analysis or {}
        items.append({
            "id": str(scan.id),
            "product_name": scan.product_name,
            "brand": scan.brand,
            "barcode": scan.barcode,
            "score": analysis.get("score"),
            "tier": analysis.get("tier"),
            "verdict": analysis.get("verdict"),
            "created_at": scan.created_at.isoformat() if scan.created_at else None,
            "image": _serialize_storage_reference(
                bucket=scan.image_bucket,
                path=scan.image_path,
                mime_type=scan.image_mime_type,
                fallback_url=scan.image_url,
            ),
        })

    next_cursor = None
    if has_more and scans:
        last = scans[-1]
        next_cursor = f"{last.created_at.isoformat()}|{last.id}"

    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}


@router.get("/meal/{scan_id}")
async def get_meal_scan(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the full details of a single meal scan."""
    scan = db.query(ScannedMealLog).filter(
        ScannedMealLog.id == scan_id,
        ScannedMealLog.user_id == current_user.id,
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Meal scan not found.")

    serialized = _serialize_scan(scan)
    serialized["image"] = await _storage_reference_async(
        bucket=scan.image_bucket,
        path=scan.image_path,
        mime_type=scan.image_mime_type,
        fallback_url=scan.image_url,
    )
    return serialized


@router.post("/meal/{scan_id}/relog")
async def relog_meal_scan(
    scan_id: str,
    body: MealScanRelogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-log a previously scanned meal without re-scanning.

    Unlike /log, this always creates a new FoodLog entry even if the scan
    was already logged. Designed for the "same breakfast" use case.
    """
    scan = db.query(ScannedMealLog).filter(
        ScannedMealLog.id == scan_id,
        ScannedMealLog.user_id == current_user.id,
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Meal scan not found.")

    log_date = datetime.now(UTC).date()
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
        fuel_score=float(scan.fuel_score) if scan.fuel_score is not None else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        on_food_log_created(db, current_user.id, log)
    except Exception:
        logger.warning("MES scoring failed for relog %s", log.id, exc_info=True)

    _compute_daily(db, current_user.id, log_date)

    return {
        "ok": True,
        "food_log_id": str(log.id),
        "meal_label": scan.meal_label,
        "fuel_score": float(scan.fuel_score) if scan.fuel_score is not None else None,
    }


# ── Favorites Endpoints ────────────────────────────────────────────


class FavoriteCreateRequest(BaseModel):
    scan_type: str  # "meal" or "product"
    scan_id: str


def _serialize_favorite(fav: ScanFavorite) -> dict[str, Any]:
    return {
        "id": str(fav.id),
        "scan_type": fav.scan_type,
        "source_scan_id": str(fav.source_scan_id),
        "label": fav.label,
        "fuel_score": float(fav.fuel_score) if fav.fuel_score is not None else None,
        "whole_food_status": fav.whole_food_status,
        "meal_type": fav.meal_type,
        "portion_size": fav.portion_size,
        "source_context": fav.source_context,
        "barcode": fav.barcode,
        "brand": fav.brand,
        "product_tier": fav.product_tier,
        "nutrition_snapshot": fav.nutrition_snapshot or {},
        "use_count": fav.use_count or 0,
        "last_used_at": fav.last_used_at.isoformat() if fav.last_used_at else None,
        "created_at": fav.created_at.isoformat() if fav.created_at else None,
        "image": _serialize_storage_reference(
            bucket=fav.image_bucket,
            path=fav.image_path,
            mime_type=fav.image_mime_type,
            fallback_url=fav.image_url,
        ),
    }


@router.post("/favorites")
async def create_favorite(
    body: FavoriteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Favorite a meal or product scan for quick re-logging."""
    # Check for existing favorite from same source scan
    existing = db.query(ScanFavorite).filter(
        ScanFavorite.user_id == current_user.id,
        ScanFavorite.source_scan_id == body.scan_id,
    ).first()
    if existing:
        return _serialize_favorite(existing)

    if body.scan_type == "meal":
        scan = db.query(ScannedMealLog).filter(
            ScannedMealLog.id == body.scan_id,
            ScannedMealLog.user_id == current_user.id,
        ).first()
        if not scan:
            raise HTTPException(status_code=404, detail="Meal scan not found.")
        fav = ScanFavorite(
            user_id=current_user.id,
            scan_type="meal",
            source_scan_id=str(scan.id),
            label=scan.meal_label,
            ingredients=scan.estimated_ingredients or [],
            nutrition_snapshot=scan.nutrition_estimate or {},
            fuel_score=scan.fuel_score,
            whole_food_status=scan.whole_food_status,
            image_bucket=scan.image_bucket,
            image_path=scan.image_path,
            image_mime_type=scan.image_mime_type,
            image_url=scan.image_url,
            meal_type=scan.meal_type,
            portion_size=scan.portion_size,
            source_context=scan.source_context,
        )
    elif body.scan_type == "product":
        scan = db.query(ProductLabelScan).filter(
            ProductLabelScan.id == body.scan_id,
            ProductLabelScan.user_id == current_user.id,
        ).first()
        if not scan:
            raise HTTPException(status_code=404, detail="Product scan not found.")
        analysis = scan.analysis or {}
        fav = ScanFavorite(
            user_id=current_user.id,
            scan_type="product",
            source_scan_id=str(scan.id),
            label=scan.product_name or "Product",
            ingredients=[],
            nutrition_snapshot=analysis.get("nutrition_snapshot") or {},
            fuel_score=analysis.get("score"),
            whole_food_status=None,
            image_bucket=scan.image_bucket,
            image_path=scan.image_path,
            image_mime_type=scan.image_mime_type,
            image_url=scan.image_url,
            barcode=scan.barcode,
            brand=scan.brand,
            product_tier=analysis.get("tier"),
            product_analysis=analysis,
        )
    else:
        raise HTTPException(status_code=400, detail="scan_type must be 'meal' or 'product'.")

    db.add(fav)
    db.commit()
    db.refresh(fav)
    return _serialize_favorite(fav)


@router.get("/favorites")
async def list_favorites(
    scan_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List favorites ordered by most used."""
    from sqlalchemy import desc

    query = db.query(ScanFavorite).filter(
        ScanFavorite.user_id == current_user.id,
    )
    if scan_type:
        query = query.filter(ScanFavorite.scan_type == scan_type)
    query = query.order_by(desc(ScanFavorite.use_count), desc(ScanFavorite.created_at))
    favorites = query.limit(50).all()
    return {"items": [_serialize_favorite(f) for f in favorites]}


@router.delete("/favorites/{favorite_id}")
async def delete_favorite(
    favorite_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a favorite."""
    fav = db.query(ScanFavorite).filter(
        ScanFavorite.id == favorite_id,
        ScanFavorite.user_id == current_user.id,
    ).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found.")
    db.delete(fav)
    db.commit()
    return {"ok": True}


class FavoriteLogRequest(BaseModel):
    date: Optional[str] = None
    meal_type: Optional[str] = None
    servings: float = 1.0
    quantity: float = 1.0
    portion_size: Optional[str] = None


@router.post("/favorites/{favorite_id}/log")
async def log_favorite(
    favorite_id: str,
    body: FavoriteLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a favorite to the food log and increment use_count."""
    fav = db.query(ScanFavorite).filter(
        ScanFavorite.id == favorite_id,
        ScanFavorite.user_id == current_user.id,
    ).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found.")

    log_date = datetime.now(UTC).date()
    if body.date:
        try:
            log_date = datetime.fromisoformat(body.date).date()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    nutrition_snapshot = {
        **(fav.nutrition_snapshot or {}),
        "estimated": True,
        "from_favorite": True,
        "favorite_id": str(fav.id),
        "whole_food_status": fav.whole_food_status,
    }

    log = FoodLog(
        user_id=current_user.id,
        date=log_date,
        meal_type=body.meal_type or fav.meal_type or "meal",
        source_type="scan",
        source_id=str(fav.source_scan_id),
        title=fav.label,
        servings=body.servings,
        quantity=body.quantity,
        nutrition_snapshot=nutrition_snapshot,
        fuel_score=float(fav.fuel_score) if fav.fuel_score is not None else None,
    )
    db.add(log)

    fav.use_count = (fav.use_count or 0) + 1
    fav.last_used_at = datetime.now(UTC)
    db.commit()
    db.refresh(log)

    try:
        on_food_log_created(db, current_user.id, log)
    except Exception:
        logger.warning("MES scoring failed for favorite log %s", log.id, exc_info=True)

    _compute_daily(db, current_user.id, log_date)

    return {
        "ok": True,
        "food_log_id": str(log.id),
        "label": fav.label,
        "fuel_score": float(fav.fuel_score) if fav.fuel_score is not None else None,
    }


@router.get("/favorites/{favorite_id}/is_favorite")
async def check_is_favorite(
    favorite_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if a scan is already favorited (by source_scan_id)."""
    fav = db.query(ScanFavorite).filter(
        ScanFavorite.user_id == current_user.id,
        ScanFavorite.source_scan_id == favorite_id,
    ).first()
    return {"is_favorite": fav is not None, "favorite_id": str(fav.id) if fav else None}
