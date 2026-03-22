from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
from app.agents.healthify import healthify_agent, parse_healthify_response
from app.services.metabolic_engine import load_budget_for_user, aggregate_daily_totals, remaining_budget
from typing import List
from datetime import UTC, date, datetime
from app.services.notifications import record_notification_event
from app.services.chat_limits import acquire_chat_slot, enforce_chat_quota, record_chat_usage, release_chat_slot

router = APIRouter()
logger = logging.getLogger(__name__)


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
        logger.exception("healthify.quota_check.failed user_id=%s error=%s", user.id, exc)
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
            ).first()
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
        record_notification_event(
            db,
            current_user.id,
            "healthify_started",
            properties={"session_id": str(session.id), "message_preview": _message_preview(request.message, 60)},
            source="server",
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
        db.commit()
        record_chat_usage(db, str(current_user.id), "healthify", result.get("response_mode") or "unknown")
        record_notification_event(
            db,
            current_user.id,
            "healthify_completed",
            properties={"session_id": str(session.id), "has_recipe": bool(result.get("recipe"))},
            source="server",
        )
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
            ).first()
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
                async with asyncio.timeout(45):
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
            except TimeoutError:
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
                release_chat_slot(str(current_user.id))

            final_payload = parse_healthify_response(full_response)
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
        suggestions = list(_BASE_FUN)
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

    return [{"label": s, "query": s} for s in result]
