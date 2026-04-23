"""Content-hash LRU cache for scan results.

Phase 3 fix: same photo or same UPC scanned twice should return in ~50ms
instead of paying another ~2.5s Gemini round-trip. Matches the pattern
already used by the in-memory rate-limiter (see ``main.py``) — no new
infra required. Redis can replace this later for horizontal scaling.

Keys are versioned by prompt so that shipping a prompt upgrade
invalidates the cache automatically.
"""
from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict
from typing import Any, Optional

# 7-day TTL for meal/label scans. Re-scans of the same item within a week
# should reuse the earlier analysis — it's the same picture of the same
# food. User-initiated corrections purge the entry immediately.
DEFAULT_TTL_S = 7 * 24 * 3600
DEFAULT_CAPACITY = 512


class _LRU:
    def __init__(self, capacity: int, ttl_s: float) -> None:
        self._capacity = capacity
        self._ttl_s = ttl_s
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at < now:
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            return value

    def set(self, key: str, value: Any, ttl_s: Optional[float] = None) -> None:
        expires_at = time.monotonic() + (ttl_s if ttl_s is not None else self._ttl_s)
        with self._lock:
            self._store[key] = (expires_at, value)
            self._store.move_to_end(key)
            while len(self._store) > self._capacity:
                self._store.popitem(last=False)

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)


_meal_cache = _LRU(DEFAULT_CAPACITY, DEFAULT_TTL_S)
_label_cache = _LRU(DEFAULT_CAPACITY, DEFAULT_TTL_S)


def _hash_image(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def meal_cache_key(image_bytes: bytes, prompt_version: str) -> str:
    return f"meal:{prompt_version}:{_hash_image(image_bytes)}"


def label_cache_key(image_bytes: bytes, prompt_version: str) -> str:
    return f"label:{prompt_version}:{_hash_image(image_bytes)}"


def get_meal_scan(image_bytes: bytes, prompt_version: str) -> Optional[dict[str, Any]]:
    return _meal_cache.get(meal_cache_key(image_bytes, prompt_version))


def set_meal_scan(image_bytes: bytes, prompt_version: str, value: dict[str, Any]) -> None:
    _meal_cache.set(meal_cache_key(image_bytes, prompt_version), value)


def get_label_scan(image_bytes: bytes, prompt_version: str) -> Optional[dict[str, Any]]:
    return _label_cache.get(label_cache_key(image_bytes, prompt_version))


def set_label_scan(image_bytes: bytes, prompt_version: str, value: dict[str, Any]) -> None:
    _label_cache.set(label_cache_key(image_bytes, prompt_version), value)


def invalidate_meal_scan(image_bytes: bytes, prompt_version: str) -> None:
    _meal_cache.invalidate(meal_cache_key(image_bytes, prompt_version))


def clear_all() -> None:
    """Test helper."""
    _meal_cache.clear()
    _label_cache.clear()
