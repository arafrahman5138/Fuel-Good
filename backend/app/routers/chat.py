from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import asyncio
import json
import logging
import time
import uuid
from google.api_core.exceptions import ResourceExhausted
from app.db import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.meal_plan import ChatSession
from app.models.metabolic_profile import MetabolicProfile
from app.schemas.chat import ChatRequest, ChatResponse, ChatSessionSummary
from app.agents.healthify import healthify_agent, parse_healthify_response, repair_missing_recipe
from app.services.metabolic_engine import load_budget_for_user, aggregate_daily_totals, remaining_budget
from typing import List, Literal, Optional
from datetime import UTC, date, datetime
from app.services.notifications import record_notification_event
from app.services.chat_limits import acquire_chat_slot, enforce_chat_quota, record_chat_usage, release_chat_slot

router = APIRouter()
logger = logging.getLogger(__name__)

# Global concurrency limit for LLM calls to prevent aggregate overload.
# Per-user limits are handled by chat_limits.py; this caps total server load.
MAX_CONCURRENT_LLM_CALLS = 5
_llm_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM_CALLS)


def _message_preview(message: str, limit: int = 120) -> str:
    compact = " ".join((message or "").split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit]}…"


def _apply_chat_limits_or_raise(db: Session, user: User) -> None:
    try:
        acquire_chat_slot(user)
        enforce_chat_quota(db, user, route="healthify")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("healthify.quota_check.failed error=%s", exc)
        raise HTTPException(
            status_code=429,
            detail="Chat limit check failed. Please try again in a moment.",
        ) from exc


