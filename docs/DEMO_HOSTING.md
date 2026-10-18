# Cartners demo hosting

## Current setup

- **Frontend:** GitHub Pages at <https://cartnersinc.github.io/Cartners/>. The `main` branch workflow tests and publishes `frontend/`. `VITE_API_BASE_URL` is `https://cartners-api.onrender.com`.
- **Backend:** Render web service `cartners-api` at <https://cartners-api.onrender.com>. `GET /api/health` is live. Household create/join was added in PR #44 (`POST /api/households`). If that route 404s, the service is still running an older commit. Health should include `"households": true` after a current deploy.
- **Why Render lags `main`:** Auto-deploy only works when the service is connected through Render’s GitHub app. A service created from a public repository URL must be deployed manually (or by its deploy hook). `autoDeployTrigger: commit` in `render.yaml` cannot turn that on by itself. PR #45 recorded this; it is already merged.
- **Photon agent:** implemented as a separate Node service in `photon-agent/`, but not deployed. It needs the shared backend URL, Photon credentials, a configured channel, and an allowed-sender-to-household mapping.
- **Local full demo:** FastAPI at `http://127.0.0.1:8000` and React at `http://127.0.0.1:5173`. Start the backend and frontend in separate terminals using the root README.

The old `xaviergorriti.github.io` link is retired. GitHub Pages is configured for the `CartnersInc/Cartners` repository, so the correct public URL is `https://cartnersinc.github.io/Cartners/`.

## Deploy the API on Render

The repository includes a `render.yaml` Blueprint for a free FastAPI service.

1. Preferred: connect `CartnersInc/Cartners` in the Render dashboard so pushes to `main` deploy. Then **Manual Deploy → Deploy latest commit** once to catch up.
2. Authorized CI: copy the service **Deploy Hook** URL into the GitHub Actions secret `RENDER_DEPLOY_HOOK_URL` (never commit it). The **Deploy Cartners API** workflow curls that hook after backend tests and waits until `/api/health` reports `"households": true`.
3. In the service environment, enter `GEMINI_API_KEY`, `KROGER_CLIENT_ID`, and `KROGER_CLIENT_SECRET` if those integrations are needed. GitHub Actions secrets do not automatically become Render environment variables. Never add provider keys to the frontend or commit them.
4. Confirm `/api/health` includes `"households": true` and that `POST /api/households` is not a FastAPI `{"detail":"Not Found"}`.
5. GitHub variable `VITE_API_BASE_URL` should remain the Render origin, for example `https://cartners-api.onrender.com` (no trailing slash and no `/api`).

The Blueprint uses Render’s free web-service plan for a no-cost demo. Free services can sleep after 15 minutes without traffic and take about a minute to wake. **Their filesystem is temporary: SQLite household memberships, carts, and receipts can disappear when the service sleeps, restarts, or redeploys.** This is a hackathon preview, not durable household data. Persistent SQLite needs a paid disk; a managed database is the durable alternative.

## Local provider keys

For local development, copy `backend/.env.example` to `backend/.env` and add provider keys there. The backend reads that file. Keep it untracked. Frontend variables must never contain provider secrets.
