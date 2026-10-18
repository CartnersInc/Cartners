# Gemini recipe suggestions

The suggestion service defaults to `gemini-3.5-flash-lite` with schema-constrained JSON and server-side validation. Free-tier access has limits and may change; prompts may be used to improve Google's products, so use fictional demo data rather than private household details.

Get a key in [Google AI Studio](https://aistudio.google.com/apikey), then copy the example and add the key locally (never paste it into chat or commit it):

```sh
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run the Vite app in a second terminal with `cd frontend && npm run dev`, then open `http://127.0.0.1:5173`. The static hosted preview cannot reach a local-only backend.

The local Home screen calls `POST /api/ai/suggestions` when the shared backend is offline. This returns a live AI recipe preview, but deliberately cannot save to the sample cart. The endpoint does not replace Xavier's `POST /api/suggestions` route or implement cart matching, persistence, confirmation, or Undo. When Xavier's shared backend is running, Home uses its contract route instead. Do not expose the key through React/Vite or commit it.

Set `GEMINI_MODEL` to override the default model. The implementation retries temporary 429/503 capacity errors and caps each call at 25 seconds.

## Kroger product lookup

Add `KROGER_CLIENT_ID` and `KROGER_CLIENT_SECRET` to the same local `.env` file. Create app credentials at [Kroger Developer](https://developer.kroger.com/), then try the provider from `backend/` with `python krogerapitest.py --zip 98105 milk "black beans" tortillas`. It finds one nearby Kroger-family store and returns product options with the prices Kroger provides. This is not yet connected to `POST /api/baskets/compare`, does not compare other retailers, and does not guarantee stock or a complete basket.