@router.post("/healthify", response_model=ChatResponse)
async def healthify_food(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request_id = str(uuid.uuid4())
    started_at = time.perf_counter()
    _apply_chat_limits_or_raise(db, current_user)

    try:
        logger.info(
            "healthify.request.received request_id=%s user_id=%s session_id=%s chars=%s preview=%r",
            request_id,
            current_user.id,
            request.session_id or "new",
            len(request.message or ""),
            _message_preview(request.message),
        )

        if request.session_id:
            session = db.query(ChatSession).filter(
                ChatSession.id == request.session_id,
                ChatSession.user_id == current_user.id,
            ).with_for_update().first()
            if not session:
                logger.warning(
                    "healthify.request.session_not_found request_id=%s user_id=%s session_id=%s",
                    request_id,
                    current_user.id,
                    request.session_id,
                )
                raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            session = ChatSession(user_id=current_user.id, title=request.message[:50])
            db.add(session)
            db.commit()
            db.refresh(session)
            logger.info(
                "healthify.request.session_created request_id=%s user_id=%s session_id=%s",
                request_id,
                current_user.id,
                session.id,
            )

        messages = session.messages or []
        messages.append({"role": "user", "content": request.message})
        try:
            record_notification_event(
                db, current_user.id, "healthify_started",
                properties={"session_id": str(session.id), "message_preview": _message_preview(request.message, 60)},
                source="server",
            )
        except Exception:
            pass  # Non-critical; don't block the chat request
        try:
            await asyncio.wait_for(_llm_semaphore.acquire(), timeout=2.0)
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=503,
                detail="Healthify AI is at capacity. Please try again in a moment.",
            )
        try:
            result = await asyncio.wait_for(
                healthify_agent(
                    db,
                    request.message,
                    messages[:-1],
                    user_id=current_user.id,
                    chat_context=request.context.model_dump() if request.context else None,
                ),
                timeout=45,
            )
        except asyncio.TimeoutError:
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            logger.warning(
                "healthify.request.timeout request_id=%s user_id=%s session_id=%s elapsed_ms=%s",
                request_id,
                current_user.id,
                session.id,
                elapsed_ms,
            )
            raise HTTPException(
                status_code=503,
                detail="Healthify AI timed out. Please try again with a shorter prompt.",
            )
        except ResourceExhausted:
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            logger.warning(
                "healthify.request.quota_exceeded request_id=%s user_id=%s session_id=%s elapsed_ms=%s",
                request_id,
                current_user.id,
                session.id,
                elapsed_ms,
            )
            raise HTTPException(
                status_code=429,
                detail="AI quota exceeded for the configured model. Please add billing, switch provider, or try again later.",
            )
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            logger.exception(
                "healthify.request.failed request_id=%s user_id=%s session_id=%s elapsed_ms=%s error=%s",
                request_id,
                current_user.id,
                session.id,
                elapsed_ms,
                exc,
            )
            raise HTTPException(
                status_code=503,
                detail="Healthify AI is temporarily unavailable. Please try again shortly.",
            )
        finally:
            _llm_semaphore.release()

        assistant_message = {
            "role": "assistant",
            "content": result["message"],
            "recipe": result.get("recipe"),
            "swaps": result.get("swaps"),
            "nutrition": result.get("nutrition"),
            "mes_score": result.get("mes_score"),
            "response_mode": result.get("response_mode"),
            "matched_recipe_id": result.get("matched_recipe_id"),
            "retrieval_confidence": result.get("retrieval_confidence"),
        }
        messages.append(assistant_message)
        session.messages = messages
        record_chat_usage(db, str(current_user.id), "healthify", result.get("response_mode") or "unknown")
        try:
            record_notification_event(
                db, current_user.id, "healthify_completed",
                properties={"session_id": str(session.id), "has_recipe": bool(result.get("recipe"))},
                source="server",
            )
        except Exception:
            pass
        db.commit()

        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info(
            "healthify.request.completed request_id=%s user_id=%s session_id=%s elapsed_ms=%s has_recipe=%s swaps=%s has_nutrition=%s mode=%s matched_recipe_id=%s retrieval_confidence=%s retrieval_ms=%s",
            request_id,
            current_user.id,
            session.id,
            elapsed_ms,
            bool(result.get("recipe")),
            len(result.get("swaps") or []),
            bool(result.get("nutrition")),
            result.get("response_mode"),
            result.get("matched_recipe_id"),
            result.get("retrieval_confidence"),
            (result.get("retrieval_debug") or {}).get("total"),
        )

        return ChatResponse(
            session_id=str(session.id),
            message=assistant_message,
            healthified_recipe=result.get("recipe"),
            ingredient_swaps=result.get("swaps"),
            nutrition_comparison=result.get("nutrition"),
            mes_score=result.get("mes_score"),
        )
    finally:
        release_chat_slot(str(current_user.id))


