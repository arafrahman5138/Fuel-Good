import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base, GUID


class UserPushToken(Base):
    __tablename__ = "user_push_tokens"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    expo_push_token = Column(String, nullable=False, unique=True, index=True)
    device_id = Column(String, nullable=True, index=True)
    platform = Column(String, default="unknown")
    app_version = Column(String, default="")
    enabled = Column(Boolean, default=True)
    invalidated_at = Column(DateTime, nullable=True)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="push_tokens")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    push_enabled = Column(Boolean, default=True)
    timezone = Column(String, default="UTC")
    quiet_hours_start = Column(String, default="21:30")
    quiet_hours_end = Column(String, default="08:00")
    preferred_meal_window_start = Column(String, default="17:00")
    preferred_meal_window_end = Column(String, default="19:30")
    max_notifications_per_day = Column(Integer, default=1)
    max_notifications_per_week = Column(Integer, default=3)
    categories = Column(
        JSON,
        default=lambda: {
            "plan": True,
            "cook": True,
            "grocery": True,
            "streak": True,
            "quest": True,
            "reactivation": True,
            "healthify": True,
            "promotional": False,
        },
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    source = Column(String, default="system")
    properties = Column(JSON, default=dict)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, index=True)
    push_token_id = Column(GUID, ForeignKey("user_push_tokens.id"), nullable=True, index=True)
    category = Column(String, nullable=False, index=True)
    status = Column(String, default="pending", index=True)
    title = Column(String, default="")
    body = Column(String, default="")
    route = Column(String, default="")
    metadata_json = Column(JSON, default=dict)
    triggered_by_event = Column(String, nullable=True)
    eligibility_score = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    conversion_at = Column(DateTime, nullable=True)
    failure_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    push_token = relationship("UserPushToken")
