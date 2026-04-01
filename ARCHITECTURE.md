# ARCHITECTURE.md

## 1. PROJECT STRUCTURE

```
Fuel-Good/
├── backend/                          # Python/FastAPI API server
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry, CORS, middleware
│   │   ├── config.py                 # Pydantic Settings (env vars)
│   │   ├── db.py                     # SQLAlchemy engine, session, GUID type
│   │   ├── auth.py                   # JWT, bcrypt, OAuth2 bearer
│   │   ├── achievements_engine.py    # XP, streaks, badge logic
│   │   ├── seed_meals.py             # Recipe database seeder
│   │   ├── models/                   # SQLAlchemy ORM models (17 files)
│   │   │   ├── user.py               #   Accounts, subscriptions, preferences
│   │   │   ├── recipe.py             #   Recipe definitions, composition
│   │   │   ├── meal_plan.py          #   Weekly meal plans
│   │   │   ├── nutrition.py          #   Food logs, macros
│   │   │   ├── fuel.py               #   Fuel score tracking
│   │   │   ├── gamification.py       #   XP, streaks, achievements
│   │   │   ├── metabolic.py          #   MES scores per meal
│   │   │   ├── metabolic_profile.py  #   User metabolic targets
│   │   │   ├── grocery.py            #   Grocery lists
│   │   │   ├── saved_recipe.py       #   Bookmarked recipes
│   │   │   ├── scanned_meal.py       #   AI-analyzed meal scans
│   │   │   ├── product_label_scan.py #   Barcode/label scans
│   │   │   ├── recipe_embedding.py   #   Vector embeddings (pgvector)
│   │   │   ├── notification.py       #   Notification records
│   │   │   ├── chat_usage.py         #   Chat quota tracking
│   │   │   └── local_food.py         #   User-specific foods
│   │   ├── routers/                  # API endpoints (17 files)
│   │   │   ├── auth.py               #   Registration, login, OAuth
│   │   │   ├── billing.py            #   RevenueCat subscriptions
│   │   │   ├── chat.py               #   Healthify chatbot
│   │   │   ├── meal_plan.py          #   Meal plan CRUD & generation
│   │   │   ├── grocery.py            #   Grocery list generation
│   │   │   ├── recipes.py            #   Recipe search & filtering
│   │   │   ├── food_db.py            #   USDA food database search
│   │   │   ├── scan.py               #   Barcode & meal scanning
│   │   │   ├── whole_food_scan.py    #   Ingredient quality analysis
│   │   │   ├── gamification.py       #   Achievements, leaderboards
│   │   │   ├── nutrition.py          #   Food logging (Chronometer)
│   │   │   ├── fuel.py               #   Fuel score endpoints
│   │   │   ├── metabolic.py          #   MES calculation
│   │   │   ├── notifications.py      #   Notification preferences
│   │   │   ├── telemetry.py          #   Analytics events
│   │   │   └── internal.py           #   Admin/cron endpoints
│   │   ├── services/                 # Business logic (14 files)
│   │   │   ├── meal_scan.py          #   AI-powered meal scanning
│   │   │   ├── fuel_score.py         #   Whole food quality scoring
│   │   │   ├── metabolic_engine.py   #   MES algorithm, glycemic analysis
│   │   │   ├── whole_food_scoring.py #   Ingredient analysis
│   │   │   ├── recipe_retrieval.py   #   Semantic search (pgvector)
│   │   │   ├── embeddings.py         #   Multi-provider embeddings
│   │   │   ├── notifications.py      #   Push notification dispatch
│   │   │   ├── supabase_storage.py   #   Image upload
│   │   │   ├── product_label_scan.py #   Nutritionix barcode lookup
│   │   │   ├── billing.py            #   RevenueCat entitlements
│   │   │   ├── ingredient_substitution.py # Healthify alternatives
│   │   │   ├── chat_limits.py        #   Premium quota enforcement
│   │   │   └── food_catalog.py       #   Food database seeding
│   │   ├── agents/                   # LangGraph AI workflows (5 files)
│   │   │   ├── healthify.py          #   Meal transformation agent
│   │   │   ├── meal_planner_fallback.py # Meal plan generation
│   │   │   ├── cook_assistant.py     #   Recipe guidance
│   │   │   └── ingredient_swapper.py #   Ingredient swap logic
│   │   ├── schemas/                  # Pydantic request/response models
│   │   └── data/                     # Static data files
│   ├── alembic/                      # Database migrations (18 versions)
│   ├── tests/                        # pytest test suite (8 files)
│   ├── scripts/                      # Utility scripts
│   ├── requirements.txt
│   └── start.sh
│
├── frontend/                         # React Native / Expo mobile app
│   ├── app/                          # Expo Router (file-based routing)
│   │   ├── (tabs)/                   #   Bottom tab navigation
│   │   │   ├── index.tsx             #     Home — MES/Fuel dashboard
│   │   │   ├── chat.tsx              #     Healthify chatbot
│   │   │   ├── chronometer.tsx       #     Food logging & nutrition
│   │   │   ├── meals.tsx             #     Meal plan management
│   │   │   └── profile.tsx           #     User settings
│   │   ├── (auth)/                   #   Auth flow
│   │   │   ├── login.tsx             #     Email/social login
│   │   │   └── onboarding.tsx        #     Signup & preferences
│   │   ├── browse/                   #   Recipe discovery
│   │   ├── food/                     #   Food logging screens
│   │   ├── scan/                     #   Barcode & meal scanning
│   │   ├── cook/                     #   Cook mode
│   │   ├── saved/                    #   Saved recipes
│   │   ├── subscribe.tsx             #   Paywall
│   │   ├── settings.tsx              #   App settings
│   │   └── _layout.tsx               #   Root layout
│   ├── components/                   # Reusable UI components (47 files)
│   ├── stores/                       # Zustand state management
│   ├── hooks/                        # Custom React hooks
│   ├── services/                     # API client layer
│   ├── utils/                        # Utility functions
│   ├── constants/                    # App constants
│   ├── assets/                       # Images & icons
│   ├── ios/                          # iOS native code
│   ├── android/                      # Android native code
│   └── package.json
│
├── docs/                             # Documentation
│   ├── fuel-score.md                 #   Fuel scoring algorithm
│   ├── mes-scoring.md                #   MES algorithm
│   ├── ops/                          #   Operations guides
│   ├── legal/                        #   Privacy policy, terms
│   └── qa/                           #   QA documentation
│
├── website/                          # Marketing site
├── .github/workflows/ci.yml         # GitHub Actions CI
├── docker-compose.yml                # Local dev PostgreSQL
├── render.yaml                       # Render deployment config
└── CLAUDE.md                         # Dev guidelines
```

