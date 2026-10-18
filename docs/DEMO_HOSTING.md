# Cartners demo hosting

## Current setup

- **Frontend:** GitHub Pages at <https://cartnersinc.github.io/Cartners/>. The `main` branch workflow tests and publishes `frontend/`.
- **Backend:** not deployed yet. The frontend therefore uses its labeled sample/offline behavior on the public site; live Gemini, Kroger lookups, and shared saved changes are not connected.
- **Photon agent:** implemented as a separate Node service in `photon-agent/`, but not deployed. It needs the shared backend URL, Photon credentials, a configured channel, and an allowed-sender-to-household mapping.
- **Local full demo:** FastAPI at `http://127.0.0.1:8000` and React at `http://127.0.0.1:5173`. Start the backend and frontend in separate terminals using the root README.

The old `xaviergorriti.github.io` link is retired. GitHub Pages is configured for the `CartnersInc/Cartners` repository, so the correct public URL is `https://cartnersinc.github.io/Cartners/`.

## Deploy the API on Render

The repository includes a `render.yaml` Blueprint for a free FastAPI service. After this file is merged to `main`:

1. In Render, choose **New → Blueprint**, connect `CartnersInc/Cartners`, and deploy the `main` branch.
2. In the service environment, enter `GEMINI_API_KEY`, `KROGER_CLIENT_ID`, and `KROGER_CLIENT_SECRET` if those integrations are needed. GitHub Actions secrets do not automatically become Render environment variables. Never add provider keys to the frontend or commit them.
3. Confirm the service's `/api/health` endpoint returns JSON.
4. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and set `VITE_API_BASE_URL` to the Render service origin, for example `https://cartners-api.onrender.com` (no trailing slash and no `/api`).
5. Rerun **Publish Cartners demo** in Actions so the frontend is rebuilt with that API address. Confirm `/api/health` is reachable from the deployed site and check browser Network errors if it is not.

The Blueprint uses Render's free web-service plan for a no-cost demo. Free services can sleep after 15 minutes without traffic and take about a minute to wake. Their filesystem is temporary, so SQLite changes can be lost when the service sleeps, restarts, or deploys. This is suitable for a hackathon preview, not durable shared household data. Persistent SQLite storage requires a paid service with a disk; alternatively, migrate the backend to a managed database before treating data as durable.

## Local provider keys

For local development, copy `backend/.env.example` to `backend/.env` and add provider keys there. The backend reads that file. Keep it untracked. Frontend variables must never contain provider secrets.
