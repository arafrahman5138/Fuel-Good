from __future__ import annotations

import html
import logging
from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("fuelgood.email")

RESEND_API_BASE = "https://api.resend.com"


def is_transactional_email_configured() -> bool:
    return bool(settings.resend_api_key.strip() and settings.email_from.strip())


def _plain_text_from_html(value: str) -> str:
    return (
        value.replace("<br />", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n")
        .replace("</p>", "\n\n")
        .replace("<p>", "")
        .replace("</strong>", "")
        .replace("<strong>", "")
    )


async def send_transactional_email(
    *,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    reply_to: str | None = None,
    tags: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    if not is_transactional_email_configured():
        raise RuntimeError("Transactional email is not configured.")

    payload: dict[str, Any] = {
        "from": settings.email_from,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": text_body or _plain_text_from_html(html_body),
    }
    final_reply_to = (reply_to or settings.email_reply_to or "").strip()
    if final_reply_to:
        payload["reply_to"] = final_reply_to
    if tags:
        payload["tags"] = tags

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{RESEND_API_BASE}/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        return response.json()


def _email_shell(*, eyebrow: str, headline: str, body_html: str, footer: str | None = None) -> str:
    safe_eyebrow = html.escape(eyebrow)
    safe_headline = html.escape(headline)
    footer_html = f"<p style='color:#64748B;font-size:13px;margin-top:24px'>{html.escape(footer)}</p>" if footer else ""
    return f"""
    <div style="background:#F8FAFC;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:32px;border:1px solid #E2E8F0">
        <p style="margin:0 0 8px;color:#16A34A;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">{safe_eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15">{safe_headline}</h1>
        <div style="font-size:15px;line-height:1.65;color:#334155">
          {body_html}
        </div>
        {footer_html}
      </div>
    </div>
    """.strip()


async def send_welcome_email(*, to_email: str, name: str | None = None) -> dict[str, Any]:
    first_name = (name or "").strip() or "there"
    body = f"""
    <p>Hi {html.escape(first_name)},</p>
    <p>Welcome to Fuel Good. Your account is ready, and you can start exploring scans, chat, meal plans, and tracking right away.</p>
    <p>If you need anything, just reply to this email and we'll help.</p>
    """
    return await send_transactional_email(
        to_email=to_email,
        subject="Welcome to Fuel Good",
        html_body=_email_shell(
            eyebrow="Welcome",
            headline="Your Fuel Good account is ready",
            body_html=body,
            footer="You’re receiving this because you created a Fuel Good account.",
        ),
        tags=[{"name": "type", "value": "welcome"}],
    )


async def send_password_reset_email(
    *,
    to_email: str,
    reset_code: str,
    expires_in_minutes: int,
    name: str | None = None,
) -> dict[str, Any]:
    first_name = (name or "").strip() or "there"
    body = f"""
    <p>Hi {html.escape(first_name)},</p>
    <p>We received a request to reset your Fuel Good password.</p>
    <p><strong>Your 6-digit reset code:</strong></p>
    <p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;letter-spacing:0.16em;font-weight:700;background:#F8FAFC;padding:14px 18px;border-radius:10px;border:1px solid #E2E8F0;text-align:center">{html.escape(reset_code)}</p>
    <p>This code expires in {expires_in_minutes} minutes.</p>
    <p>If you didn’t request this, you can safely ignore this email.</p>
    """
    return await send_transactional_email(
        to_email=to_email,
        subject="Reset your Fuel Good password",
        html_body=_email_shell(
            eyebrow="Security",
            headline="Password reset instructions",
            body_html=body,
            footer="For security, this reset code can only be used for a short time.",
        ),
        tags=[{"name": "type", "value": "password_reset"}],
    )


async def send_billing_notice_email(
    *,
    to_email: str,
    subject: str,
    headline: str,
    message: str,
    name: str | None = None,
) -> dict[str, Any]:
    first_name = (name or "").strip() or "there"
    body = f"""
    <p>Hi {html.escape(first_name)},</p>
    <p>{html.escape(message)}</p>
    <p>If you have questions, reply to this email and we’ll help.</p>
    """
    return await send_transactional_email(
        to_email=to_email,
        subject=subject,
        html_body=_email_shell(
            eyebrow="Billing",
            headline=headline,
            body_html=body,
            footer="This email is about your Fuel Good subscription or account.",
        ),
        tags=[{"name": "type", "value": "billing_notice"}],
    )


async def send_transactional_email_safe(**kwargs: Any) -> None:
    try:
        await send_transactional_email(**kwargs)
    except Exception:
        logger.exception("Transactional email send failed")