@router.post("/healthify/stream")
async def healthify_food_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request_id = str(uuid.uuid4())
    started_at = time.perf_counter()
    _apply_chat_limits_or_raise(db, current_user)

    try:
        logger.info(
            "healthify.stream.received request_id=%s user_id=%s session_id=%s chars=%s preview=%r",
            request_id,
            current_user.id,
            request.session_id or "new",
            len(request.message or ""),
            _message_preview(request.message),
        )

        if request.session_id:
            session = db.query(ChatSession).filter(
                ChatSession.id == request.session_id,
                ChatSession.user_id == current_user.id,
            ).with_for_update().first()
            if not session:
                logger.warning(
                    "healthify.stream.session_not_found request_id=%s user_id=%s session_id=%s",
                    request_id,
                    current_user.id,
                    request.session_id,
                )
                raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            session = ChatSession(user_id=current_user.id, title=request.message[:50])
            db.add(session)
            db.commit()
            db.refresh(session)
            logger.info(
                "healthify.stream.session_created request_id=%s user_id=%s session_id=%s",
                request_id,
                current_user.id,
                session.id,
            )

        messages = session.messages or []
        messages.append({"role": "user", "content": request.message})

        async def generate():
            full_response = ""
            chunk_count = 0
            final_payload = None
            try:
                await asyncio.wait_for(_llm_semaphore.acquire(), timeout=2.0)
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'error': 'Healthify AI is at capacity. Please try again in a moment.'})}\n\n"
                return
            try:
                async with asyncio.timeout(90):
                    stream_gen = await healthify_agent(
                        db,
                        request.message,
                        messages[:-1],
                        stream=True,
                        user_id=current_user.id,
                        chat_context=request.context.model_dump() if request.context else None,
                    )
                    async for chunk in stream_gen:
                        full_response += chunk
                        chunk_count += 1
                        yield f"data: {json.dumps({'content': chunk})}\n\n"
            except (TimeoutError, asyncio.TimeoutError):
                elapsed_ms = int((time.perf_counter() - started_at) * 1000)
                logger.warning(
                    "healthify.stream.timeout request_id=%s user_id=%s session_id=%s elapsed_ms=%s chunks=%s",
                    request_id,
                    current_user.id,
                    session.id,
                    elapsed_ms,
                    chunk_count,
                )
                yield f"data: {json.dumps({'error': 'Healthify AI timed out. Please try again with a shorter prompt.', 'done': True})}\n\n"
                return
            except ResourceExhausted:
                elapsed_ms = int((time.perf_counter() - started_at) * 1000)
                logger.warning(
                    "healthify.stream.quota_exceeded request_id=%s user_id=%s session_id=%s elapsed_ms=%s chunks=%s",
                    request_id,
                    current_user.id,
                    session.id,
                    elapsed_ms,
                    chunk_count,
                )
                yield f"data: {json.dumps({'error': 'AI quota exceeded for the configured model. Please try again later.', 'done': True})}\n\n"
                return
            except Exception as exc:
                elapsed_ms = int((time.perf_counter() - started_at) * 1000)
                logger.exception(
                    "healthify.stream.failed request_id=%s user_id=%s session_id=%s elapsed_ms=%s chunks=%s error=%s",
                    request_id,
                    current_user.id,
                    session.id,
                    elapsed_ms,
                    chunk_count,
                    exc,
                )
                yield f"data: {json.dumps({'error': 'Healthify AI is temporarily unavailable.', 'done': True})}\n\n"
                return
            finally:
                _llm_semaphore.release()
                release_chat_slot(str(current_user.id))

            final_payload = parse_healthify_response(full_response)
            if not final_payload.get("recipe"):
                logger.warning(
                    "healthify.stream.no_recipe request_id=%s user_id=%s session_id=%s response_chars=%s preview=%r",
                    request_id,
                    current_user.id,
                    session.id,
                    len(full_response),
                    full_response[:200],
                )
                # Repair: retry with a strict prompt to get a valid recipe
                repaired = await repair_missing_recipe(request.message)
                if repaired:
                    if repaired.get("recipe"):
                        final_payload["recipe"] = repaired["recipe"]
                        final_payload["message"] = repaired.get("message") or final_payload.get("message")
                        final_payload["swaps"] = repaired.get("swaps") or final_payload.get("swaps")
                        final_payload["nutrition"] = repaired.get("nutrition") or final_payload.get("nutrition")
                        logger.info(
                            "healthify.stream.repair_succeeded request_id=%s user_id=%s",
                            request_id,
                            current_user.id,
                        )
            messages.append(
                {
                    "role": "assistant",
                    "content": final_payload.get("message") or full_response,
                    "recipe": final_payload.get("recipe"),
                    "swaps": final_payload.get("swaps"),
                    "nutrition": final_payload.get("nutrition"),
                    "mes_score": final_payload.get("mes_score"),
                    "response_mode": final_payload.get("response_mode"),
                    "matched_recipe_id": final_payload.get("matched_recipe_id"),
                    "retrieval_confidence": final_payload.get("retrieval_confidence"),
                }
            )
            session.messages = messages
            db.commit()
            record_chat_usage(db, str(current_user.id), "healthify", (final_payload or {}).get("response_mode") or "generated")

            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            logger.info(
                "healthify.stream.completed request_id=%s user_id=%s session_id=%s elapsed_ms=%s chunks=%s response_chars=%s",
                request_id,
                current_user.id,
                session.id,
                elapsed_ms,
                chunk_count,
                len(full_response),
            )
            yield f"data: {json.dumps({'done': True, 'session_id': str(session.id), 'payload': final_payload})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception:
        release_chat_slot(str(current_user.id))
        raise


