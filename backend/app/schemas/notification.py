from typing import Any, Optional

from pydantic import BaseModel, Field


class PushTokenRegisterRequest(BaseModel):
    expo_push_token: str
    device_id: Optional[str] = None
    platform: str = "unknown"
    app_version: str = ""
    timezone: Optional[str] = None


class NotificationPreferenceResponse(BaseModel):
    push_enabled: bool
    timezone: str
    quiet_hours_start: str
    quiet_hours_end: str
    preferred_meal_window_start: str
    preferred_meal_window_end: str
    max_notifications_per_day: int
    max_notifications_per_week: int
    categories: dict[str, bool]


class NotificationPreferenceUpdate(BaseModel):
    push_enabled: Optional[bool] = None
    timezone: Optional[str] = None
    quiet_hours_start: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    quiet_hours_end: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    preferred_meal_window_start: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    preferred_meal_window_end: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    max_notifications_per_day: Optional[int] = Field(default=None, ge=0, le=5)
    max_notifications_per_week: Optional[int] = Field(default=None, ge=0, le=14)
    categories: Optional[dict[str, bool]] = None


class NotificationTestRequest(BaseModel):
    category: str = "plan_kickoff"
    title: Optional[str] = None
    body: Optional[str] = None
    route: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class NotificationEventIngestRequest(BaseModel):
    event_type: str
    source: str = "client"
    properties: dict[str, Any] = Field(default_factory=dict)
