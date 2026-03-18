import logging
import uuid
from pathlib import Path

from sqlalchemy import String, TypeDecorator, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

engine = create_engine(settings.database_url)
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
    """Add missing columns in PostgreSQL for legacy environments."""
    from sqlalchemy import text

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
        ("users", "access_override_level", "ALTER TABLE users ADD COLUMN access_override_level VARCHAR"),
        ("users", "access_override_reason", "ALTER TABLE users ADD COLUMN access_override_reason VARCHAR"),
        ("users", "access_override_expires_at", "ALTER TABLE users ADD COLUMN access_override_expires_at TIMESTAMP"),
        ("users", "access_override_updated_at", "ALTER TABLE users ADD COLUMN access_override_updated_at TIMESTAMP"),
        ("users", "fuel_target", "ALTER TABLE users ADD COLUMN fuel_target INTEGER DEFAULT 80"),
        ("users", "expected_meals_per_week", "ALTER TABLE users ADD COLUMN expected_meals_per_week INTEGER DEFAULT 21"),
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
    ]
    embed_dim = int(settings.embedding_dimension)
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception as exc:
            logger.warning("ensure_legacy_schema: pgvector extension creation skipped: %s", exc)
        for table, col, ddl in migrations:
            try:
                rows = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :col"
                ), {"table": table, "col": col}).fetchall()
                if not rows:
                    conn.execute(text(ddl))
            except Exception as exc:
                logger.warning("ensure_legacy_schema: %s.%s skipped: %s", table, col, exc)
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_provider_subject ON users(provider_subject)"))
        except Exception as exc:
            logger.warning("ensure_legacy_schema: ix_users_provider_subject skipped: %s", exc)
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_revenuecat_customer_id ON users(revenuecat_customer_id)"))
        except Exception as exc:
            logger.warning("ensure_legacy_schema: ix_users_revenuecat_customer_id skipped: %s", exc)
        try:
            conn.execute(text(
                "ALTER TABLE recipe_embeddings ADD COLUMN IF NOT EXISTS embedding vector(:dim)"
            ), {"dim": embed_dim})
        except Exception as exc:
            logger.warning("ensure_legacy_schema: recipe_embeddings.embedding skipped: %s", exc)


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

        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_recipe_embeddings_embedding_ivfflat "
                "ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
            ))
        except Exception as exc:
            logger.warning("ensure_pgvector_schema: ivfflat index creation skipped: %s", exc)
