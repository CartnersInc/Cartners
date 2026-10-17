# P0 API contract

Companion to [PRD.md](PRD.md). Freeze these names with the four teammates in the first hour. These are proposed interfaces and example payloads, not implemented endpoints. The existing static demo does not call them.

## Shared conventions

Base URL: configured by `VITE_API_BASE_URL` on the client. Backend owns the single fictional demo workspace. JSON uses camelCase. IDs are opaque strings; timestamps are UTC ISO 8601. Use parameterized SQL and validate requests with FastAPI/Pydantic.

Every write carries a client-generated UUID `requestId`. Keep that ID when retrying the same action. Record successful action IDs and change summaries for the demo session. Replay returns the same action metadata without repeating the mutation, alongside a fresh workspace snapshot so the UI cannot replace newer shared state with an old response. Reusing an ID for a different body returns 409. Rejected validation/conflict requests do not reserve the ID. For AI generation, disable repeated submission while pending and reuse a completed result rather than paying again on navigation; do not promise an interrupted provider call can never incur a second charge.

Actor IDs identify fictional attribution only. They are not credentials or authorization. Do not use this prototype contract for private household data.

## Routes

| Method / path | Request | Response / responsibility |
| --- | --- | --- |
| GET `/api/health` | None | `{status:"ok"}`; no provider secrets. |
| GET `/api/workspace` | None | Full snapshot shaped like `fixtures/workspace.json`. Poll every 3 seconds while visible. |
| PATCH `/api/preferences` | `requestId`, `servings`, `restrictions`, `likes`, `maxPrepMinutes` | Updated snapshot. Only explicit settings; no inferred habits. |
| POST `/api/suggestions` | JSON: `requestId`, `message` (1–500 characters), optional `previousDraftId`. A follow-up includes the previous server-stored draft. Backend uses saved preferences and preserves unchanged meal context. | Validated recommendation shaped like `fixtures/suggestions.json`, or one clarification shaped like `fixtures/clarification.json`. Store the draft; no list mutation. |
| GET `/api/suggestions/{draftId}` | None | Stored draft, including `previousDraftId`; no model call. |
| POST `/api/meals/confirm` | `requestId`, `draftId`, `actorId`, `expectedListRevision`, `excludeIngredientIds` | Atomic chosen meal + list changes; `{workspace,actionId,changeSummary}`. Never accept arbitrary model instructions as database commands. |
| POST `/api/actions/{actionId}/undo` | `requestId`, `actorId` | `{workspace,undoneItemIds,retainedItemIds,message}`. Undo only eligible changes from that addition. |
| POST `/api/items` | `requestId`, `actorId`, `name`; optional `quantity`=1, `unit`="count", `note`="", `requestFor`="household" | `{workspace,itemId}`. Clear exact duplicate: return existing item and `duplicate:true`; offer an explicit quantity change instead of silently adding another. |
| PATCH `/api/items/{itemId}` | `requestId`, `actorId`, `expectedItemVersion`; editable name/quantity/unit/note/requestFor or `bought`/`removed` | Updated snapshot. Bought is a list status, never an expense. A stale item returns its current version for correction. |
| PATCH `/api/trip` | `requestId`, `actorId`, `expectedTripVersion`, `action`="claim" / "release" / "finish" | Updated snapshot. Claim uses an atomic compare-and-set; only current shopper releases/finishes. Finish records checked items and leaves unchecked ones. |

Return the server snapshot after every successful write so both frontend owners use the same data. A global `listRevision` protects a meal confirmation preview; each item has its own `version` for ordinary edits, and trip actions use `trip.version`. Trip-only changes must not invalidate a meal preview.

## Snapshot shape

`workspace.json` contains `workspaceId`, `listRevision`, `preferences`, `actors`, `currentMeal`, `discoveryDraftId`, `items`, and `trip`. Its referenced draft is returned by GET `/api/suggestions/{draftId}` to restore a conversation or its immediately preceding version without another model call.

An item has `id`, `name`, numeric positive `quantity`, `unit`, optional `note`, `requestFor`, `addedBy`, `bought`, `removed` (default false), `version`, and `createdAt`. Omit removed rows from the active list. `requestFor` is `household` or a fictional actor ID; it marks a request and does not define a debt. An active trip contains `claimedBy`, `claimedAt`, and `claimedItemIds` captured at claim time. New unchecked IDs outside that snapshot receive an Added after trip started badge. Completed trips retain their bought item IDs in history; a subsequent claim starts another trip.

Meal bodies remain validated JSON. A chosen meal stores the recipe, servings, confirming actor, and its list-add action ID. The client renders that state after refresh instead of keeping the only copy of a selected recipe locally.