@router.get("/sessions", response_model=List[ChatSessionSummary])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = db.query(ChatSession).filter(
        ChatSession.user_id == current_user.id
    ).order_by(ChatSession.updated_at.desc()).all()

    return [
        ChatSessionSummary(
            id=str(s.id),
            title=s.title,
            created_at=s.created_at.isoformat(),
            message_count=len(s.messages or []),
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": str(session.id),
        "title": session.title,
        "messages": session.messages or [],
        "created_at": session.created_at.isoformat(),
    }


# ── Suggestion pools by category ──

_BASE_FUN = [
    "Mac and Cheese", "Pizza", "Burger and Fries",
    "Chocolate Cake", "Fried Chicken", "Ice Cream",
]

_LOW_CARB_FUN = [
    "Cauliflower Fried Rice", "Zucchini Lasagna",
    "Lettuce Wrap Tacos", "Eggplant Parmesan",
    "Stuffed Bell Peppers", "Chicken Crust Pizza",
]

_FAT_LOSS = [
    "Grilled Chicken Caesar Salad", "Turkey Lettuce Wraps",
    "Shrimp Stir Fry", "Salmon with Roasted Veggies",
    "Greek Yogurt Parfait", "Egg White Veggie Omelette",
]

_MUSCLE_GAIN = [
    "Steak and Eggs", "Chicken Stir Fry with Rice",
    "Protein Overnight Oats", "Salmon Power Bowl",
    "Turkey Meatballs", "Beef and Broccoli",
]

_METABOLIC_RESET = [
    "Mediterranean Salmon Bowl", "Lentil Soup",
    "Grilled Fish with Greens", "Chickpea Buddha Bowl",
    "Herb-Crusted Chicken", "Veggie Frittata",
]

_PLANT_BASED = [
    "Lentil Soup", "Chickpea Buddha Bowl", "Tofu Stir Fry",
    "Black Bean Tacos", "Quinoa Power Bowl", "Veggie Curry",
    "Sweet Potato Black Bean Bowl", "Falafel Wrap",
]

# Tags for dietary/allergen filtering: maps suggestion name → set of tags
# Tags: meat proteins, seafood, dairy, eggs, gluten, tree_nuts, peanuts, soy, shellfish
_SUGGESTION_TAGS: dict[str, set[str]] = {
    # Base fun
    "Mac and Cheese": {"dairy", "gluten"},
    "Pizza": {"dairy", "gluten"},
    "Burger and Fries": {"beef", "gluten"},
    "Chocolate Cake": {"dairy", "gluten", "eggs"},
    "Fried Chicken": {"chicken", "gluten"},
    "Ice Cream": {"dairy"},
    # Low carb fun
    "Cauliflower Fried Rice": {"eggs"},
    "Zucchini Lasagna": {"dairy"},
    "Lettuce Wrap Tacos": {"beef"},
    "Eggplant Parmesan": {"dairy", "gluten"},
    "Stuffed Bell Peppers": {"beef"},
    "Chicken Crust Pizza": {"chicken", "dairy"},
    # Fat loss
    "Grilled Chicken Caesar Salad": {"chicken", "dairy", "eggs"},
    "Turkey Lettuce Wraps": {"turkey"},
    "Shrimp Stir Fry": {"shellfish", "shrimp", "soy"},
    "Salmon with Roasted Veggies": {"fish", "salmon"},
    "Greek Yogurt Parfait": {"dairy"},
    "Egg White Veggie Omelette": {"eggs"},
    # Muscle gain
    "Steak and Eggs": {"beef", "steak", "eggs"},
    "Chicken Stir Fry with Rice": {"chicken", "soy"},
    "Protein Overnight Oats": {"dairy", "gluten"},
    "Salmon Power Bowl": {"fish", "salmon"},
    "Turkey Meatballs": {"turkey"},
    "Beef and Broccoli": {"beef", "soy"},
    # Metabolic reset
    "Mediterranean Salmon Bowl": {"fish", "salmon"},
    "Lentil Soup": set(),
    "Grilled Fish with Greens": {"fish"},
    "Chickpea Buddha Bowl": set(),
    "Herb-Crusted Chicken": {"chicken"},
    "Veggie Frittata": {"eggs", "dairy"},
    # Plant-based (universal fallback)
    "Tofu Stir Fry": {"soy"},
    "Black Bean Tacos": set(),
    "Quinoa Power Bowl": set(),
    "Veggie Curry": set(),
    "Sweet Potato Black Bean Bowl": set(),
    "Falafel Wrap": {"gluten"},
}

# Which tags indicate meat/animal protein (for vegetarian/vegan filtering)
_MEAT_TAGS = {"beef", "steak", "chicken", "turkey", "pork", "lamb", "fish", "salmon", "shellfish", "shrimp"}
_ANIMAL_TAGS = _MEAT_TAGS | {"dairy", "eggs"}

# Map common allergy names → tag names
_ALLERGY_TAG_MAP: dict[str, set[str]] = {
    "dairy": {"dairy"},
    "milk": {"dairy"},
    "eggs": {"eggs"},
    "egg": {"eggs"},
    "nuts": {"tree_nuts"},
    "tree nuts": {"tree_nuts"},
    "tree nut": {"tree_nuts"},
    "peanuts": {"peanuts"},
    "peanut": {"peanuts"},
    "soy": {"soy"},
    "soybean": {"soy"},
    "fish": {"fish", "salmon"},
    "shellfish": {"shellfish", "shrimp"},
    "shrimp": {"shrimp", "shellfish"},
    "gluten": {"gluten"},
    "wheat": {"gluten"},
    "sesame": {"sesame"},
}


def _filter_suggestions(suggestions: list[str], user: User | None) -> list[str]:
    """Filter suggestion list by user's dietary preferences, allergies, and protein preferences."""
    if not user:
        return suggestions

    excluded_tags: set[str] = set()

    # Dietary preferences (vegetarian, vegan, pescatarian, etc.)
    for pref in (user.dietary_preferences or []):
        pref_lower = str(pref).lower()
        if "vegan" in pref_lower:
            excluded_tags |= _ANIMAL_TAGS
        elif "vegetarian" in pref_lower:
            excluded_tags |= _MEAT_TAGS
        elif "pescatarian" in pref_lower:
            excluded_tags |= (_MEAT_TAGS - {"fish", "salmon", "shellfish", "shrimp"})

    # Allergies
    for allergy in (user.allergies or []):
        allergy_lower = str(allergy).lower()
        mapped = _ALLERGY_TAG_MAP.get(allergy_lower)
        if mapped:
            excluded_tags |= mapped
        else:
            # Direct tag match as fallback
            excluded_tags.add(allergy_lower)

    # Protein preferences — disliked proteins
    protein_prefs = user.protein_preferences or {}
    if isinstance(protein_prefs, dict):
        for disliked in (protein_prefs.get("disliked") or []):
            dl = str(disliked).lower()
            excluded_tags.add(dl)
            # Also map common protein names
            mapped = _ALLERGY_TAG_MAP.get(dl)
            if mapped:
                excluded_tags |= mapped

    if not excluded_tags:
        return suggestions

    return [s for s in suggestions if not (_SUGGESTION_TAGS.get(s, set()) & excluded_tags)]


class ChatReportRequest(BaseModel):
    session_id: Optional[str] = None
    message_content: str = Field(..., min_length=1, max_length=10000)
    reason: Literal["harmful", "inaccurate", "inappropriate", "other"]
    notes: Optional[str] = Field(default=None, max_length=2000)


@router.post("/report")
async def report_chat_message(
    payload: ChatReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User-submitted moderation report for an AI-generated chat response.

    Required by App Store Guideline on user-generated / AI-generated content:
    provide a mechanism for users to flag objectionable responses. Each report
    is persisted as a notification_event so operators can review in the admin
    pipeline without introducing a new table/migration on submission day.
    """
    try:
        excerpt = payload.message_content[:1000]
        record_notification_event(
            db,
            user_id=current_user.id,
            event_type="chat_report_submitted",
            properties={
                "reason": payload.reason,
                "session_id": payload.session_id,
                "message_excerpt": excerpt,
                "notes": (payload.notes or "")[:500] or None,
                "reported_at": datetime.now(UTC).isoformat(),
            },
            source="user",
        )
        db.commit()
        logger.warning(
            "chat_report_submitted reason=%s session=%s user_id=%s",
            payload.reason,
            payload.session_id or "n/a",
            current_user.id,
        )
    except Exception:
        logger.exception("Failed to persist chat report; acknowledging to client anyway")
    return {"ok": True}


@router.get("/suggestions")
async def get_chat_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return 8 profile-aware meal suggestions for the chat quick-start chips."""
    import random

    profile = db.query(MetabolicProfile).filter(
        MetabolicProfile.user_id == current_user.id,
    ).first()

    # Default: generic fun suggestions
    if not profile or not profile.goal:
        suggestions = _filter_suggestions(list(_BASE_FUN), current_user)
        random.shuffle(suggestions)
        return [{"label": s, "query": s} for s in suggestions[:8]]

    is_ir = bool(profile.insulin_resistant or profile.type_2_diabetes)
    goal = (profile.goal or "").lower()

    # Pick goal-specific pool
    if goal in ("fat_loss",):
        goal_pool = list(_FAT_LOSS)
    elif goal in ("muscle_gain",):
        goal_pool = list(_MUSCLE_GAIN)
    elif goal in ("metabolic_reset",):
        goal_pool = list(_METABOLIC_RESET)
    else:
        goal_pool = list(_FAT_LOSS[:2] + _MUSCLE_GAIN[:2])

    # Pick fun/discovery pool (low-carb if IR/T2D)
    fun_pool = list(_LOW_CARB_FUN) if is_ir else list(_BASE_FUN)

    # Budget-aware adjustments
    try:
        budget = load_budget_for_user(db, current_user.id)
        totals = aggregate_daily_totals(db, current_user.id, datetime.now(UTC).date())
        rem = remaining_budget(totals, budget)
        protein_left = rem.get("protein_remaining_g", 0)
        carb_left = rem.get("carb_headroom_g", rem.get("sugar_headroom_g", 999))

        if carb_left < 30 and not is_ir:
            # Switch to low-carb fun even for non-IR users with tight budget
            fun_pool = list(_LOW_CARB_FUN)
        if protein_left > 50:
            # Boost protein-forward options
            goal_pool = list(_MUSCLE_GAIN) + goal_pool[:2]
    except Exception:
        pass

    # Filter by dietary preferences, allergies, and protein preferences
    goal_pool = _filter_suggestions(goal_pool, current_user)
    fun_pool = _filter_suggestions(fun_pool, current_user)

    random.shuffle(goal_pool)
    random.shuffle(fun_pool)

    # 5 goal-specific + 3 fun/discovery
    combined = goal_pool[:5] + fun_pool[:3]
    # Deduplicate while preserving order
    seen = set()
    result = []
    for s in combined:
        if s not in seen:
            seen.add(s)
            result.append(s)
        if len(result) >= 8:
            break

    # Fallback: if filtering eliminated too many suggestions, backfill from plant-based pool
    if len(result) < 3:
        fallback_pool = _filter_suggestions(list(_PLANT_BASED) + list(_METABOLIC_RESET), current_user)
        random.shuffle(fallback_pool)
        for s in fallback_pool:
            if s not in seen:
                seen.add(s)
                result.append(s)
            if len(result) >= 8:
                break

    return [{"label": s, "query": s} for s in result]
