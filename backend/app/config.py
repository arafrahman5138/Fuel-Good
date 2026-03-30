from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Fuel Good API"
    environment: str = "development"  # development | staging | production
    database_url: str = "postgresql://realfood:realfood_local@localhost:5432/fuelgood"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    password_reset_token_expire_minutes: int = 30

    # Security / network hardening
    cors_allowed_origins: str = "http://localhost:8081,http://localhost:3000,http://localhost:19006"
    rate_limit_per_minute: int = 120
    auth_rate_limit_per_minute: int = 20
    social_auth_enabled: bool = True
    apple_bundle_id: str = "com.fuelgood.ios"
    google_userinfo_url: str = "https://openidconnect.googleapis.com/v1/userinfo"
    google_client_id: str = ""
    google_client_secret: str = ""
    apple_jwks_url: str = "https://appleid.apple.com/auth/keys"
    social_request_timeout_seconds: float = Field(default=10.0, ge=1.0, le=30.0)
    log_level: str = "INFO"
    enable_structured_logging: bool = True
    run_notification_scheduler: bool = False
    notification_runner_secret: str = ""
    notification_cron_batch_size: int = 100
    notification_cron_user_limit: int = 250
    run_startup_seeding: bool = False
    support_email: str = "support@fuelgood.app"
    resend_api_key: str = ""
    email_from: str = "noreply@fuelgood.app"
    email_reply_to: str = "support@fuelgood.app"
    privacy_policy_url: str = ""
    terms_url: str = ""
    support_url: str = ""
    expo_push_access_token: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_meal_scans_bucket: str = "meal-scans"
    supabase_storage_label_scans_bucket: str = "label-scans"
    supabase_signed_url_ttl_seconds: int = 3600
    revenuecat_secret_api_key: str = ""
    revenuecat_ios_api_key: str = ""
    revenuecat_webhook_authorization: str = ""
    revenuecat_api_base_url: str = "https://api.revenuecat.com/v1"
    revenuecat_entitlement_id: str = "Fuel Good Premium"
    revenuecat_offering_id: str = "default"
    revenuecat_monthly_product_id: str = "monthly"
    revenuecat_annual_product_id: str = "yearly"
    revenuecat_lifetime_product_id: str = "lifetime"
    revenuecat_trial_days: int = 7
    app_store_manage_subscriptions_url: str = "https://apps.apple.com/account/subscriptions"
    chat_quota_exempt_emails: str = ""

    openai_api_key: str = ""
    chat_model: str = "gemini-2.5-flash"
    scan_model: str = "gemini-2.5-flash"
    embedding_provider: str = "gemini"
    embedding_model: str = "gemini-embedding-001"
    embedding_dimension: int = 768
    openai_embedding_model: str = "text-embedding-3-small"
    anthropic_api_key: str = ""
    google_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-001"
    llm_provider: str = "gemini"  # "gemini", "openai", "anthropic", or "ollama"
    ollama_host: str = ""
    ollama_model: str = "qwen2.5-coder:14b"
    ollama_embedding_model: str = "nomic-embed-text"
    usda_api_key: str = ""
    spoonacular_api_key: str = ""

    # Scan pipeline feature flags
    usda_grounding_enabled: bool = True            # USDA FoodData Central nutrition lookups
    hidden_ingredient_model_enabled: bool = True   # Claude ensemble reasoning (hidden ingredients + nutrition cross-check)

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
