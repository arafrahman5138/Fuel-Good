import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models.gamification import DailyQuest
from app.models.grocery import GroceryList
from app.models.meal_plan import ChatSession, MealPlan, MealPlanItem
from app.models.notification import (
    NotificationDelivery,
    NotificationEvent,
    NotificationPreference,
    UserPushToken,
)
from app.models.nutrition import DailyNutritionSummary, FoodLog
from app.models.recipe import Recipe
from app.models.saved_recipe import SavedRecipe
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
NOTIFICATION_CATEGORIES = {
    "plan_kickoff": "plan",
    "cook_tonight": "cook",
    "grocery_follow_through": "grocery",
    "streak_protection": "streak",
    "quest_progress": "quest",
    "reactivation_3d": "reactivation",
    "reactivation_7d": "reactivation",
    "reactivation_14d": "reactivation",
    "healthify_callback": "healthify",
}
CATEGORY_PRIORITY = {
    "cook_tonight": 5,
    "grocery_follow_through": 5,
    "streak_protection": 4,
    "plan_kickoff": 3,
    "quest_progress": 3,
    "healthify_callback": 2,
    "reactivation_3d": 1,
    "reactivation_7d": 1,
    "reactivation_14d": 1,
}
TEMPLATES: dict[str, list[dict[str, str]]] = {
    "plan_kickoff": [
        {"title": "Plan your week", "body": "Set up this week's meals in 2 minutes."},
        {"title": "Make dinner easier", "body": "Build your meal plan now and make the week feel lighter."},
        {"title": "Start with a plan", "body": "Pick this week's meals before the day gets away from you."},
    ],
    "cook_tonight": [
        {"title": "Tonight's dinner is ready", "body": "Start with {recipe_title} and keep dinner simple."},
        {"title": "You've already picked dinner", "body": "Open {recipe_title} and start cooking."},
        {"title": "Dinner is one tap away", "body": "Cook {recipe_title} tonight and keep your rhythm going."},
    ],
    "grocery_follow_through": [
        {"title": "Your plan is ready", "body": "Turn it into a shopping list before the week gets busy."},
        {"title": "Finish the easy part", "body": "Your meal plan is waiting. Build the grocery list now."},
        {"title": "Keep this week moving", "body": "Open your plan and turn it into a grocery list."},
    ],
    "streak_protection": [
        {"title": "Keep your streak alive", "body": "You can still protect your streak with one quick check-in today."},
        {"title": "You're still in it", "body": "Log one meal or open your plan to keep your streak going."},
        {"title": "Don't lose today's momentum", "body": "One useful action today keeps your streak intact."},
    ],
    "quest_progress": [
        {"title": "You're one step away", "body": "Finish one more action to close out today's progress."},
        {"title": "Close today's loop", "body": "You're close to finishing a quest. Take one quick action now."},
        {"title": "Today's progress is within reach", "body": "Open the app and finish the next best action."},
    ],
    "reactivation_3d": [
        {"title": "Dinner can be easier tonight", "body": "Pick up where you left off with a fast whole-food meal."},
        {"title": "Need a quick reset?", "body": "Your plan, saved meals, and coach are ready when you are."},
        {"title": "Make tonight simple", "body": "Open the app for one practical next meal."},
    ],
    "reactivation_7d": [
        {"title": "Ready to reset the week?", "body": "Start with a fresh meal plan and make the next few days easier."},
        {"title": "Let's make food easier again", "body": "Open your next best meal plan instead of figuring it out later."},
        {"title": "Your next meal can be simple", "body": "Come back to a practical plan, not another food decision spiral."},
    ],
    "reactivation_14d": [
        {"title": "Start small", "body": "Open one saved meal or build a quick plan for this week."},
        {"title": "Make the next meal easier", "body": "You don't need a full reset. Start with one useful dinner idea."},
        {"title": "Pick one good next step", "body": "Your saved meals and whole-food ideas are still here."},
    ],
    "healthify_callback": [
        {"title": "Want to finish that recipe?", "body": "I can keep going on your whole-food version of {dish_name}."},
        {"title": "Your Healthify idea is still here", "body": "Want me to finish the whole-food take on {dish_name}?"},
        {"title": "Pick up where you left off", "body": "Jump back into Healthify and finish {dish_name}."},
    ],
}
CONVERSION_EVENT_TYPES = {
    "plan_kickoff": {"meal_plan_created", "meal_plan_viewed"},
    "cook_tonight": {"cook_started", "food_logged_today"},
    "grocery_follow_through": {"grocery_generated", "grocery_viewed"},
    "streak_protection": {"streak_updated", "food_logged_today"},
    "quest_progress": {"quest_progressed", "daily_mes_updated"},
    "healthify_callback": {"healthify_completed", "recipe_saved"},
    "reactivation_3d": {"app_opened", "meal_plan_viewed", "healthify_started"},
    "reactivation_7d": {"app_opened", "meal_plan_viewed", "healthify_started"},
    "reactivation_14d": {"app_opened", "meal_plan_viewed", "healthify_started"},
}


