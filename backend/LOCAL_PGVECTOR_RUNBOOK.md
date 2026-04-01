# Local pgvector Runbook

## Backup location

Local backups are written to `backend/backups/` by `backend/scripts/backup_local_db.sh`.

## Safe in-place upgrade

1. Run `backend/scripts/backup_local_db.sh`.
2. Start the local DB with `docker compose up -d`.
3. Run `backend/db_setup.sh`.
4. Backfill embeddings with `python scripts/backfill_recipe_embeddings.py`.
5. Verify retrieval with `python scripts/verify_ai_quality.py`.

The Docker volume `pgdata` is preserved. Do not delete or rename it.

## Restore

To restore from a backup:

1. Ensure the local container is running.
2. Create a fresh schema if needed.
3. Pipe the saved SQL file into `psql` inside `fuelgood-postgres`.