## Draft and AI boundary

`suggestions.json` is a normal initial response; `refinement.json` shows a faster revision with servings and restriction context retained. `clarification.json` shows the alternate success shape for a blocking contradiction. `kind` is `recommendation`, with exactly one `recommendation` object, or `clarification`, with exactly one `question` and no recommendation/list changes. Both include `draftId` and optional `previousDraftId` so a reply can retain context. A clarification draft cannot be confirmed as a meal.

A recommendation has 1–20 ingredients, 1–10 cooking steps, serving count 1–12, approximate preparation time 1–240 minutes, fit explanation, uncertainty text, and an interpreted request summary. Input messages are limited to 500 characters. Keep preference fields short and bounded. A refinement includes the prior recommendation and accumulated interpreted requirements as context; retain servings and restrictions unless the user clearly changes an allowed value. Do not silently overwrite saved household settings from a one-off meal message.

The AI supplies recipe content or a focused clarification. FastAPI supplies IDs, `sourceMode`, list previews, and state changes. `sourceMode` is `live_ai` or `sample`. A fallback retains its sample label throughout review. Another idea sends a normal follow-up message with `previousDraftId`; no separate agent service is needed. Restoring a draft never calls the model. Do not generate on a blank page load.

Do not ask the model for merchant prices. `costStatus` is `unverified`; a stated budget may influence ingredient suggestions but cannot establish an exact cost. Expose the interpreted servings, time target, and relevant restrictions in the answer. A message such as “make it for six” changes the proposed recipe quantities and preview before confirmation, not the shared household defaults.

Validate declared restrictions against returned ingredients. Obvious conflicts are rejected; unclear packaged ingredients get a specific label-check warning. This is not comprehensive allergen detection. If requirements genuinely conflict, return one clarification rather than silently dropping a restriction. For “I don’t know,” use the visible defaults and recommend something; lack of a cuisine preference is not a blocking ambiguity.

`listPreview` is computed from the current list after validating the recipe:

- `add`: no compatible current request exists.
- `increase`: same normalized name, supported unit, note, and request scope, but existing quantity is less than this meal requires. Add only the shortfall, not a second full quantity.
- `keep`: the compatible request already meets this meal's requirement.
- `review`: quantities or constraints are ambiguous. Keep distinct variants separate and show why; do not silently merge them. Confirmation may add a distinct clearly labeled row after it is shown in the preview.

Only outstanding, unbought, unremoved requests are eligible for list matching. A purchased item in trip history is not proof of stock at home.

Only compare identical supported units in P0: count, g, ml, can, pack. Do not invent conversions between a pack and grams. This build handles one current dinner, not aggregate demand across a week of meals. Excluding an ingredient leaves pre-existing requests unchanged. Manually marking Already have means exclude from this addition, not delete it from someone else's list.

## Concurrency, retry, and Undo

Confirmation checks `expectedListRevision` in one SQL transaction, applies the confirmed deltas, records the chosen meal and replay/Undo data, then increments `listRevision`. A transport retry cannot add the same batch twice. Disabling the button is useful but insufficient.

A 409 `LIST_CHANGED` includes a fresh `workspace` and updated `listPreview`; highlight changes and let the user confirm again without another AI call. Never discard the user's exclusions. A 409 `TRIP_CLAIMED` includes the current trip; show the existing shopper, not a generic error. Preserve item input on failed writes.

Undo records created rows and before/after quantities/versions. Delete or restore only rows still matching this action's after-state and not bought. Retain rows changed by someone else and return a clear partial-Undo explanation. Do not undo subsequent edits or delete pre-existing requests. Keep the Undo entry accessible with the chosen meal after a toast disappears. A complete Undo clears that chosen meal; a partial Undo keeps it with a Partially undone status and lists retained changes. Record which deltas were reversed so another click cannot reverse them twice.

## Errors

Use `{error:{code,message,retryable,requestId}}`, with a fresh snapshot/preview where relevant. Use 400/422 for bad input, 409 for conflicts, 429 for provider capacity, and 503 for provider/backend unavailability. Do not return stack traces or raw provider errors to the UI.

At 25 seconds, end the AI wait and return a recoverable timeout. The screen offers retry, direct list entry, and labeled sample ideas. Log only request ID, duration, outcome, and validation result; no raw prompt content. Image upload is outside P0; do not implement multipart handlers or image storage for this build.

## First contract check together

A and B render the supplied JSON without calling the model. C returns the workspace fixture from the real route, then makes add/claim update shared state. D returns a real recommendation and then a contextual revision using the same endpoint. Also render the one-question clarification fixture. The team compares keys and failure states before implementing optional features. Frontend mocks and live responses must keep the same shape.
