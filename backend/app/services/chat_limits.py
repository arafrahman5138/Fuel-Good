from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from threading import Lock
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.db import engine
from app.models.chat_usage import ChatUsageEvent
from app.models.user import User
from app.services.billing import build_entitlement_info


_IN_FLIGHT_LOCK = Lock()
_IN_FLIGHT_REQUESTS: dict[str, int] = defaultdict(int)


QUOTA_CONFIG: dict[str, dict[str, Any]] = {
    "trialing": {
        "window_minutes": 10,
        "max_requests_per_window": 5,
        "max_daily_requests": 25,
        "max_daily_generated": 10,
        "max_daily_cost_units": 45,
        "max_concurrent": 1,
    },
    "active": {
        "window_minutes": 10,
        "max_requests_per_window": 20,
        "max_daily_requests": 150,
        "max_daily_generated": 60,
        "max_daily_cost_units": 260,
        "max_concurrent": 2,
    },
    "grace_period": {
        "window_minutes": 10,
        "max_requests_per_window": 20,
        "max_daily_requests": 150,
        "max_daily_generated": 60,
        "max_daily_cost_units": 260,
        "max_concurrent": 2,
    },
}

DEFAULT_CONFIG = {
    "window_minutes": 10,
    "max_requests_per_window": 5,
    "max_daily_requests": 25,
    "max_daily_generated": 10,
    "max_daily_cost_units": 45,
    "max_concurrent": 1,
}

MODE_COST_UNITS = {
    "retrieved": 1.0,
    "generated": 3.0,
    "general": 2.0,
    "unknown": 1.0,
}


def _quota_config(user: User) -> dict[str, Any]:
    entitlement = build_entitlement_info(user)
    return QUOTA_CONFIG.get(entitlement.subscription_state, DEFAULT_CONFIG)


def _ensure_usage_table() -> None:
    ChatUsageEvent.__table__.create(bind=engine, checkfirst=True)


def acquire_chat_slot(user: User) -> None:
    config = _quota_config(user)
    with _IN_FLIGHT_LOCK:
        active = _IN_FLIGHT_REQUESTS[str(user.id)]
        if active >= int(config["max_concurrent"]):
            raise HTTPException(
                status_code=429,
                detail="You already have a chat request in progress. Please wait for it to finish.",
            )
        _IN_FLIGHT_REQUESTS[str(user.id)] = active + 1


def release_chat_slot(user_id: str) -> None:
    with _IN_FLIGHT_LOCK:
        current = _IN_FLIGHT_REQUESTS.get(str(user_id), 0)
        if current <= 1:
            _IN_FLIGHT_REQUESTS.pop(str(user_id), None)
        else:
            _IN_FLIGHT_REQUESTS[str(user_id)] = current - 1


def enforce_chat_quota(db: Session, user: User, route: str = "healthify") -> None:
    config = _quota_config(user)
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=int(config["window_minutes"]))
    day_start = now - timedelta(days=1)

    base = db.query(ChatUsageEvent).filter(
        ChatUsageEvent.user_id == user.id,
        ChatUsageEvent.route == route,
    )

    try:
        requests_in_window = base.filter(ChatUsageEvent.created_at >= window_start).count()
    except ProgrammingError:
        db.rollback()
        _ensure_usage_table()
        requests_in_window = base.filter(ChatUsageEvent.created_at >= window_start).count()
    if requests_in_window >= int(config["max_requests_per_window"]):
        raise HTTPException(
            status_code=429,
            detail="Chat limit reached for the current time window. Please try again later.",
        )

    daily = base.filter(ChatUsageEvent.created_at >= day_start)
    daily_requests = daily.count()
    if daily_requests >= int(config["max_daily_requests"]):
        raise HTTPException(
            status_code=429,
            detail="Daily chat limit reached. Please try again tomorrow or upgrade for higher limits.",
        )

    daily_generated = daily.filter(ChatUsageEvent.response_mode == "generated").count()
    if daily_generated >= int(config["max_daily_generated"]):
        raise HTTPException(
            status_code=429,
            detail="Daily generated-chat limit reached. Please try again tomorrow or upgrade for higher limits.",
        )

    daily_cost = daily.with_entities(func.coalesce(func.sum(ChatUsageEvent.cost_units), 0.0)).scalar() or 0.0
    if float(daily_cost) >= float(config["max_daily_cost_units"]):
        raise HTTPException(
            status_code=429,
            detail="Daily AI usage limit reached. Please try again tomorrow or upgrade for higher limits.",
        )


def record_chat_usage(db: Session, user_id: str, route: str, response_mode: str) -> None:
    mode = (response_mode or "unknown").strip().lower()
    cost_units = MODE_COST_UNITS.get(mode, MODE_COST_UNITS["unknown"])
    event = ChatUsageEvent(
        user_id=user_id,
        route=route,
        response_mode=mode,
        cost_units=cost_units,
    )
    db.add(event)
    try:
        db.commit()
    except ProgrammingError:
        db.rollback()
        _ensure_usage_table()
        db.add(event)
        db.commit()
