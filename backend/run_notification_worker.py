import asyncio
import json
import logging

from app.config import get_settings
from app.main import _configure_logging, _validate_security_settings
from app.services.notifications import notification_scheduler_loop


logger = logging.getLogger("wholefoodlabs.notifications.worker")


async def main() -> None:
    settings = get_settings()
    _configure_logging()
    _validate_security_settings()
    if not settings.run_notification_scheduler:
        logger.error(json.dumps({"event": "scheduler.disabled"}))
        raise SystemExit("RUN_NOTIFICATION_SCHEDULER must be true for the notification worker.")
    logger.info(json.dumps({"event": "scheduler.worker_started"}))
    await notification_scheduler_loop()


if __name__ == "__main__":
    asyncio.run(main())