---

## 2. HIGH-LEVEL SYSTEM DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│                     Mobile Client                        │
│            React Native / Expo (iOS + Android)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Zustand  │ │  Expo    │ │  Expo    │ │  Expo     │  │
│  │  Stores   │ │  Camera  │ │  Notif.  │ │  Auth     │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS (JWT Bearer)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Render)                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Middleware: CORS → Security Headers → Rate Limit  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Routers  │ │ Services │ │  Agents  │ │  Auth     │  │
│  │ (17 API) │→│ (14 biz  │→│(LangGraph│ │ (JWT +   │  │
│  │          │ │  logic)  │ │ workflows│ │  OAuth)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐                               │
│  │SQLAlchemy│ │ Alembic  │                               │
│  │  Models  │ │Migrations│                               │
│  └────┬─────┘ └──────────┘                               │
└───────┼─────────────────────────────────────────────────┘
        │ SQL
        ▼
┌───────────────┐    ┌──────────────┐    ┌──────────────┐
│  PostgreSQL   │    │   Supabase   │    │  RevenueCat  │
│  + pgvector   │    │   Storage    │    │  Billing     │
│  (Database)   │    │  (Images)    │    │  (Subs)      │
└───────────────┘    └──────────────┘    └──────────────┘

        External AI Providers                External APIs
┌──────────────────────────────┐   ┌──────────────────────┐
│  Gemini (default) │ OpenAI   │   │  USDA FoodData       │
│  Anthropic        │ Ollama   │   │  Nutritionix         │
│  (LLM + Embeddings)         │   │  Expo Push            │
└──────────────────────────────┘   └──────────────────────┘
```

---

## 3. CORE COMPONENTS

### Frontend — React Native / Expo

| Aspect | Detail |
|--------|--------|
| **Purpose** | Cross-platform mobile app (iOS + Android) |
| **Framework** | React Native 0.81 + Expo ~54 + Expo Router ~6 |
| **Language** | TypeScript ~5.9 |
| **State** | Zustand 5.0 stores |
| **Navigation** | File-based routing (Expo Router) |
| **Key Features** | Food logging, meal planning, AI chat, barcode scanning, nutrition tracking, gamification |
| **Deployment** | EAS Build → App Store / Google Play |

### Backend — FastAPI

| Aspect | Detail |
|--------|--------|
| **Purpose** | REST API server, AI orchestration, business logic |
| **Framework** | FastAPI 0.115, Uvicorn |
| **Language** | Python 3.13 |
| **ORM** | SQLAlchemy 2.0 |
| **AI Framework** | LangGraph 0.2 + LangChain |
| **Key Features** | JWT auth, premium paywall, AI agents (meal planning, chatbot, scanning), MES/Fuel scoring |
| **Deployment** | Render.com (web service) |

### AI Agents — LangGraph

| Aspect | Detail |
|--------|--------|
| **Purpose** | Multi-step AI workflows for meal transformation, planning, cooking guidance |
| **Default LLM** | Gemini 2.5 Flash (configurable to OpenAI/Anthropic/Ollama) |
| **Embeddings** | Gemini `embedding-001` / OpenAI `text-embedding-3-small` (768-dim, pgvector) |
| **Agents** | Healthify (meal transformation), Meal Planner, Cook Assistant, Ingredient Swapper |

---

## 4. DATA STORES

### PostgreSQL 15+ with pgvector

| Aspect | Detail |
|--------|--------|
| **Type** | Relational database with vector extension |
| **Purpose** | Primary data store for all application state |
| **Hosting** | Render PostgreSQL / Supabase pooling |
| **Migrations** | Alembic (18 migration versions) |

**Key Schemas/Tables:**

| Table | Purpose |
|-------|---------|
| `users` | Accounts, subscriptions (RevenueCat), preferences, XP, streaks, fuel target |
| `recipes` | Recipe definitions, nutrition info, fuel score, MES scoreability, glycemic profile |
| `meal_plans` | Weekly meal plans per user |
| `food_logs` | Individual food entries with macro/micronutrient data |
| `metabolic_scores` | MES scores per meal with tier display |
| `metabolic_profiles` | User-specific protein/fiber/sugar targets |
| `fuel_scores` | Daily/weekly whole-food quality scores |
| `gamification` | Achievement milestones, badge tracking |
| `grocery_lists` | Generated grocery lists with cost estimates |
| `saved_recipes` | User bookmarked recipes |
| `scanned_meals` | AI-analyzed meal photos with scores |
| `product_label_scans` | Barcode scan results |
| `recipe_embeddings` | 768-dim vector embeddings for semantic search |
| `notifications` | Notification records & delivery status |
| `chat_usage` | Premium chat quota tracking |
| `local_foods` | User-defined custom foods |

### Supabase Storage

| Aspect | Detail |
|--------|--------|
| **Type** | Object storage (S3-compatible) |
| **Purpose** | Meal scan photos, product label images |
| **Access** | Signed URLs with 3600s TTL |

---

## 5. EXTERNAL INTEGRATIONS

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Gemini** (Google) | Default LLM for chat, scanning, meal planning; embeddings for recipe search | API key, LangChain provider |
| **OpenAI** | Alternative LLM & embeddings provider | API key, LangChain provider |
| **Anthropic** (Claude) | Alternative LLM provider | API key, LangChain provider |
| **Ollama** | Local LLM for development | HTTP to local host |
| **RevenueCat** | Subscription management, entitlements, billing webhooks | REST API + webhook |
| **Supabase** | Image storage for meal/label scans | Supabase client SDK |
| **Expo Push** | Push notification delivery | Expo Push API with access token |
| **Google OAuth 2.0** | Social login (Google) | OIDC userinfo validation |
| **Apple Sign-In** | Social login (Apple) | JWKS token validation |
| **USDA FoodData Central** | Food nutrition database search | REST API with API key |
| **Nutritionix** | Barcode lookup for product labels | REST API |
| **Spoonacular** | Recipe data (optional) | REST API with API key |

---

## 6. DEPLOYMENT & INFRASTRUCTURE

### Production (Render.com)

| Aspect | Detail |
|--------|--------|
| **Provider** | Render |
| **Service** | Python web service |
| **Runtime** | Python 3.13.2 |
| **Build** | `pip install -r requirements.txt && alembic upgrade head` |
| **Start** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check** | `GET /health` |
| **Database** | Render PostgreSQL with pgvector |

### Mobile (EAS)

| Aspect | Detail |
|--------|--------|
| **Provider** | Expo Application Services (EAS) |
| **Build** | EAS Build for iOS & Android |
| **Updates** | EAS Update for OTA updates |
| **Distribution** | App Store & Google Play |

### CI/CD (GitHub Actions)

| Check | Details |
|-------|---------|
| **Backend** | Python compile check, config validation, security settings |
| **Frontend** | `npm ci`, TypeScript type checking, Expo config validation |

### Local Development

```bash
docker-compose up          # PostgreSQL + pgvector
cd backend && python -m uvicorn app.main:app --reload
cd frontend && npx expo start
```

### Notification Scheduler

Two modes:
1. **On-instance**: Background scheduler when `RUN_NOTIFICATION_SCHEDULER=true`
2. **External cron**: Supabase Cron → `POST /api/internal/notification-run` with shared secret

---

## 7. SECURITY CONSIDERATIONS

### Authentication

| Mechanism | Detail |
|-----------|--------|
| **Primary Auth** | JWT (HS256) — 30-min access tokens, 90-day refresh tokens |
| **Password Storage** | bcrypt hashing |
| **Social Auth** | Google OAuth 2.0 (OIDC), Apple Sign-In (JWKS) |
| **Token Refresh** | `POST /api/auth/refresh` |
| **Credential Storage** | expo-secure-store on device |

### Authorization

| Mechanism | Detail |
|-----------|--------|
| **Model** | Role-based (free vs premium user) |
| **Enforcement** | `require_premium_user` FastAPI dependency |
| **Premium Check** | RevenueCat entitlements + local subscription status |
| **Paywall Response** | 402 Payment Required |

### Security Headers & Middleware

- **CORS**: Configurable allowed origins (`CORS_ALLOWED_ORIGINS`)
- **Rate Limiting**: 120 req/min default, 20 req/min for auth endpoints
- **Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS (production)
- **Request Tracking**: Unique request ID per request

### Data Protection

- Environment variables for all secrets (37 env vars)
- Signed URLs for image storage (time-limited access)
- Internal endpoints protected by shared secret

---

## 8. DEVELOPMENT & TESTING

### Local Setup

```bash
# Backend
cd backend
cp .env.example .env              # Configure environment
docker-compose up -d              # Start PostgreSQL + pgvector
pip install -r requirements.txt
alembic upgrade head              # Run migrations
python -m uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npx expo start                    # Start Expo dev server
```

### Testing

**Backend Tests** (pytest, 8 files):
- `test_auth_password_reset.py` — Password reset flow
- `test_billing_service.py` — RevenueCat entitlements
- `test_paywall_enforcement.py` — Premium access control
- `test_notifications_e2e.py` — End-to-end notifications
- `test_personalized_mes_audit.py` — MES scoring accuracy
- `test_meal_scan_guidance.py` — Meal scan pipeline
- `test_metabolic_engine_targets.py` — MES calculations
- `test_recipe_detail_composition.py` — Multi-component meals

**Frontend Checks**:
- TypeScript type checking (`npm run typecheck`)
- Expo config validation

---

## 9. FUTURE CONSIDERATIONS

### Known Technical Debt
- CI does not run the pytest suite automatically (compile-only checks)
- Rate limiting is in-process (not distributed) — needs Redis for multi-instance
- Notification scheduler has two modes that could be unified
- Some `__pycache__` files tracked in git

### Planned Features / Roadmap
- MES system deeper integration into all UI surfaces
- Recipe quality gates based on fuel/MES scores
- Meal plan projection and weekly optimization
- Enhanced gamification (leaderboards, social features)

---

## 10. GLOSSARY

| Term | Definition |
|------|-----------|
| **MES** | Metabolic Energy Score — protein-primary scoring with fiber floor & sugar ceiling, scored per meal |
| **Fuel Score** | Whole food quality score (0–100) based on ingredient analysis (seed oils, additives, refined flour) |
| **Healthify** | AI agent that transforms recipes to be healthier by swapping ingredients |
| **Chronometer** | Food logging feature — tracks meals, macros, and micronutrients |
| **Flex Meals** | Earned "flexible" meals based on consistent healthy eating scores |
| **LangGraph** | Framework for building multi-step AI agent workflows |
| **pgvector** | PostgreSQL extension for vector similarity search (used for recipe semantic search) |
| **RevenueCat** | Third-party service managing in-app subscriptions and entitlements |
| **EAS** | Expo Application Services — build, submit, and update React Native apps |
| **Fuel Target** | User's weekly goal for whole-food quality percentage |

---

## 11. PROJECT IDENTIFICATION

| Field | Value |
|-------|-------|
| **Project Name** | Fuel Good |
| **Stack** | React Native (Expo) + FastAPI + PostgreSQL |
| **Primary Contact** | Araf Rahman |
| **Last Updated** | 2026-03-18 |
