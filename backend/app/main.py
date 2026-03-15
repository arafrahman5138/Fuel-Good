import asyncio
from collections import defaultdict, deque
from contextlib import asynccontextmanager
import json
import logging
import time
import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.auth import require_premium_user
from app.routers import auth, billing, chat, meal_plan, grocery, recipes, food_db, gamification, nutrition, metabolic, whole_food_scan, scan, telemetry, notifications
from app.db import engine
from app.services.notifications import notification_scheduler_loop
from app.services.embeddings import active_embedding_provider

# Import all models so they register with Base.metadata
from app.models import user, meal_plan as mp_model, recipe, grocery as g_model, gamification as gm_model  # noqa: F401
from app.models import saved_recipe as sr_model, nutrition as nt_model, local_food as lf_model  # noqa: F401
from app.models import metabolic as met_model, metabolic_profile as met_profile_model, scanned_meal as scanned_meal_model  # noqa: F401
from app.models import recipe_embedding as recipe_embedding_model, notification as notification_model, chat_usage as chat_usage_model  # noqa: F401

settings = get_settings()
DEFAULT_DEV_SECRET = "dev-secret-key-change-in-production"
app_logger = logging.getLogger("fuelgood.api")


def _configure_logging() -> None:
    level_name = (settings.log_level or "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format="%(message)s")
    logging.getLogger().setLevel(level)
    app_logger.setLevel(level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    _validate_security_settings()
    _seed_on_startup()
    scheduler_task = None
    if settings.run_notification_scheduler:
        scheduler_task = asyncio.create_task(notification_scheduler_loop())
        app_logger.info(json.dumps({"event": "scheduler.started"}))
    try:
        yield
    finally:
        if scheduler_task is not None:
            scheduler_task.cancel()
            try:
                await scheduler_task
            except asyncio.CancelledError:
                pass


def _validate_security_settings() -> None:
    env = (settings.environment or "development").lower()
    # Block unsafe secret configuration outside development.
    if env not in {"dev", "development"}:
        if settings.secret_key == DEFAULT_DEV_SECRET or len(settings.secret_key or "") < 32:
            raise RuntimeError("Unsafe JWT secret_key for non-development environment. Set a strong SECRET_KEY in env.")
        origins = _parse_cors_origins(settings.cors_allowed_origins)
        if not origins:
            raise RuntimeError("CORS_ALLOWED_ORIGINS must be set in non-development environments.")
        if any(origin == "*" or "localhost" in origin or "127.0.0.1" in origin for origin in origins):
            raise RuntimeError("CORS_ALLOWED_ORIGINS contains development or wildcard origins in non-development environment.")
        if settings.run_startup_seeding:
            raise RuntimeError("RUN_STARTUP_SEEDING must be false in non-development environments.")

    _validate_ai_settings(env)


def _parse_cors_origins(raw: str) -> list[str]:
    return [o.strip() for o in (raw or "").split(",") if o.strip()]

def _validate_ai_settings(env: str) -> None:
    provider = (settings.llm_provider or "").strip().lower()
    embedding_provider = (settings.embedding_provider or "").strip().lower()
    if provider not in {"gemini", "openai", "anthropic", "ollama"}:
        raise RuntimeError(f"Unsupported LLM_PROVIDER: {provider!r}")
    if embedding_provider not in {"none", "gemini", "openai", "ollama"}:
        raise RuntimeError(f"Unsupported EMBEDDING_PROVIDER: {embedding_provider!r}")

    if env in {"dev", "development"}:
        if provider == "ollama" and not settings.ollama_host:
            raise RuntimeError("LLM_PROVIDER=ollama requires OLLAMA_HOST.")
        return

    if provider == "gemini" and not (settings.google_api_key or settings.gemini_api_key):
        raise RuntimeError("LLM_PROVIDER=gemini requires GOOGLE_API_KEY or GEMINI_API_KEY.")
    if provider == "openai" and not settings.openai_api_key:
        raise RuntimeError("LLM_PROVIDER=openai requires OPENAI_API_KEY.")
    if provider == "anthropic" and not settings.anthropic_api_key:
        raise RuntimeError("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY.")
    if provider == "ollama":
        if env not in {"dev", "development"}:
            raise RuntimeError("LLM_PROVIDER=ollama is only allowed in development environments.")
        if not settings.ollama_host:
            raise RuntimeError("LLM_PROVIDER=ollama requires OLLAMA_HOST.")
    if embedding_provider == "gemini" and not (settings.google_api_key or settings.gemini_api_key):
        raise RuntimeError("EMBEDDING_PROVIDER=gemini requires GOOGLE_API_KEY or GEMINI_API_KEY.")
    if embedding_provider == "openai" and not settings.openai_api_key:
        raise RuntimeError("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY.")
    if embedding_provider == "ollama" and not settings.ollama_host:
        raise RuntimeError("EMBEDDING_PROVIDER=ollama requires OLLAMA_HOST.")
    _validate_pgvector_readiness()


def _validate_pgvector_readiness() -> None:
    provider, _ = active_embedding_provider()
    if provider == "none":
        return
    with engine.begin() as conn:
        vector_ok = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()
        if not vector_ok:
            raise RuntimeError("pgvector extension is not installed in the configured database.")
        column_type = conn.execute(text(
            "SELECT atttypmod "
            "FROM pg_attribute "
            "WHERE attrelid = 'recipe_embeddings'::regclass "
            "AND attname = 'embedding' AND NOT attisdropped"
        )).scalar()
        if column_type is None:
            raise RuntimeError("recipe_embeddings.embedding column is missing.")
        dimension = int(column_type) - 4
        if dimension != settings.embedding_dimension:
            raise RuntimeError(
                f"Embedding dimension mismatch: database={dimension}, config={settings.embedding_dimension}."
            )
        index_ok = conn.execute(text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'recipe_embeddings' AND indexdef ILIKE '%embedding%'"
        )).scalar()
        if not index_ok:
            raise RuntimeError("A pgvector index on recipe_embeddings.embedding is missing.")


def _seed_on_startup():
    """Populate achievements on startup. Recipe seeding is disabled — run seed_db.py manually."""
    if not settings.run_startup_seeding:
        return
    import logging
    log = logging.getLogger(__name__)
    # Recipe seeding disabled — old meals backed up in seed_meals_backup.json.
    # To re-seed old meals: python seed_db.py
    # To restore from backup: python restore_meals.py
    try:
        from app.achievements_engine import seed_achievements
        from app.db import SessionLocal
        from app.services.food_catalog import seed_food_catalog
        db = SessionLocal()
        try:
            seed_achievements(db)
            seed_food_catalog(db)
        finally:
            db.close()
    except Exception as exc:
        log.warning("Achievement seeding skipped: %s", exc)


app = FastAPI(
    title="Fuel Good API",
    description="Backend API for Fuel Good - eat real, whole foods",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = _parse_cors_origins(settings.cors_allowed_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Lightweight in-process rate limiter (IP + path window)
_rate_buckets: dict[tuple[str, str], deque] = defaultdict(deque)
WINDOW_SECONDS = 60


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path or ""
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()

    # Only protect API routes.
    protect_api = path.startswith("/api/")
    if not protect_api:
        try:
            response = await call_next(request)
        except Exception:
            app_logger.exception(
                json.dumps(
                    {
                        "event": "request.failed",
                        "request_id": request_id,
                        "method": request.method,
                        "path": path,
                    }
                )
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
                headers={"X-Request-Id": request_id},
            )
        response.headers["X-Request-Id"] = request_id
        return response

    client_ip = request.client.host if request.client else "unknown"
    key = (client_ip, path)
    now = time.time()

    # Stricter budget for auth endpoints.
    auth_sensitive = (
        path.startswith("/api/auth/login")
        or path.startswith("/api/auth/register")
        or path.startswith("/api/auth/refresh")
        or path.startswith("/api/auth/social")
        or path.startswith("/api/auth/forgot-password")
        or path.startswith("/api/auth/reset-password")
    )
    limit = settings.auth_rate_limit_per_minute if auth_sensitive else settings.rate_limit_per_minute

    q = _rate_buckets[key]
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()

    if len(q) >= limit:
        response = JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please try again shortly.", "request_id": request_id},
        )
        response.headers["X-Request-Id"] = request_id
        app_logger.warning(
            json.dumps(
                {
                    "event": "rate_limited",
                    "request_id": request_id,
                    "method": request.method,
                    "path": path,
                    "client_ip": client_ip,
                }
            )
        )
        return response

    q.append(now)
    try:
        response = await call_next(request)
    except Exception:
        app_logger.exception(
            json.dumps(
                {
                    "event": "request.failed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": path,
                    "client_ip": client_ip,
                }
            )
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
            headers={"X-Request-Id": request_id},
        )

    duration_ms = round((time.perf_counter() - started) * 1000, 1)
    response.headers["X-Request-Id"] = request_id
    if settings.enable_structured_logging:
        app_logger.info(
            json.dumps(
                {
                    "event": "request.completed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                }
            )
        )
    return response


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])
app.include_router(chat.router, prefix="/api/chat", tags=["Healthify Chatbot"], dependencies=[Depends(require_premium_user)])
app.include_router(meal_plan.router, prefix="/api/meal-plans", tags=["Meal Plans"], dependencies=[Depends(require_premium_user)])
app.include_router(grocery.router, prefix="/api/grocery", tags=["Grocery Lists"], dependencies=[Depends(require_premium_user)])
app.include_router(recipes.router, prefix="/api/recipes", tags=["Recipes"], dependencies=[Depends(require_premium_user)])
app.include_router(food_db.router, prefix="/api/foods", tags=["Food Database"], dependencies=[Depends(require_premium_user)])
app.include_router(scan.router, prefix="/api/scan", tags=["Scan"], dependencies=[Depends(require_premium_user)])
app.include_router(whole_food_scan.router, prefix="/api/whole-food-scan", tags=["Whole Food Scan"], dependencies=[Depends(require_premium_user)])
app.include_router(gamification.router, prefix="/api/game", tags=["Gamification"], dependencies=[Depends(require_premium_user)])
app.include_router(nutrition.router, prefix="/api/nutrition", tags=["Chronometer"], dependencies=[Depends(require_premium_user)])
app.include_router(metabolic.router, prefix="/api/metabolic", tags=["Metabolic Budget"])
app.include_router(telemetry.router, prefix="/api/telemetry", tags=["Telemetry"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])


@app.get("/")
async def root():
    return {"message": "Welcome to Fuel Good API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.environment,
        "version": "1.0.0",
        "scheduler_enabled": settings.run_notification_scheduler,
        "startup_seeding_enabled": settings.run_startup_seeding,
        "llm_provider": settings.llm_provider,
    }
