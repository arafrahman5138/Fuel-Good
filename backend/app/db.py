import logging
import uuid
from pathlib import Path

from sqlalchemy import String, TypeDecorator, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=30,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class GUID(TypeDecorator):
    """Platform-independent UUID type backed by strings."""

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return str(value)
        return value


class Base(DeclarativeBase):
    pass


# Import models once so relationship targets are registered regardless of
# endpoint/module import order.
from app import models as _models  # noqa: E402,F401


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize schema without bypassing Alembic on persistent databases."""
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    else:
        _run_alembic_upgrade()
    ensure_legacy_schema_columns()
    ensure_pgvector_schema()


def _run_alembic_upgrade() -> None:
    from alembic import command
    from alembic.config import Config

    backend_root = Path(__file__).resolve().parents[1]
    alembic_ini = backend_root / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("script_location", str(backend_root / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "heads")


def ensure_legacy_schema_columns() -> None:
    """Add missing columns and tables in PostgreSQL for legacy environments."""
    from sqlalchemy import text

    # ── Create missing tables first ──────────────────────────────────
    table_ddls = [
        ("chat_usage_events", """
            CREATE TABLE IF NOT EXISTS chat_usage_events (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                route VARCHAR NOT NULL DEFAULT 'healthify',
                response_mode VARCHAR NOT NULL DEFAULT 'unknown',
                cost_units FLOAT NOT NULL DEFAULT 1.0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """),
        ("product_label_scans", """
            CREATE TABLE IF NOT EXISTS product_label_scans (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                capture_type VARCHAR,
                image_url VARCHAR,
                image_bucket VARCHAR,
                image_path VARCHAR,
                image_mime_type VARCHAR,
                product_name VARCHAR,
                brand VARCHAR,
                ingredients_text VARCHAR,
                confidence FLOAT DEFAULT 0.0,
                confidence_breakdown JSON,
                analysis JSON,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """),
        ("daily_fuel_summaries", """
            CREATE TABLE IF NOT EXISTS daily_fuel_summaries (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                date DATE NOT NULL,
                avg_fuel_score FLOAT DEFAULT 0.0,
                meal_count INTEGER DEFAULT 0,
                total_score_points FLOAT DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (user_id, date)
            )
        """),
        ("weekly_fuel_summaries", """
            CREATE TABLE IF NOT EXISTS weekly_fuel_summaries (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                week_start DATE NOT NULL,
                avg_fuel_score FLOAT DEFAULT 0.0,
                meal_count INTEGER DEFAULT 0,
                total_score_points FLOAT DEFAULT 0.0,
                flex_meals_used INTEGER DEFAULT 0,
                flex_budget_total FLOAT DEFAULT 0.0,
                flex_budget_remaining FLOAT DEFAULT 0.0,
                target_met BOOLEAN DEFAULT FALSE,
                streak_weeks INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (user_id, week_start)
            )
        """),
    ]

    # ── Column migrations ────────────────────────────────────────────
    migrations = [
        ("metabolic_scores", "display_score", "ALTER TABLE metabolic_scores ADD COLUMN display_score FLOAT DEFAULT 0"),
        ("metabolic_scores", "display_tier", "ALTER TABLE metabolic_scores ADD COLUMN display_tier VARCHAR DEFAULT 'crash_risk'"),
        ("metabolic_scores", "meal_context", "ALTER TABLE metabolic_scores ADD COLUMN meal_context VARCHAR DEFAULT 'full_meal'"),
        ("users", "provider_subject", "ALTER TABLE users ADD COLUMN provider_subject VARCHAR"),
        ("users", "revenuecat_customer_id", "ALTER TABLE users ADD COLUMN revenuecat_customer_id VARCHAR"),
        ("users", "subscription_product_id", "ALTER TABLE users ADD COLUMN subscription_product_id VARCHAR"),
        ("users", "subscription_store", "ALTER TABLE users ADD COLUMN subscription_store VARCHAR"),
        ("users", "subscription_status", "ALTER TABLE users ADD COLUMN subscription_status VARCHAR DEFAULT 'inactive'"),
        ("users", "subscription_trial_started_at", "ALTER TABLE users ADD COLUMN subscription_trial_started_at TIMESTAMP"),
        ("users", "subscription_trial_ends_at", "ALTER TABLE users ADD COLUMN subscription_trial_ends_at TIMESTAMP"),
        ("users", "subscription_current_period_ends_at", "ALTER TABLE users ADD COLUMN subscription_current_period_ends_at TIMESTAMP"),
        ("users", "subscription_will_renew", "ALTER TABLE users ADD COLUMN subscription_will_renew BOOLEAN DEFAULT FALSE"),
        ("users", "subscription_manage_url", "ALTER TABLE users ADD COLUMN subscription_manage_url VARCHAR"),
        ("users", "subscription_last_synced_at", "ALTER TABLE users ADD COLUMN subscription_last_synced_at TIMESTAMP"),
        ("users", "password_reset_code_hash", "ALTER TABLE users ADD COLUMN password_reset_code_hash VARCHAR"),
        ("users", "password_reset_code_expires_at", "ALTER TABLE users ADD COLUMN password_reset_code_expires_at TIMESTAMP"),
        ("users", "password_reset_attempts", "ALTER TABLE users ADD COLUMN password_reset_attempts INTEGER DEFAULT 0"),
        ("users", "access_override_level", "ALTER TABLE users ADD COLUMN access_override_level VARCHAR"),
        ("users", "access_override_reason", "ALTER TABLE users ADD COLUMN access_override_reason VARCHAR"),
        ("users", "access_override_expires_at", "ALTER TABLE users ADD COLUMN access_override_expires_at TIMESTAMP"),
        ("users", "access_override_updated_at", "ALTER TABLE users ADD COLUMN access_override_updated_at TIMESTAMP"),
        ("users", "fuel_target", "ALTER TABLE users ADD COLUMN fuel_target INTEGER DEFAULT 80"),
        ("users", "expected_meals_per_week", "ALTER TABLE users ADD COLUMN expected_meals_per_week INTEGER DEFAULT 21"),
        ("users", "clean_eating_pct", "ALTER TABLE users ADD COLUMN clean_eating_pct INTEGER DEFAULT 80"),
        ("local_foods", "brand", "ALTER TABLE local_foods ADD COLUMN brand VARCHAR"),
        ("local_foods", "source_kind", "ALTER TABLE local_foods ADD COLUMN source_kind VARCHAR DEFAULT 'whole_food'"),
        ("local_foods", "aliases", "ALTER TABLE local_foods ADD COLUMN aliases JSON"),
        ("local_foods", "default_serving_label", "ALTER TABLE local_foods ADD COLUMN default_serving_label VARCHAR DEFAULT '1 serving'"),
        ("local_foods", "default_serving_grams", "ALTER TABLE local_foods ADD COLUMN default_serving_grams FLOAT DEFAULT 100"),
        ("local_foods", "serving_options", "ALTER TABLE local_foods ADD COLUMN serving_options JSON"),
        ("local_foods", "nutrition_per_100g", "ALTER TABLE local_foods ADD COLUMN nutrition_per_100g JSON"),
        ("local_foods", "nutrition_per_serving", "ALTER TABLE local_foods ADD COLUMN nutrition_per_serving JSON"),
        ("local_foods", "mes_ready_nutrition", "ALTER TABLE local_foods ADD COLUMN mes_ready_nutrition JSON"),
        ("local_foods", "micronutrients", "ALTER TABLE local_foods ADD COLUMN micronutrients JSON"),
        ("local_foods", "is_active", "ALTER TABLE local_foods ADD COLUMN is_active BOOLEAN DEFAULT TRUE"),
        ("recipes", "recipe_role", "ALTER TABLE recipes ADD COLUMN recipe_role VARCHAR DEFAULT 'full_meal'"),
        ("recipes", "is_component", "ALTER TABLE recipes ADD COLUMN is_component BOOLEAN DEFAULT FALSE"),
        ("recipes", "meal_group_id", "ALTER TABLE recipes ADD COLUMN meal_group_id VARCHAR"),
        ("recipes", "default_pairing_ids", "ALTER TABLE recipes ADD COLUMN default_pairing_ids JSON"),
        ("recipes", "needs_default_pairing", "ALTER TABLE recipes ADD COLUMN needs_default_pairing BOOLEAN"),
        ("recipes", "component_composition", "ALTER TABLE recipes ADD COLUMN component_composition JSON"),
        ("recipes", "is_mes_scoreable", "ALTER TABLE recipes ADD COLUMN is_mes_scoreable BOOLEAN DEFAULT TRUE"),
        ("recipes", "glycemic_profile", "ALTER TABLE recipes ADD COLUMN glycemic_profile JSON"),
        ("recipes", "fuel_score", "ALTER TABLE recipes ADD COLUMN fuel_score FLOAT DEFAULT 100"),
        ("food_logs", "fuel_score", "ALTER TABLE food_logs ADD COLUMN fuel_score FLOAT"),
        ("scanned_meal_logs", "grounding_source", "ALTER TABLE scanned_meal_logs ADD COLUMN grounding_source VARCHAR"),
        ("scanned_meal_logs", "grounding_candidates", "ALTER TABLE scanned_meal_logs ADD COLUMN grounding_candidates JSON"),
        ("scanned_meal_logs", "prompt_version", "ALTER TABLE scanned_meal_logs ADD COLUMN prompt_version VARCHAR"),
        ("scanned_meal_logs", "matched_recipe_confidence", "ALTER TABLE scanned_meal_logs ADD COLUMN matched_recipe_confidence FLOAT DEFAULT 0"),
        ("scanned_meal_logs", "image_bucket", "ALTER TABLE scanned_meal_logs ADD COLUMN image_bucket VARCHAR"),
        ("scanned_meal_logs", "image_path", "ALTER TABLE scanned_meal_logs ADD COLUMN image_path VARCHAR"),
        ("scanned_meal_logs", "image_mime_type", "ALTER TABLE scanned_meal_logs ADD COLUMN image_mime_type VARCHAR"),
        ("scanned_meal_logs", "fuel_score", "ALTER TABLE scanned_meal_logs ADD COLUMN fuel_score FLOAT"),
        ("notification_deliveries", "retry_count", "ALTER TABLE notification_deliveries ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL"),
        ("notification_deliveries", "next_retry_at", "ALTER TABLE notification_deliveries ADD COLUMN next_retry_at TIMESTAMP"),
    ]
    embed_dim = int(settings.embedding_dimension)

    # Each DDL runs in its own SAVEPOINT so a failure (e.g. an index that
    # references a not-yet-added column) doesn't poison the whole transaction
    # with `InFailedSqlTransaction` and silently skip every subsequent step.
    # Bug history: with one outer transaction, a stale CREATE INDEX on
    # notification_deliveries(next_retry_at) failed before the column-add
    # loop ran, which aborted the transaction and left prod missing every
    # legacy column the safety net was supposed to backfill (notably
    # notification_deliveries.retry_count, breaking /auth/me).
    def _safe_ddl(conn, sql_text: str, label: str, params: dict | None = None) -> None:
        try:
            with conn.begin_nested():
                conn.execute(text(sql_text), params or {})
        except Exception as exc:
            logger.warning("ensure_legacy_schema: %s skipped: %s", label, exc)

    with engine.begin() as conn:
        _safe_ddl(conn, "CREATE EXTENSION IF NOT EXISTS vector", "pgvector extension")

        # Step 1: Create missing tables (must come before columns/indexes).
        for table_name, ddl in table_ddls:
            try:
                with conn.begin_nested():
                    exists = conn.execute(text(
                        "SELECT 1 FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_name = :t"
                    ), {"t": table_name}).scalar()
                    if not exists:
                        conn.execute(text(ddl))
                        logger.info("ensure_legacy_schema: created table %s", table_name)
            except Exception as exc:
                logger.warning("ensure_legacy_schema: table %s skipped: %s", table_name, exc)

        # Step 2: Add missing columns BEFORE creating indexes that reference them.
        for table, col, ddl in migrations:
            try:
                with conn.begin_nested():
                    rows = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :table AND column_name = :col"
                    ), {"table": table, "col": col}).fetchall()
                    if not rows:
                        conn.execute(text(ddl))
            except Exception as exc:
                logger.warning("ensure_legacy_schema: %s.%s skipped: %s", table, col, exc)

        # Step 3: pgvector column on recipe_embeddings (depends on extension).
        _safe_ddl(
            conn,
            "ALTER TABLE recipe_embeddings ADD COLUMN IF NOT EXISTS embedding vector(:dim)",
            "recipe_embeddings.embedding",
            {"dim": embed_dim},
        )

        # Step 4: Indexes (depend on tables AND columns existing).
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS ix_chat_usage_events_user_id ON chat_usage_events(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_chat_usage_events_created_at ON chat_usage_events(created_at)",
            "CREATE INDEX IF NOT EXISTS ix_chat_usage_events_user_route_created ON chat_usage_events(user_id, route, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_food_logs_user_date ON food_logs(user_id, date)",
            "CREATE INDEX IF NOT EXISTS ix_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_product_label_scans_user_id ON product_label_scans(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_daily_fuel_summaries_user_id ON daily_fuel_summaries(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_daily_fuel_summaries_date ON daily_fuel_summaries(date)",
            "CREATE INDEX IF NOT EXISTS ix_weekly_fuel_summaries_user_id ON weekly_fuel_summaries(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_weekly_fuel_summaries_week_start ON weekly_fuel_summaries(week_start)",
            "CREATE INDEX IF NOT EXISTS ix_notification_deliveries_next_retry_at ON notification_deliveries(next_retry_at)",
            "CREATE INDEX IF NOT EXISTS ix_users_provider_subject ON users(provider_subject)",
            "CREATE INDEX IF NOT EXISTS ix_users_revenuecat_customer_id ON users(revenuecat_customer_id)",
        ]:
            _safe_ddl(conn, idx_sql, "index")


def ensure_pgvector_schema() -> None:
    from sqlalchemy import text

    embed_dim = int(settings.embedding_dimension)
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception as exc:
            logger.warning("ensure_pgvector_schema: extension creation failed: %s", exc)
            return

        try:
            conn.execute(text(
                "ALTER TABLE recipe_embeddings ADD COLUMN IF NOT EXISTS embedding vector(:dim)"
            ), {"dim": embed_dim})
        except Exception as exc:
            logger.warning("ensure_pgvector_schema: embedding column failed: %s", exc)
            return

        # ivfflat and hnsw indexes support max 2000 dimensions
        if embed_dim <= 2000:
            try:
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_recipe_embeddings_embedding_ivfflat "
                    "ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
                ))
            except Exception as exc:
                logger.warning("ensure_pgvector_schema: ivfflat index creation skipped: %s", exc)
        else:
            logger.info(
                "ensure_pgvector_schema: skipping ivfflat index (embedding_dimension=%d > 2000 limit)",
                embed_dim,
            )
