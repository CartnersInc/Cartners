# Cartners — shared household shopping

DubHacks 2026 concept: help families, roommates, and other shared households decide dinner, keep one shopping list, and know who is picking things up. Parties and other shared household purchases can use the same list.

**Live demo:** [Open Cartners](https://cartnersinc.github.io/Cartners/) — the frontend deploys from `main`. The live AI and shared data need the separate backend described in [demo hosting](docs/DEMO_HOSTING.md).

## Team development

**[Start here: copy your AI prompt and begin your assigned work](docs/START_HERE.md).** [Team guide: owners, branches, and workflow](docs/TEAM.md). The React frontend foundation is in `frontend/`; the PRD and API fixtures define the shared integration. `demo/` remains the earlier visual baseline.

## Run the React frontend

The full local demo uses two terminals. Start the backend first:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then start the frontend in another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Without the backend, the frontend shows labeled sample previews. Add provider keys to `backend/.env` for live Gemini and Kroger access; never commit that file. See [frontend setup and integration](frontend/README.md) for more detail.

## Run the earlier demo

Install Python 3 and Node.js 20 or newer. No package installation or build is needed.

```sh
python3 -m http.server 4173 --directory demo/dist
```

Open http://localhost:4173. For Windows, use `py -m http.server 4173 --directory demo/dist`.

```sh
cd demo
npm test
```

## What is here

- `frontend/`: React/Vite shell, AI-first Home, Plans/preferences, API helper, and focused checks.
- `demo/dist/`: original HTML/CSS/JavaScript visual reference, photos, and local sample data.
- `demo/test/`: tests for money splits, repayment state, and ingredient deduplication.
- [Final-brainstorm PRD v2](docs/PRD.md): AI-first flow, all five page areas, build priorities, owners, and acceptance checks.
- [Final brainstorm source](docs/FINAL_BRAINSTORM.md): the team’s requirements and their scope mapping.
- [API contract v2 and fixtures](docs/API_CONTRACT.md): frontend/backend integration agreement.
- [Baseline UX review](docs/UX_REVIEW.md): the original prototype findings; the new PRD takes precedence.
- [Contribution guide](CONTRIBUTING.md): how the four teammates can work together.

The React frontend is the start of the shared application. The team is implementing Python/FastAPI, SQL persistence, and provider services separately. The original demo is retained as a visual reference.

## Earlier demo limits

Changes stay in each browser's localStorage. There is no login, shared backend, cross-device collaboration, live AI, real store prices/inventory, linked memberships, or payment transfer. Photo suggestions are explicitly simulated. Selecting a photo does not upload or analyze it. All people, votes, prices, and purchases are examples.

The person selector lets you try the four sample roommates. Household contains a reset button. The existing flow is intentionally preserved as the review baseline; the PRD specifies the proposed simpler next version.

Food photos are illustrative Unsplash images; each asset includes its source URL in an adjacent JSON file and its JPEG metadata. Typeface: Manrope through Google Fonts, with a local sans-serif fallback. API keys must stay in a future backend, never in frontend code or Git commits.
