# Backup and Restore

## Recommended Low-Cost Production Baseline

- Managed PostgreSQL with daily backups enabled.
- Hosted backend on a managed app platform with persistent logs.

## Backup Policy

- Daily automated database backups.
- Retain at least 7 days of point-in-time or snapshot restore capability.
- Export a weekly schema-only dump and keep it outside the primary vendor account.

## Restore Drill

Run once before external TestFlight:

1. Create a temporary database instance.
2. Restore from the latest backup.
3. Run the backend against the restored database.
4. Verify auth, recipe browse, scan history, and meal plan endpoints.
5. Record restore duration and blockers.

## Secrets Rotation

- Rotate `SECRET_KEY` only with planned session invalidation.
- Rotate AI/API keys quarterly or immediately if exposed.
- Update EAS and backend hosting secrets in the same change window.
