"""Upsert the shipped NOVA ingredient dictionary into Supabase.

Intended for deploy pipelines and one-off refreshes. Reads
``backend/app/data/nova_dict.json`` and upserts each row into the
``nova_ingredients`` table via the Supabase REST API (PostgREST). The
table schema is defined in ``backend/db/supabase/nova_ingredients.sql``.

Env vars required:
  SUPABASE_URL                supabase project URL
  SUPABASE_SERVICE_ROLE_KEY   service-role key (write access)

Usage:
  python backend/scripts/seed_nova_dict.py
  python backend/scripts/seed_nova_dict.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

BATCH_SIZE = 200
TIMEOUT = 30.0

DATA_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "nova_dict.json"


def load_entries() -> list[dict]:
    data = json.loads(DATA_PATH.read_text())
    entries = []
    for row in data.get("ingredients") or []:
        name = (row.get("name") or "").strip().lower()
        if not name:
            continue
        entries.append({
            "name": name,
            "nova": int(row.get("nova") or 2),
            "role": row.get("role"),
            "tags": row.get("tags") or [],
        })
    return entries


def upsert_batch(client: httpx.Client, url: str, key: str, batch: list[dict]) -> None:
    resp = client.post(
        f"{url.rstrip('/')}/rest/v1/nova_ingredients",
        json=batch,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Supabase upsert failed {resp.status_code}: {resp.text[:400]}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    entries = load_entries()
    print(f"Loaded {len(entries)} NOVA entries from {DATA_PATH}")

    if args.dry_run:
        print("Dry-run — skipping Supabase writes.")
        return 0

    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        return 2

    with httpx.Client(timeout=TIMEOUT) as client:
        for i in range(0, len(entries), BATCH_SIZE):
            batch = entries[i:i + BATCH_SIZE]
            upsert_batch(client, url, key, batch)
            print(f"Upserted {i + len(batch)} / {len(entries)}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
