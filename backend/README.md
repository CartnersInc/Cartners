# Gemini recipe suggestions

The suggestion service uses `gemini-3.8-flash` with schema-constrained JSON and server-side validation. Google currently lists text input and output for this model as free on its Gemini API Free tier. Free access has limits and may change; free-tier prompts may be used to improve Google's products, so use fictional demo data rather than private household details.

Get a key in [Google AI Studio](https://aistudio.google.com/apikey), then set it only in the backend environment:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY='your-key'
```

The provider function is ready for Xavier's `POST /api/suggestions` route. It returns validated AI content (`recommendation` or `clarification`); the route still needs to add draft/workspace IDs, current list preview, and revision data per `docs/API_CONTRACT.md`. Do not expose the key through React/Vite or commit it.

Set `GEMINI_MODEL` to override the default model. The implementation retries temporary 429/503 capacity errors and caps each call at 25 seconds.
