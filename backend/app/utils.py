"""Shared utility functions used across the application."""


def normalize_email(value: str | None) -> str:
    """Normalize an email address by stripping whitespace and lowercasing."""
    return (value or "").strip().lower()