@dataclass
class CandidateNotification:
    category: str
    route: str
    metadata: dict[str, Any]
    triggered_by_event: Optional[str]
    score: int
    title: str
    body: str


def default_categories() -> dict[str, bool]:
    return {
        "plan": True,
        "cook": True,
        "grocery": True,
        "streak": True,
        "quest": True,
        "reactivation": True,
        "healthify": True,
        "promotional": False,
    }


def get_or_create_preferences(db: Session, user_id: str) -> NotificationPreference:
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if pref:
        pref.categories = {**default_categories(), **(pref.categories or {})}
        return pref

    user = db.query(User).filter(User.id == user_id).first()
    timezone = "UTC"
    if user and getattr(user.last_active_date, "tzinfo", None) is not None:
        timezone = "UTC"

    pref = NotificationPreference(user_id=user_id, timezone=timezone, categories=default_categories())
    db.add(pref)
    db.flush()
    return pref


def register_push_token(
    db: Session,
    user_id: str,
    expo_push_token: str,
    device_id: Optional[str],
    platform: str,
    app_version: str,
) -> UserPushToken:
    token = db.query(UserPushToken).filter(UserPushToken.expo_push_token == expo_push_token).first()
    if token:
        token.user_id = user_id
        token.device_id = device_id
        token.platform = platform
        token.app_version = app_version
        token.enabled = True
        token.invalidated_at = None
        token.last_seen_at = datetime.utcnow()
        db.flush()
        return token

    token = UserPushToken(
        user_id=user_id,
        expo_push_token=expo_push_token,
        device_id=device_id,
        platform=platform,
        app_version=app_version,
        enabled=True,
        last_seen_at=datetime.utcnow(),
    )
    db.add(token)
    db.flush()
    return token


def deactivate_push_token(db: Session, user_id: str, token_id: str) -> bool:
    token = (
        db.query(UserPushToken)
        .filter(UserPushToken.id == token_id, UserPushToken.user_id == user_id)
        .first()
    )
    if not token:
        return False

    token.enabled = False
    token.invalidated_at = datetime.utcnow()
    db.flush()
    return True


def record_notification_event(
    db: Session,
    user_id: str,
    event_type: str,
    properties: Optional[dict[str, Any]] = None,
    source: str = "system",
    occurred_at: Optional[datetime] = None,
) -> NotificationEvent:
    event = NotificationEvent(
        user_id=user_id,
        event_type=event_type,
        properties=properties or {},
        source=source,
        occurred_at=occurred_at or datetime.utcnow(),
    )
    db.add(event)
    db.flush()
    _apply_conversions_for_event(db, user_id, event)
    return event


def process_user_notifications(db: Session, user_id: str, now: Optional[datetime] = None) -> list[NotificationDelivery]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []

    pref = get_or_create_preferences(db, user_id)
    tokens = (
        db.query(UserPushToken)
        .filter(UserPushToken.user_id == user_id, UserPushToken.enabled.is_(True), UserPushToken.invalidated_at.is_(None))
        .all()
    )
    if not pref.push_enabled or not tokens:
        return []

    now_utc = now or datetime.utcnow()
    localized_now = _user_now(pref, now_utc)
    if _is_quiet_hours(pref, localized_now):
        return []

    candidates = _build_candidates(db, user, pref, localized_now, now_utc)
    if not candidates:
        return []

    candidate = max(candidates, key=lambda item: item.score)
    if not _passes_send_caps(db, user, pref, now_utc, candidate.category):
        return []

    deliveries: list[NotificationDelivery] = []
    for token in tokens:
        delivery = NotificationDelivery(
            user_id=user_id,
            push_token_id=token.id,
            category=candidate.category,
            status="pending",
            title=candidate.title,
            body=candidate.body,
            route=candidate.route,
            metadata_json=candidate.metadata,
            triggered_by_event=candidate.triggered_by_event,
            eligibility_score=candidate.score,
        )
        db.add(delivery)
        db.flush()
        _send_expo_push(db, token, delivery)
        deliveries.append(delivery)

    return deliveries


