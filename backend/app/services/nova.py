"""NOVA ingredient dictionary.

Ships a JSON file at ``backend/app/data/nova_dict.json`` as the
authoritative default. At runtime, optionally overlays entries from a
Supabase ``nova_ingredients`` table so the prod dictionary can be tuned
without a redeploy. Exposes ``resolve_nova`` for per-component lookup
with a fuzzy-match fallback for OCR-garbled or loosely-named inputs.
"""
from __future__ import annotations

import asyncio
import difflib
import json
import logging
import re
import threading
from pathlib import Path
from typing import Any, Iterable

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "nova_dict.json"
_DEFAULT_NOVA_BY_ROLE = {
    "protein": 1,
    "veg": 1,
    "fruit": 1,
    "whole_carb": 1,
    "carb": 2,
    "fat": 2,
    "sauce": 2,
    "dessert": 4,
    "other": 2,
}

# NOVA level penalties applied to mass_fraction-weighted components.
# Calibrated against the 18 audit fixtures: NOVA 3 and 4 components dominate
# the score when they dominate the plate, matching the Fuel Good philosophy
# that processed food is not whole food.
NOVA_PENALTY: dict[int, float] = {1: 0.0, 2: 5.0, 3: 28.0, 4: 48.0}


class NovaEntry:
    __slots__ = ("name", "nova", "role", "tags")

    def __init__(self, name: str, nova: int, role: str | None, tags: list[str]):
        self.name = name
        self.nova = nova
        self.role = role
        self.tags = tags

    def as_dict(self) -> dict[str, Any]:
        return {"name": self.name, "nova": self.nova, "role": self.role, "tags": list(self.tags)}


_STATE_LOCK = threading.Lock()
_STATE: dict[str, NovaEntry] = {}
_NAME_INDEX: list[str] = []  # kept in insertion order for fuzzy search


def _normalize(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _load_shipped_dict() -> list[NovaEntry]:
    try:
        data = json.loads(_DATA_PATH.read_text())
    except FileNotFoundError:
        logger.warning("nova_dict.json missing at %s — running with empty dict", _DATA_PATH)
        return []
    entries = []
    for row in data.get("ingredients") or []:
        name = _normalize(row.get("name"))
        nova = int(row.get("nova") or 2)
        if not name or nova not in NOVA_PENALTY:
            continue
        entries.append(NovaEntry(
            name=name,
            nova=nova,
            role=(row.get("role") or None),
            tags=list(row.get("tags") or []),
        ))
    return entries


def _replace_state(entries: Iterable[NovaEntry]) -> None:
    new_state: dict[str, NovaEntry] = {}
    for entry in entries:
        new_state[entry.name] = entry
    with _STATE_LOCK:
        _STATE.clear()
        _STATE.update(new_state)
        _NAME_INDEX.clear()
        _NAME_INDEX.extend(new_state.keys())


def _load_from_supabase_sync() -> list[NovaEntry] | None:
    settings = get_settings()
    url = (settings.supabase_url or "").strip()
    key = (settings.supabase_service_role_key or "").strip()
    if not url or not key:
        return None
    rest = f"{url.rstrip('/')}/rest/v1/nova_ingredients?select=name,nova,role,tags"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(rest, headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            })
            resp.raise_for_status()
            rows = resp.json()
    except Exception as exc:
        logger.info("NOVA Supabase overlay skipped (%s)", type(exc).__name__)
        return None
    entries = []
    for row in rows:
        name = _normalize(row.get("name"))
        try:
            nova = int(row.get("nova") or 2)
        except (TypeError, ValueError):
            continue
        if not name or nova not in NOVA_PENALTY:
            continue
        tags_raw = row.get("tags") or []
        if isinstance(tags_raw, str):
            try:
                tags_raw = json.loads(tags_raw)
            except ValueError:
                tags_raw = []
        entries.append(NovaEntry(
            name=name,
            nova=nova,
            role=(row.get("role") or None),
            tags=list(tags_raw),
        ))
    return entries


def reload_dict() -> int:
    """Rebuild the in-memory dict from shipped JSON + Supabase overlay.

    Returns the total entry count after reload. Safe to call repeatedly.
    """
    base = _load_shipped_dict()
    merged: dict[str, NovaEntry] = {entry.name: entry for entry in base}

    supabase_entries = _load_from_supabase_sync()
    if supabase_entries:
        for entry in supabase_entries:
            merged[entry.name] = entry  # Supabase wins on name conflicts

    _replace_state(merged.values())
    return len(merged)


async def reload_dict_async() -> int:
    """Async wrapper — runs the blocking reload on a thread."""
    return await asyncio.to_thread(reload_dict)


def _fuzzy_lookup(name: str) -> NovaEntry | None:
    """Find the closest entry by edit distance. Bounded to avoid false hits on short tokens."""
    if not _NAME_INDEX:
        return None
    matches = difflib.get_close_matches(name, _NAME_INDEX, n=1, cutoff=0.82)
    if not matches:
        return None
    with _STATE_LOCK:
        return _STATE.get(matches[0])


def resolve_nova(
    component: dict[str, Any] | str,
    *,
    fuzzy: bool = True,
) -> dict[str, Any]:
    """Resolve NOVA metadata for a component name.

    Returns a dict with ``nova``, ``role``, ``tags``, ``matched``. ``matched``
    is the dictionary key we hit (or ``None`` if we fell through to a role
    default). The role hint is used when the name isn't in the dict — a
    component labeled "protein" but with an unknown name still scores as
    NOVA 1 rather than the generic NOVA 2 default.
    """
    if isinstance(component, str):
        raw_name = component
        role_hint = None
    else:
        raw_name = component.get("name") or ""
        role_hint = (component.get("role") or "").lower() or None

    name = _normalize(raw_name)
    if not name:
        return {
            "nova": _DEFAULT_NOVA_BY_ROLE.get(role_hint or "", 2),
            "role": role_hint,
            "tags": [],
            "matched": None,
        }

    # 1. Exact match
    with _STATE_LOCK:
        entry = _STATE.get(name)
    if entry is not None:
        return {
            "nova": entry.nova,
            "role": entry.role or role_hint,
            "tags": list(entry.tags),
            "matched": entry.name,
        }

    # 2. Containment match — longest-first so "grilled chicken breast" finds
    #    "chicken breast" before "chicken"
    with _STATE_LOCK:
        candidates = sorted(
            (k for k in _STATE if k in name),
            key=len,
            reverse=True,
        )
    if candidates:
        entry = _STATE.get(candidates[0])
        if entry is not None:
            return {
                "nova": entry.nova,
                "role": entry.role or role_hint,
                "tags": list(entry.tags),
                "matched": entry.name,
            }

    # 3. Fuzzy match (handles OCR garble like "chickn brest")
    if fuzzy:
        fuzzy_hit = _fuzzy_lookup(name)
        if fuzzy_hit is not None:
            return {
                "nova": fuzzy_hit.nova,
                "role": fuzzy_hit.role or role_hint,
                "tags": list(fuzzy_hit.tags),
                "matched": fuzzy_hit.name,
            }

    # 4. Role fallback — unknown name, trust the role if we have one.
    return {
        "nova": _DEFAULT_NOVA_BY_ROLE.get(role_hint or "", 2),
        "role": role_hint,
        "tags": [],
        "matched": None,
    }


def entry_count() -> int:
    with _STATE_LOCK:
        return len(_STATE)


# Load on import. A background task in main.py can also call reload_dict_async()
# at startup to pull the latest Supabase overlay once the event loop is running.
try:
    reload_dict()
except Exception:
    logger.exception("NOVA dictionary failed initial load")
