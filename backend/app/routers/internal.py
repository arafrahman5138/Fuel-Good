import hmac

from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings
from app.schemas.notification import NotificationRunResponse
from app.services.notifications import run_notification_cycle

router = APIRouter()
settings = get_settings()


@router.post("/notifications/run", response_model=NotificationRunResponse)
async def run_notifications(
    x_notification_runner_secret: str | None = Header(default=None),
):
    configured_secret = (settings.notification_runner_secret or "").strip()
    if not configured_secret:
        raise HTTPException(status_code=503, detail="Notification runner is not configured.")
    if not x_notification_runner_secret or not hmac.compare_digest(x_notification_runner_secret, configured_secret):
        raise HTTPException(status_code=403, detail="Invalid notification runner secret.")

    result = run_notification_cycle()
    return NotificationRunResponse(**result.to_dict())
