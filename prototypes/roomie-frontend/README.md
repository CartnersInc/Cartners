# Roomie frontend: list, trips, groups, and spending

React (Vite, JavaScript) frontend for the shared grocery list, store runs, group switching, and the Spending page. It runs on sample data in the browser until the real backend is connected.

## Run it

```bash
npm install
npm run dev        # sample data, no backend needed
npm run dev:api    # real server; Vite forwards /api to http://localhost:8000
```

**Two roommates on one computer:** open the app in two tabs and pick a different person in each tab's top bar. The sample data is shared through `localStorage`, and each tab polls it like a phone polling the server.

The dark bar at the top (`src/main.jsx`) is a dev harness, not part of the app. It sets who the tab is and can simulate going offline, a save that never arrives, a save whose reply is lost, losing a simultaneous "Start trip", and a server clock that's ahead of the device. "Reset sample data" resets every tab.

## Layout

| Path | What it is |
|---|---|
| `src/App.jsx` | Group switcher, members, sync status, run banner, List and Spending tabs |
| `src/list/` | Add item, item rows (Bought checkbox and Details), trip panel, list page |
| `src/groups/` | Sync status bar and the in-app run banner |
| `src/spending/` | Spending page (receipts, balances, Venmo/PayPal links) |
| `src/lib/api.js` | API client. Idempotency keys, `X-Member-Id`, error handling |
| `src/lib/useSnapshot.js` | Shared snapshot polling and server clock offset |
| `src/lib/useIdempotentWrite.js` | Safe retries for every write |
| `src/mock/` | Sample data and a stand-in server (not used with `dev:api`) |
| `tests/browser_checks.py` | Two-tab browser checks used for the PR |

## Behavior

**List and trips**
- Add an item with just a name; quantity starts at 1. Note, store, and date are optional under Details.
- Each item has a large Bought checkbox, its quantity and note, and a Details button for edits.
- One trip action: "I'm going to [store]. Want anything in the next [10] minutes?" The store defaults to the group's last destination; the window can be none, 5, 10, or 15 minutes. Starting claims every unbought item.
- Items added before the window closes join the trip. Items added after stay under "For the next trip". The shopper sees new requests marked "New since you started".
- If the store doesn't carry an item or is out of it, the shopper taps **Not here** to punt it to the next trip. It leaves the current trip right away (roommates see "Not at QFC, moved to the next trip"), the shopper can **Put back** while the trip is still going, and the next trip claims it like any other unbought item, labeled "Not found at QFC last time".
- Finish trip asks for no prices. Unchecked items go back on the list for the next trip.
- An existing shopper is never replaced. If two people start at once, the loser sees who actually started and when.

**Sync**
- Every tab polls `GET /snapshot` every 3 seconds, and again on focus or reconnect. The run banner and countdown come from that snapshot.
- Countdowns use the server's `closes_at` and `server_time`, corrected for the device clock, not a timer started in the browser.
- The status bar shows up to date, stale (no update for 10+ seconds), offline, and how many saves are in flight.
- Failed writes keep what you typed. After an uncertain failure the form locks, offering only "Try again" (same idempotency key) or "Discard".
- Edit conflicts (409) show the other person's version and let you keep theirs or save yours.

**Groups**
- Switch between groups; members are shown for the current group. Switching never shows the previous group's list, trip, or balances, and late responses for the old group are ignored.

**Spending** is described in the API section below.

## API contract

All requests send `X-Member-Id` (who is using the app). All writes send `Idempotency-Key`. Money is in integer cents.

> **Check with Ibrahiim:** the snapshot shape below is what this frontend expects. If the agreed format differs, only `src/lib/api.js` (and the mock) should need changing.

### Groups and snapshot

`GET /api/groups` returns `{ "groups": [{ "id", "name", "member_count" }] }`, only groups the member belongs to.

`GET /api/groups/{groupId}/snapshot` returns:

```json
{
  "server_time": "2026-10-17T17:30:00Z",
  "group": { "id": "g_4b", "name": "Unit 4B" },
  "members": [{ "id": "m_alex", "name": "Alex", "pay_links": { "venmo": "https://venmo.com/u/alex" } }],
  "items": [{
    "id": "it_1", "name": "Oat milk", "quantity": 2, "note": "Unsweetened", "store": null, "needed_by": null,
    "requested_by": "m_sam", "created_at": "…", "status": "open", "run_id": "run_1",
    "bought_by": null, "bought_at": null, "punted": null, "version": 3
  }],
  "run": {
    "id": "run_1", "shopper_id": "m_alex", "store": "QFC", "window_minutes": 10,
    "started_at": "…", "closes_at": "…", "status": "active", "finished_at": null
  },
  "last_store": "QFC"
}
```

`run` is `null` when nobody is shopping. `status` is `open` or `bought`.

`punted` is `null`, or `{ "by", "at", "store", "run_id" }` when a shopper moved the item off a trip because the store didn't have it. It stays set (so the next shopper sees "Not found at QFC last time") until the item is bought.

### Writes

| Request | Body | Success | Errors the page handles |
|---|---|---|---|
| `POST /api/groups/{g}/items` | `{ name, quantity?, note?, store?, needed_by? }` | `{ item }`. The server sets `run_id` if the trip window is still open. | 422 |
| `PATCH /api/groups/{g}/items/{id}` | `{ version, changes: { bought?, punted?, quantity?, note?, store?, needed_by? } }` | `{ item }` with `version` + 1. `punted: true` sets `run_id: null` and records `punted`; `punted: false` puts it back on the same active trip. Buying clears `punted`. | 409 `{ error, item }` when `version` is out of date; 403 if a non-shopper punts; 422 if the item isn't open on the active trip |
| `POST /api/groups/{g}/runs` | `{ store, window_minutes }` (0, 5, 10, 15) | `{ run, claimed_count }`. Claims open items with no `run_id`. | 409 `{ error, run }` if a trip is already active |
| `POST /api/groups/{g}/runs/{runId}/finish` | `{}` | `{ run, kept_count, bought_count }`. Open items on the trip get `run_id: null`. | 403 if not the shopper, 409 if already finished |
| `GET /api/groups/{g}/spending` | | See `src/mock/sampleSpending.json` | |
| `POST /api/groups/{g}/expenses` | `{ store, run_id, total_cents, payer_id, mode, participant_ids, exceptions }` | `{ expense, balances }` | 422 |
| `POST /api/groups/{g}/payments` | `{ from_member_id, to_member_id, amount_cents, method }` | `{ payment, balances }` | 422 |

### Status codes

| Code | Meaning |
|---|---|
| `201` | Created |
| `200` on a write | Replay: same key and same body as before. Return the original response; don't create anything. |
| `409` | Conflict. Include the current `item` or `run` so the page can show what happened. |
| `422` | Validation error. Body `{ "error": "Message to show" }` |
| `5xx`, `429`, or no response | Shown as retryable; the page resends with the same key. |

### Spending rules

- Split receipts: each personal exception goes to its member; the rest is shared evenly among participants; leftover cents go to the payer (or the first participant if the payer isn't one).
- Pooled receipts and receipts with an unknown exception amount (`amount_cents: null`, status `needs_review`) get no allocations and never affect balances.
- The page only displays `allocations` and `balances` from the server. Reference implementation: `src/mock/mockServer.js`.
