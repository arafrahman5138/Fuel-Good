from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.notification import NotificationDelivery
from app.models.user import User
from app.schemas.notification import (
    NotificationEventIngestRequest,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationTestRequest,
    PushTokenRegisterRequest,
)
from app.services.notifications import (
    deactivate_push_token,
    get_or_create_preferences,
    record_notification_event,
    register_push_token,
    send_test_notification_to_user,
)

router = APIRouter()


@router.post("/push-token")
async def register_notification_push_token(
    body: PushTokenRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.expo_push_token.startswith("ExponentPushToken[") and not body.expo_push_token.startswith("ExpoPushToken["):
        raise HTTPException(status_code=400, detail="Invalid Expo push token.")

    token = register_push_token(
        db=db,
        user_id=current_user.id,
        expo_push_token=body.expo_push_token,
        device_id=body.device_id,
        platform=body.platform,
        app_version=body.app_version,
    )
    pref = get_or_create_preferences(db, current_user.id)
    pref.push_enabled = True
    if body.timezone:
        pref.timezone = body.timezone
    record_notification_event(
        db,
        current_user.id,
        "push_token_registered",
        source="client",
        properties={"timezone": body.timezone} if body.timezone else None,
    )
    db.commit()
    return {"id": str(token.id), "status": "registered", "push_enabled": pref.push_enabled}


@router.delete("/push-token/{token_id}")
async def remove_notification_push_token(
    token_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    removed = deactivate_push_token(db, current_user.id, token_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Push token not found.")
    record_notification_event(db, current_user.id, "push_token_removed", source="client")
    db.commit()
    return {"status": "removed"}


@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_preferences(db, current_user.id)
    db.commit()
    return NotificationPreferenceResponse(
        push_enabled=pref.push_enabled,
        timezone=pref.timezone,
        quiet_hours_start=pref.quiet_hours_start,
        quiet_hours_end=pref.quiet_hours_end,
        preferred_meal_window_start=pref.preferred_meal_window_start,
        preferred_meal_window_end=pref.preferred_meal_window_end,
        max_notifications_per_day=pref.max_notifications_per_day,
        max_notifications_per_week=pref.max_notifications_per_week,
        categories=pref.categories or {},
    )


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
async def update_notification_preferences(
    body: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_preferences(db, current_user.id)
    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        if key == "categories" and value is not None:
            pref.categories = {**(pref.categories or {}), **value}
        else:
            setattr(pref, key, value)

    record_notification_event(db, current_user.id, "notification_preferences_updated", source="client", properties=payload)
    db.commit()
    return NotificationPreferenceResponse(
        push_enabled=pref.push_enabled,
        timezone=pref.timezone,
        quiet_hours_start=pref.quiet_hours_start,
        quiet_hours_end=pref.quiet_hours_end,
        preferred_meal_window_start=pref.preferred_meal_window_start,
        preferred_meal_window_end=pref.preferred_meal_window_end,
        max_notifications_per_day=pref.max_notifications_per_day,
        max_notifications_per_week=pref.max_notifications_per_week,
        categories=pref.categories or {},
    )


@router.post("/test")
async def send_test_notification(
    body: NotificationTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = get_or_create_preferences(db, current_user.id)
    if not pref.push_enabled:
        raise HTTPException(status_code=400, detail="Push notifications are disabled.")

    record_notification_event(db, current_user.id, "notification_test_requested", properties={"category": body.category}, source="client")
    deliveries = send_test_notification_to_user(
        db,
        current_user.id,
        body.category,
        body.title or "Fuel Good",
        body.body or "Push is configured and ready to send.",
        body.route or "/(tabs)/index",
        body.metadata,
    )
    if deliveries:
        db.commit()
        return {"status": "sent", "deliveries": [str(d.id) for d in deliveries]}

    delivery = NotificationDelivery(
        user_id=current_user.id,
        category=body.category,
        status="skipped",
        title=body.title or "Fuel Good",
        body=body.body or "Push is configured, but no active device token is available.",
        route=body.route or "/(tabs)/index",
        metadata_json=body.metadata,
        triggered_by_event="manual_test",
        failure_reason="no_candidate_or_token",
        created_at=datetime.now(UTC),
    )
    db.add(delivery)
    db.commit()
    return {"status": "skipped", "reason": "No eligible notification candidate or token."}


@router.post("/events")
async def ingest_notification_event(
    body: NotificationEventIngestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = record_notification_event(
        db,
        current_user.id,
        body.event_type,
        properties=body.properties,
        source=body.source,
    )
    db.commit()
    return {"status": "ok", "event_id": str(event.id), "queued": True, "notifications_sent": 0}
