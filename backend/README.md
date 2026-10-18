# Cartners backend

Shared FastAPI + SQLite API for the household demo. Xavier owns routes, models, persistence, and money rules. Ethan owns provider helpers under `app/services/`.

## Domain shapes

**Recipes (main search / meal drafts)** — `ingredients` + `steps` inside a recommendation draft.

**Plans** — Event, Date, Plan. Seeded example: Movie Night on `2026-10-17` with a snack-board recipe body.

**Ingredients (Kroger-shaped catalog)** — `id`, `name`, `description`, `priceCents` (plus package size). Used by `GET /api/ingredients` and sample/live basket compare.

## Setup

```sh
cd backend
cp .env.example .env
# Optional: GEMINI_API_KEY, KROGER_CLIENT_ID, KROGER_CLIENT_SECRET
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API base URL for local Vite: proxied at `/api` → `http://127.0.0.1:8000` (see `frontend/vite.config.js`).  
For a shared host, set `VITE_API_BASE_URL` on the frontend and `CORS_ORIGINS` here (comma-separated).

Health check: `GET http://127.0.0.1:8000/api/health`  
Workspace snapshot: `GET http://127.0.0.1:8000/api/workspace?workspaceId=demo-family`

SQLite file defaults to `backend/data/cartners.db`. Override with `CARTNERS_DB_PATH`.

## Contract routes

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| GET | `/api/workspace` | Group-scoped snapshot (`schemaVersion: 2`) |
| PATCH | `/api/preferences` | Servings, restrictions, likes, spending mode |
| POST | `/api/suggestions` | Meal/grocery draft (live Gemini or labeled sample) |
| GET | `/api/suggestions/{draftId}` | Restore draft + refresh list preview |
| POST | `/api/drafts/confirm` | Save plan + cart changes |
| POST | `/api/actions/{actionId}/undo` | Safe undo |
| POST | `/api/items` | Direct cart add |
| PATCH | `/api/items/{itemId}` | Edit / bought / removed |
| PATCH | `/api/trip` | Start / release / finish store run |
| POST | `/api/expenses` | Pooled or split receipt |
| POST | `/api/baskets/compare` | Sample or live Kroger-shaped baskets |
| GET | `/api/ingredients` | Catalog with Kroger fields |

Ethan preview routes remain at `/api/ai/*` for offline Home use when the shared backend is not connected.

## Seeded groups

- `demo-family` — pooled spending, vegetarian prefs, sample cart + Movie Night plan, active sample run
- `demo-roommates` — split spending, four members

## Tests

```sh
cd backend
python3 -m pytest tests/test_backend_foundation.py -q
```

Provider unit tests: `tests/test_gemini_suggestions.py`, `tests/test_kroger_prices.py`.