def process_due_notifications(now: Optional[datetime] = None) -> int:
    db = SessionLocal()
    try:
        count = 0
        users = db.query(User).all()
        for user in users:
            deliveries = process_user_notifications(db, user.id, now)
            if deliveries:
                count += len(deliveries)
        db.commit()
        return count
    except Exception:
        db.rollback()
        logger.exception("notification_cycle.failed")
        return 0
    finally:
        db.close()


def send_test_notification_to_user(
    db: Session,
    user_id: str,
    category: str,
    title: str,
    body: str,
    route: str,
    metadata: Optional[dict[str, Any]] = None,
) -> list[NotificationDelivery]:
    tokens = (
        db.query(UserPushToken)
        .filter(UserPushToken.user_id == user_id, UserPushToken.enabled.is_(True), UserPushToken.invalidated_at.is_(None))
        .all()
    )
    deliveries: list[NotificationDelivery] = []
    for token in tokens:
        delivery = NotificationDelivery(
            user_id=user_id,
            push_token_id=token.id,
            category=category,
            status="pending",
            title=title,
            body=body,
            route=route,
            metadata_json=metadata or {},
            triggered_by_event="manual_test",
            eligibility_score=999,
        )
        db.add(delivery)
        db.flush()
        _send_expo_push(db, token, delivery)
        deliveries.append(delivery)
    return deliveries


async def notification_scheduler_loop(poll_seconds: int = 900) -> None:
    while True:
        try:
            sent = await asyncio.to_thread(process_due_notifications)
            logger.info("notification_cycle.completed sent=%s poll_seconds=%s", sent, poll_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("notification_scheduler.tick_failed")
        await asyncio.sleep(poll_seconds)


def _user_now(pref: NotificationPreference, now_utc: datetime) -> datetime:
    timezone = pref.timezone or "UTC"
    try:
        zone = ZoneInfo(timezone)
    except Exception:
        zone = ZoneInfo("UTC")
    return now_utc.replace(tzinfo=UTC).astimezone(zone)


def _parse_hhmm(value: str, fallback: str) -> time:
    raw = value or fallback
    hour, minute = raw.split(":")
    return time(hour=int(hour), minute=int(minute))


def _is_quiet_hours(pref: NotificationPreference, local_now: datetime) -> bool:
    start = _parse_hhmm(pref.quiet_hours_start, "21:30")
    end = _parse_hhmm(pref.quiet_hours_end, "08:00")
    current = local_now.timetz().replace(tzinfo=None)

    if start < end:
        return start <= current < end
    return current >= start or current < end


def _in_meal_window(pref: NotificationPreference, local_now: datetime) -> bool:
    start = _parse_hhmm(pref.preferred_meal_window_start, "17:00")
    end = _parse_hhmm(pref.preferred_meal_window_end, "19:30")
    current = local_now.timetz().replace(tzinfo=None)
    return start <= current <= end


def _passes_send_caps(
    db: Session,
    user: User,
    pref: NotificationPreference,
    now_utc: datetime,
    category: str,
) -> bool:
    twelve_hours_ago = now_utc - timedelta(hours=12)
    sent_recent = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.status == "sent",
            NotificationDelivery.sent_at >= twelve_hours_ago,
        )
        .count()
    )
    if sent_recent >= 1:
        return False

    local_today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    sent_today = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.status == "sent",
            NotificationDelivery.sent_at >= local_today_start,
        )
        .count()
    )
    if sent_today >= (pref.max_notifications_per_day or 1):
        return False

    weekly_cap = pref.max_notifications_per_week or 5
    if not user.last_active_date or (now_utc.date() - user.last_active_date.date()).days >= 7:
        weekly_cap = min(weekly_cap, 3)
    week_ago = now_utc - timedelta(days=7)
    sent_week = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.status == "sent",
            NotificationDelivery.sent_at >= week_ago,
        )
        .count()
    )
    if sent_week >= weekly_cap:
        return False

    twenty_four_hours_ago = now_utc - timedelta(hours=24)
    recent_conversions = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.conversion_at.is_not(None),
            NotificationDelivery.conversion_at >= twenty_four_hours_ago,
        )
        .count()
    )
    if recent_conversions > 0:
        return False

    same_day_higher_priority = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.status == "sent",
            NotificationDelivery.sent_at >= local_today_start,
        )
        .all()
    )
    for delivery in same_day_higher_priority:
        if CATEGORY_PRIORITY.get(delivery.category, 0) >= CATEGORY_PRIORITY.get(category, 0):
            return False

    return True


