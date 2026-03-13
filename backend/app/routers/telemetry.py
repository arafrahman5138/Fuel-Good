import json
import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger("wholefoodlabs.telemetry")


class ClientErrorReport(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    source: str = Field(min_length=1, max_length=32)
    is_fatal: bool | None = False
    stack: str | None = Field(default=None, max_length=12000)
    context: dict | None = None
    app_env: str | None = Field(default=None, max_length=32)
    app_version: str | None = Field(default=None, max_length=64)
    release_channel: str | None = Field(default=None, max_length=64)
    occurred_at: str | None = Field(default=None, max_length=64)


@router.post("/client-error")
async def report_client_error(body: ClientErrorReport, request: Request):
    logger.error(
        json.dumps(
            {
                "event": "client_error",
                "request_id": getattr(request.state, "request_id", None),
                "client_ip": request.client.host if request.client else "unknown",
                **body.model_dump(),
            }
        )
    )
    return {"ok": True}
