# Common — shared household shopping

DubHacks 2026 concept: help families, roommates, and other shared households decide dinner, keep one shopping list, and know who is picking things up. Parties and other shared household purchases can use the same list.

## Team development

**[Start here: copy your AI prompt and begin your assigned work](docs/START_HERE.md).** [Team guide: owners, branches, and workflow](docs/TEAM.md). The AI-first PRD and API fixtures describe the new app; `demo/` remains the earlier visual baseline.

## Run the demo

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

- `demo/dist/`: runnable HTML/CSS/JavaScript interface, photos, and local sample data.
- `demo/test/`: tests for money splits, repayment state, and ingredient deduplication.
- [Final-brainstorm PRD v2](docs/PRD.md): AI-first flow, all five page areas, build priorities, owners, and acceptance checks.
- [Final brainstorm source](docs/FINAL_BRAINSTORM.md): the team’s requirements and their scope mapping.
- [API contract v2 and fixtures](docs/API_CONTRACT.md): frontend/backend integration agreement.
- [Baseline UX review](docs/UX_REVIEW.md): the original prototype findings; the new PRD takes precedence.
- [Contribution guide](CONTRIBUTING.md): how the four teammates can work together.

This is a design prototype, not the production React/Vite application. The intended production stack is React/Vite + Python/FastAPI + SQL. Use the demo to agree on interactions before porting them.

## Limits

Changes stay in each browser's localStorage. There is no login, shared backend, cross-device collaboration, live AI, real store prices/inventory, linked memberships, or payment transfer. Photo suggestions are explicitly simulated. Selecting a photo does not upload or analyze it. All people, votes, prices, and purchases are examples.

The person selector lets you try the four sample roommates. Household contains a reset button. The existing flow is intentionally preserved as the review baseline; the PRD specifies the proposed simpler next version.

Food photos are illustrative Unsplash images; each asset includes its source URL in an adjacent JSON file and its JPEG metadata. Typeface: Manrope through Google Fonts, with a local sans-serif fallback. API keys must stay in a future backend, never in frontend code or Git commits.