def _build_candidates(
    db: Session,
    user: User,
    pref: NotificationPreference,
    local_now: datetime,
    now_utc: datetime,
) -> list[CandidateNotification]:
    candidates: list[CandidateNotification] = []
    categories = {**default_categories(), **(pref.categories or {})}

    if categories.get("plan"):
        candidate = _candidate_plan_kickoff(db, user, local_now, now_utc)
        if candidate:
            candidates.append(candidate)

    if categories.get("cook"):
        candidate = _candidate_cook_tonight(db, user, pref, local_now)
        if candidate:
            candidates.append(candidate)

    if categories.get("grocery"):
        candidate = _candidate_grocery_follow_through(db, user, now_utc)
        if candidate:
            candidates.append(candidate)

    if categories.get("streak"):
        candidate = _candidate_streak_protection(db, user, local_now, now_utc)
        if candidate:
            candidates.append(candidate)

    if categories.get("quest"):
        candidate = _candidate_quest_progress(db, user, local_now)
        if candidate:
            candidates.append(candidate)

    if categories.get("healthify"):
        candidate = _candidate_healthify_callback(db, user, now_utc)
        if candidate:
            candidates.append(candidate)

    if categories.get("reactivation"):
        candidate = _candidate_reactivation(db, user, now_utc)
        if candidate:
            candidates.append(candidate)

    return [c for c in candidates if not _already_sent_recently(db, user.id, c.category, now_utc)]


def _already_sent_recently(db: Session, user_id: str, category: str, now_utc: datetime) -> bool:
    lookback = now_utc - timedelta(days=7 if category.startswith("reactivation") else 2)
    return (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user_id,
            NotificationDelivery.category == category,
            NotificationDelivery.sent_at >= lookback,
            NotificationDelivery.status == "sent",
        )
        .count()
        > 0
    )


def _last_event_time(db: Session, user_id: str, event_type: str) -> Optional[datetime]:
    event = (
        db.query(NotificationEvent)
        .filter(NotificationEvent.user_id == user_id, NotificationEvent.event_type == event_type)
        .order_by(NotificationEvent.occurred_at.desc())
        .first()
    )
    return event.occurred_at if event else None


def _candidate_plan_kickoff(db: Session, user: User, local_now: datetime, now_utc: datetime) -> Optional[CandidateNotification]:
    if local_now.weekday() not in {0, 6} or local_now.hour < 9:
        return None

    latest_plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )
    this_week_start = date.today() - timedelta(days=date.today().weekday())
    if latest_plan and latest_plan.week_start >= this_week_start:
        return None

    title, body = _pick_template("plan_kickoff", user.id, {})
    return CandidateNotification(
        category="plan_kickoff",
        route="/(tabs)/meals?tab=plan",
        metadata={},
        triggered_by_event="schedule",
        score=_score_candidate("plan_kickoff", recency_fit=2, behavior_match=2, goal_relevance=3),
        title=title,
        body=body,
    )


