# Cartners frontend

React/Vite foundation for Ibrahiim's issues #3 and #7. The original `demo/` remains untouched.

## Run

Requires Node 20.19+ or 22.12+ ([Vite requirements](https://vite.dev/guide/)).

```sh
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. By default Vite proxies `/api` to http://127.0.0.1:8000. For Xavier's shared server, copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL` to the backend origin, and restart Vite. The backend must allow the frontend origin through CORS. At deployment, set that origin at build time or serve `/api` from the same origin; the Vite proxy is development-only. Never put a provider key in a VITE variable.

When no backend is reachable, the app previews checked-in fixtures. Starter buttons show clearly labeled fixed examples while offline; connected starters and Make it quicker call AI immediately. Enter submits a request, and Shift+Enter adds a line. Dates/preferences and detailed ingredient edits expand only when needed. Sample buttons show fixed meal/grocery/clarification responses; they do not interpret arbitrary input, mutate a cart, generate debt, or claim live AI. Backend reads resume while the page is visible. A failed read after connection preserves the last snapshot and disables Home writes until reconnected.

## Integration

The feature/API interface is published in [issue #3](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/3#issuecomment-6243420044).

- Suyash adds default exports at `src/features/shopping/Shopping.jsx`, `src/features/groups/Groups.jsx`, and `src/features/spending/Spending.jsx`. The shell discovers those modules without editing App.jsx. Until present, navigation shows an honest handoff placeholder.
- Props: `{workspace, actorId, api, onWorkspaceChange, navigate, notify}` plus `connected`. When connected is false, disable writes. Pass `onWorkspaceChange(serverResponse.workspace)` after a committed write.
- `api.request('/api/...', {method, body, signal})` returns JSON and throws errors with `status`, `code`, `payload`. Include workspaceId/actorId/requestId in writes. Generate the request ID once and reuse it on retry. The client never retries automatically or fabricates successful writes.
- The shell owns group/actor, visible-tab three-second polling, stale status, and navigation. Features own form state, not another snapshot poller.
- Home accepts direct v2 draft responses; confirmation/Undo use the response envelope. It retains input, drafts, exclusions, pending confirmation IDs, and saved Undo metadata in sessionStorage by group. These fictional examples are not private production storage.
- Plans receives `onPlanDateChange(date)` so an empty date returns to Home without an event form.

## Featured recipe feed

Home requests `GET /api/discovery/featured?workspaceId=...` when the Home area is visible and the backend is connected. It expects `{items:[{id,title,cuisine,thumbnailUrl,sourceUrl,sourceName,sourceType,prompt}]}`. Return up to eight items; `sourceType` is `video` or `article`. The frontend checks that media URLs use HTTPS, shows the source link, and sends `prompt` through the existing suggestion route when someone chooses **Make this tonight**. The carousel advances every seven seconds, stops while hovered/focused, and starts paused for reduced-motion preference. It does not autoplay media. Cache provider lookups in the API so opening Home does not repeatedly search YouTube or other sources.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

With Chrome installed, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` uses it instead. Browser checks use intercepted test API responses; they do not prove Xavier's backend or Ethan's live provider is connected. Real integration still needs two browsers pointed at one backend.

Photo: unchanged copy of the original illustrative Unsplash taco asset; provenance is adjacent in `public/assets/tacos.jpg.json`.

## Shared demo and deployment

[Open the public frontend preview](https://common-table-household-demo.crisp-tide-4075.chatgpt.site). This Sites publication is a snapshot of `ibrahiim/dinner-ui`; it requires republishing after changes. The GitHub Pages workflow in this branch will publish merged frontend changes automatically after Xavier enables Pages. See [owner setup and backend connection](../docs/DEMO_HOSTING.md).
