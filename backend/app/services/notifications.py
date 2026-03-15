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
    "grocery_follow_through": 4,
    "streak_protection": 3,
    "plan_kickoff": 2,
    "healthify_callback": 1,
    "quest_progress": 0,
    "reactivation_3d": -1,
    "reactivation_7d": -1,
    "reactivation_14d": -1,
}
CATEGORY_COOLDOWNS = {
    "plan_kickoff": timedelta(days=7),
    "cook_tonight": timedelta(days=3),
    "grocery_follow_through": timedelta(days=14),
    "streak_protection": timedelta(days=3),
    "quest_progress": timedelta(days=7),
    "healthify_callback": timedelta(days=3),
    "reactivation_3d": timedelta(days=30),
    "reactivation_7d": timedelta(days=30),
    "reactivation_14d": timedelta(days=30),
}
TEMPLATES: dict[str, list[dict[str, str]]] = {
    "plan_kickoff": [
        {"title": "Plan your week", "body": "Set up this week before food decisions pile up."},
        {"title": "Make this week easier", "body": "Your next meals will feel simpler if you plan them now."},
        {"title": "Give this week a head start", "body": "Open your planner and lock in a few easy wins."},
        {"title": "Use your week well", "body": "Start with your meal plan before the week gets noisy."},
        {"title": "Own this week’s meals", "body": "Your plan works best when it’s ready before hunger hits."},
    ],
    "cook_tonight": [
        {"title": "Tonight's dinner is ready", "body": "Start {recipe_title} and make dinner easier on yourself."},
        {"title": "You already picked dinner", "body": "Open {recipe_title} and skip the what-should-I-make loop."},
        {"title": "Tonight is handled", "body": "Your dinner plan is set. Start with {recipe_title}."},
        {"title": "One less decision tonight", "body": "Cook {recipe_title} and keep the evening simple."},
        {"title": "Your dinner plan is waiting", "body": "Jump into {recipe_title} while tonight still feels easy."},
        {"title": "Stay in your meal rhythm", "body": "Tonight’s dinner is already picked: {recipe_title}."},
    ],
    "grocery_follow_through": [
        {"title": "Your plan is ready", "body": "Your plan is useful once it becomes a list."},
        {"title": "Finish the setup", "body": "Turn your meal plan into a grocery list before the week speeds up."},
        {"title": "Make the plan real", "body": "Your grocery list is the next step that makes this week easier."},
        {"title": "Keep your plan moving", "body": "Open your plan and build the shopping list now."},
        {"title": "Give your plan teeth", "body": "One grocery list now saves a lot of food decisions later."},
        {"title": "Don’t leave your plan half-done", "body": "Your next useful step is turning it into a list."},
    ],
    "streak_protection": [
        {"title": "Keep today intact", "body": "You can still keep your streak with one quick action."},
        {"title": "You’re still in it", "body": "Log one meal or open your plan and protect today’s progress."},
        {"title": "Don’t let today slip", "body": "One useful action now keeps your streak alive."},
        {"title": "Protect the rhythm", "body": "You’re one small step from keeping your streak intact."},
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
        {"title": "Pick up where you left off", "body": "Want to finish the whole-food version of {dish_name}?"},
        {"title": "That recipe is still open", "body": "Jump back into Healthify and finish {dish_name}."},
        {"title": "Keep that idea moving", "body": "Your whole-food take on {dish_name} is waiting for the next step."},
        {"title": "Finish what you started", "body": "Open Healthify and keep going on {dish_name}."},
        {"title": "Your last Healthify idea is ready", "body": "Pick up {dish_name} where you left it."},
        {"title": "One more step on that dish", "body": "Come back to {dish_name} and turn it into something usable."},
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


def _default_meal_window() -> tuple[str, str]:
    return "17:00", "19:30"


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
        if (pref.max_notifications_per_week or 0) > 3:
            pref.max_notifications_per_week = 3
        if not pref.preferred_meal_window_start or not pref.preferred_meal_window_end:
            pref.preferred_meal_window_start, pref.preferred_meal_window_end = _default_meal_window()
        return pref

    user = db.query(User).filter(User.id == user_id).first()
    timezone = "UTC"
    if user and getattr(user.last_active_date, "tzinfo", None) is not None:
        timezone = "UTC"

    meal_window_start, meal_window_end = _default_meal_window()
    pref = NotificationPreference(
        user_id=user_id,
        timezone=timezone,
        categories=default_categories(),
        max_notifications_per_week=3,
        preferred_meal_window_start=meal_window_start,
        preferred_meal_window_end=meal_window_end,
    )
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
    _apply_preference_inference(db, user_id, event)
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


def _apply_preference_inference(db: Session, user_id: str, event: NotificationEvent) -> None:
    pref = get_or_create_preferences(db, user_id)
    timezone = (event.properties or {}).get("timezone")
    if isinstance(timezone, str) and timezone.strip():
        pref.timezone = timezone.strip()

    if pref.preferred_meal_window_start != "17:00" or pref.preferred_meal_window_end != "19:30":
        db.flush()
        return

    candidate_events = {"meal_plan_viewed", "meal_plan_item_viewed", "cook_started", "cook_completed", "food_logged_today"}
    if event.event_type not in candidate_events:
        db.flush()
        return

    rows = (
        db.query(NotificationEvent)
        .filter(
            NotificationEvent.user_id == user_id,
            NotificationEvent.event_type.in_(tuple(candidate_events)),
        )
        .order_by(NotificationEvent.occurred_at.desc())
        .limit(6)
        .all()
    )
    if len(rows) < 3:
        db.flush()
        return

    local_hours: list[int] = []
    for row in rows:
        props = row.properties or {}
        hour = props.get("local_hour")
        try:
            if hour is not None:
                local_hours.append(int(hour))
        except (TypeError, ValueError):
            continue
    if len(local_hours) < 3:
        db.flush()
        return

    avg_hour = round(sum(local_hours) / len(local_hours))
    start_hour = max(16, avg_hour - 1)
    end_hour = min(21, avg_hour + 1)
    pref.preferred_meal_window_start = f"{start_hour:02d}:00"
    pref.preferred_meal_window_end = f"{end_hour:02d}:30"
    db.flush()


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

    weekly_cap = min(pref.max_notifications_per_week or 3, 3)
    if not user.last_active_date or (now_utc.date() - user.last_active_date.date()).days >= 7:
        weekly_cap = min(weekly_cap, 2)
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

    if not category.startswith("reactivation"):
        ignored_pushes = (
            db.query(NotificationDelivery)
            .filter(
                NotificationDelivery.user_id == user.id,
                NotificationDelivery.status == "sent",
                NotificationDelivery.opened_at.is_(None),
                NotificationDelivery.conversion_at.is_(None),
            )
            .count()
        )
        if ignored_pushes >= 3:
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

    return [c for c in candidates if not _already_sent_recently(db, user.id, c.category, now_utc, c.metadata)]


def _already_sent_recently(db: Session, user_id: str, category: str, now_utc: datetime, metadata: Optional[dict[str, Any]] = None) -> bool:
    if category == "grocery_follow_through" and metadata and metadata.get("meal_plan_id"):
        deliveries = db.query(NotificationDelivery).filter(
            NotificationDelivery.user_id == user_id,
            NotificationDelivery.category == category,
            NotificationDelivery.status == "sent",
        ).all()
        return any((d.metadata_json or {}).get("meal_plan_id") == metadata.get("meal_plan_id") for d in deliveries)

    lookback = now_utc - CATEGORY_COOLDOWNS.get(category, timedelta(days=2))
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
    if not ((local_now.weekday() == 6 and local_now.hour >= 17) or (local_now.weekday() == 0 and 7 <= local_now.hour <= 11)):
        return None

    latest_plan = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == user.id)
        .order_by(MealPlan.created_at.desc())
        .first()
    )
    this_week_start = local_now.date() - timedelta(days=local_now.date().weekday())
    if latest_plan and latest_plan.week_start >= this_week_start:
        return None

    plan_viewed = _last_event_time(db, user.id, "meal_plan_viewed")
    if plan_viewed and plan_viewed.date() >= this_week_start:
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
    engagement_state = _engagement_state(db, user, local_now.replace(tzinfo=None))
    behavior_match = 4 if engagement_state in {"planner", "tracker"} else 3
    return CandidateNotification(
        category="cook_tonight",
        route=route,
        metadata={"recipe_id": dinner_item.recipe_id, "recipe_title": recipe_title},
        triggered_by_event="schedule",
        score=_score_candidate("cook_tonight", recency_fit=3, behavior_match=behavior_match, goal_relevance=4),
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
    week_ago = local_now - timedelta(days=7)
    already_nudged = (
        db.query(NotificationDelivery)
        .filter(
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.category == "quest_progress",
            NotificationDelivery.status == "sent",
            NotificationDelivery.sent_at >= week_ago,
        )
        .count()
    )
    if already_nudged:
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

    subsequent_events = [
        _last_event_time(db, user.id, "recipe_saved"),
        _last_event_time(db, user.id, "meal_plan_created"),
        _last_event_time(db, user.id, "cook_started"),
        _last_event_time(db, user.id, "cook_completed"),
    ]
    if any(event_time and event_time >= session.updated_at for event_time in subsequent_events):
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
    route = _reactivation_route(db, user)
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


def _engagement_state(db: Session, user: User, now_local: datetime) -> str:
    if not user.last_active_date:
        return "new"
    inactive_days = (now_local.date() - user.last_active_date.date()).days
    if inactive_days >= 7:
        return "cooling_off"
    recent_plan = _last_event_time(db, user.id, "meal_plan_created") or _last_event_time(db, user.id, "meal_plan_viewed")
    recent_food_log = _last_event_time(db, user.id, "food_logged_today")
    recent_saved = _last_event_time(db, user.id, "saved_recipes_viewed") or _last_event_time(db, user.id, "recipe_saved")
    if recent_food_log and (not recent_plan or recent_food_log >= recent_plan):
        return "tracker"
    if recent_plan:
        return "planner"
    if recent_saved:
        return "exploring"
    return "new"


def _reactivation_route(db: Session, user: User) -> str:
    last_events: list[tuple[str, Optional[datetime]]] = [
        ("/(tabs)/meals?tab=plan", max(filter(None, [_last_event_time(db, user.id, "meal_plan_viewed"), _last_event_time(db, user.id, "meal_plan_created")]), default=None)),
        ("/saved", max(filter(None, [_last_event_time(db, user.id, "saved_recipes_viewed"), _last_event_time(db, user.id, "recipe_saved"), _last_event_time(db, user.id, "recipe_browsed")]), default=None)),
        ("/(tabs)/chat", max(filter(None, [_last_event_time(db, user.id, "healthify_started"), _last_event_time(db, user.id, "healthify_suggestion_tapped")]), default=None)),
    ]
    valid = [(route, ts) for route, ts in last_events if ts is not None]
    if not valid:
        return "/(tabs)/meals?tab=plan"
    return sorted(valid, key=lambda item: item[1], reverse=True)[0][0]


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
    delivery_id = (event.properties or {}).get("delivery_id")
    if event.event_type in {"notification_opened", "notification_deep_linked"} and delivery_id:
        delivery = (
            db.query(NotificationDelivery)
            .filter(
                NotificationDelivery.user_id == user_id,
                NotificationDelivery.id == str(delivery_id),
                NotificationDelivery.status == "sent",
            )
            .first()
        )
        if delivery:
            if event.event_type == "notification_opened":
                delivery.opened_at = event.occurred_at
            db.flush()
        return

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