def _candidate_cook_tonight(db: Session, user: User, pref: NotificationPreference, local_now: datetime) -> Optional[CandidateNotification]:
    if not _in_meal_window(pref, local_now):
        return None

    latest_plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )
    if not latest_plan:
        return None

    weekday = local_now.strftime("%A")
    dinner_item = (
        db.query(MealPlanItem)
        .filter(
            MealPlanItem.meal_plan_id == latest_plan.id,
            MealPlanItem.day_of_week == weekday,
            MealPlanItem.meal_type == "dinner",
        )
        .first()
    )
    if not dinner_item:
        return None

    logged_today = (
        db.query(FoodLog)
        .filter(FoodLog.user_id == user.id, FoodLog.date == local_now.date())
        .count()
    )
    if logged_today > 0:
        return None

    recipe_title = (dinner_item.recipe_data or {}).get("title") or "tonight's meal"
    route = f"/cook/{dinner_item.recipe_id}" if dinner_item.recipe_id else "/(tabs)/meals?tab=plan"
    context = {"recipe_title": recipe_title}
    title, body = _pick_template("cook_tonight", user.id, context)
    return CandidateNotification(
        category="cook_tonight",
        route=route,
        metadata={"recipe_id": dinner_item.recipe_id, "recipe_title": recipe_title},
        triggered_by_event="schedule",
        score=_score_candidate("cook_tonight", recency_fit=3, behavior_match=3, goal_relevance=4),
        title=title,
        body=body,
    )


def _candidate_grocery_follow_through(db: Session, user: User, now_utc: datetime) -> Optional[CandidateNotification]:
    latest_plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )
    if not latest_plan:
        return None

    age = now_utc - latest_plan.created_at
    if age < timedelta(hours=12) or age > timedelta(hours=36):
        return None

    grocery = (
        db.query(GroceryList)
        .filter(GroceryList.user_id == user.id, GroceryList.meal_plan_id == latest_plan.id)
        .first()
    )
    viewed_at = _last_event_time(db, user.id, "grocery_viewed")
    if grocery or (viewed_at and viewed_at >= latest_plan.created_at):
        return None

    title, body = _pick_template("grocery_follow_through", user.id, {})
    return CandidateNotification(
        category="grocery_follow_through",
        route="/(tabs)/meals?tab=grocery",
        metadata={"meal_plan_id": str(latest_plan.id)},
        triggered_by_event="meal_plan_created",
        score=_score_candidate("grocery_follow_through", recency_fit=3, behavior_match=3, goal_relevance=4),
        title=title,
        body=body,
    )


def _candidate_streak_protection(db: Session, user: User, local_now: datetime, now_utc: datetime) -> Optional[CandidateNotification]:
    if (user.current_streak or 0) <= 0 or local_now.hour < 16:
        return None

    last_active = user.last_active_date.date() if user.last_active_date else None
    if last_active == now_utc.date():
        return None

    title, body = _pick_template("streak_protection", user.id, {"streak_length": user.current_streak or 0})
    return CandidateNotification(
        category="streak_protection",
        route="/(tabs)/index",
        metadata={"streak_length": user.current_streak or 0},
        triggered_by_event="streak_risk",
        score=_score_candidate("streak_protection", recency_fit=2, behavior_match=3, goal_relevance=4),
        title=title,
        body=body,
    )


def _candidate_quest_progress(db: Session, user: User, local_now: datetime) -> Optional[CandidateNotification]:
    quest = (
        db.query(DailyQuest)
        .filter(DailyQuest.user_id == user.id, DailyQuest.date == local_now.date(), DailyQuest.completed.is_(False))
        .order_by(DailyQuest.current_value.desc())
        .first()
    )
    if not quest:
        return None

    remaining = (quest.target_value or 0) - (quest.current_value or 0)
    if remaining > 1:
        return None

    title, body = _pick_template("quest_progress", user.id, {})
    return CandidateNotification(
        category="quest_progress",
        route="/(tabs)/index",
        metadata={"quest_id": str(quest.id)},
        triggered_by_event="quest_progressed",
        score=_score_candidate("quest_progress", recency_fit=2, behavior_match=2, goal_relevance=2),
        title=title,
        body=body,
    )


def _candidate_healthify_callback(db: Session, user: User, now_utc: datetime) -> Optional[CandidateNotification]:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .first()
    )
    if not session:
        return None

    age = now_utc - (session.updated_at or session.created_at)
    if age < timedelta(hours=4) or age > timedelta(hours=36):
        return None

    if _last_event_time(db, user.id, "recipe_saved") and _last_event_time(db, user.id, "recipe_saved") >= session.updated_at:
        return None

    messages = session.messages or []
    user_messages = [m.get("content", "") for m in messages if m.get("role") == "user"]
    dish_name = (user_messages[-1] if user_messages else session.title or "that dish").strip()
    dish_name = dish_name[:40] if dish_name else "that dish"
    context = {"dish_name": dish_name}
    title, body = _pick_template("healthify_callback", user.id, context)
    return CandidateNotification(
        category="healthify_callback",
        route="/(tabs)/chat",
        metadata={"session_id": str(session.id), "dish_name": dish_name},
        triggered_by_event="healthify_started",
        score=_score_candidate("healthify_callback", recency_fit=2, behavior_match=2, goal_relevance=2),
        title=title,
        body=body,
    )


def _candidate_reactivation(db: Session, user: User, now_utc: datetime) -> Optional[CandidateNotification]:
    if not user.last_active_date:
        return None

    inactive_days = (now_utc.date() - user.last_active_date.date()).days
    if inactive_days not in {3, 7, 14}:
        return None

    category = f"reactivation_{inactive_days}d"
    route = "/(tabs)/meals?tab=plan"
    if db.query(SavedRecipe).filter(SavedRecipe.user_id == user.id).count() > 0:
        route = "/saved"
    title, body = _pick_template(category, user.id, {})
    return CandidateNotification(
        category=category,
        route=route,
        metadata={"inactive_days": inactive_days},
        triggered_by_event="inactivity",
        score=_score_candidate(category, recency_fit=3, behavior_match=2, goal_relevance=1),
        title=title,
        body=body,
    )


def _score_candidate(category: str, recency_fit: int, behavior_match: int, goal_relevance: int) -> int:
    return CATEGORY_PRIORITY.get(category, 0) + recency_fit + behavior_match + goal_relevance


def _pick_template(category: str, user_id: str, context: dict[str, Any]) -> tuple[str, str]:
    variants = TEMPLATES.get(category) or [{"title": "Fuel Good", "body": "Open the app for your next meal."}]
    variant = variants[hash(f"{user_id}:{category}:{datetime.utcnow().date().isoformat()}") % len(variants)]
    return variant["title"].format(**context), variant["body"].format(**context)


def _send_expo_push(db: Session, token: UserPushToken, delivery: NotificationDelivery) -> None:
    headers = {"Content-Type": "application/json"}
    expo_access_token = getattr(settings, "expo_push_access_token", "")
    if expo_access_token:
        headers["Authorization"] = f"Bearer {expo_access_token}"

    payload = {
        "to": token.expo_push_token,
        "title": delivery.title,
        "body": delivery.body,
        "sound": "default",
        "data": {
            "route": delivery.route,
            "category": delivery.category,
            "delivery_id": str(delivery.id),
            **(delivery.metadata_json or {}),
        },
    }
    try:
        response = httpx.post(EXPO_PUSH_URL, json=payload, headers=headers, timeout=10.0)
        data = response.json()
        details = (data.get("data") or {})
        if response.status_code >= 400 or details.get("status") == "error":
            detail = details.get("details") or {}
            error_code = detail.get("error")
            delivery.status = "failed"
            delivery.failure_reason = error_code or details.get("message") or f"HTTP {response.status_code}"
            if error_code == "DeviceNotRegistered":
                token.enabled = False
                token.invalidated_at = datetime.utcnow()
            logger.warning(
                "expo_push.failed delivery_id=%s token_id=%s status_code=%s error=%s",
                delivery.id,
                token.id,
                response.status_code,
                delivery.failure_reason,
            )
        else:
            delivery.status = "sent"
            delivery.sent_at = datetime.utcnow()
            logger.info(
                "expo_push.sent delivery_id=%s token_id=%s status_code=%s",
                delivery.id,
                token.id,
                response.status_code,
            )
    except Exception as exc:
        delivery.status = "failed"
        delivery.failure_reason = str(exc)
        logger.exception(
            "expo_push.exception delivery_id=%s token_id=%s",
            delivery.id,
            token.id,
        )

    db.flush()


def _apply_conversions_for_event(db: Session, user_id: str, event: NotificationEvent) -> None:
    deliveries = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user_id,
            NotificationDelivery.status == "sent",
            NotificationDelivery.conversion_at.is_(None),
            NotificationDelivery.sent_at >= event.occurred_at - timedelta(hours=24),
        )
        .all()
    )
    for delivery in deliveries:
        allowed = CONVERSION_EVENT_TYPES.get(delivery.category, set())
        if event.event_type in allowed:
            delivery.conversion_at = event.occurred_at
        if event.event_type == "notification_opened":
            delivery.opened_at = event.occurred_at
    db.flush()
