# API contract v2 — final brainstorm

Proposed integration contract for [PRD v2](PRD.md). The static demo does not implement it. Agree on these changes before coding against v1: five page areas share one group-scoped snapshot; AI can return a meal or grocery draft; run deadlines and expenses are now specified. Examples are fictional fixtures, never live results.

## Boundaries

React owns view/form state; FastAPI owns committed group data, revision checks, AI/provider calls, run deadlines, and money calculations. Use one API base URL, one backend process, and SQLite. No per-page services, event bus, or authentication system for the judging demo.

Every write carries `workspaceId`, a known fictional `actorId`, and a client UUID `requestId`. Retry the same action with the same ID. Replays return original action metadata and a fresh snapshot; they cannot duplicate list entries, plans, runs, or expenses. Reusing an ID for a different action is a 409. Actor selection is attribution, not security. All queries must filter by workspace; real private use needs access control later.

Snapshots include `schemaVersion:2`, `workspaceId`, `serverNow`, available `groups`, `actors`, `preferences`, `listRevision`, `plans`, current draft/meal references, `items`, `trip`, `expenses`, `balances`, and recent `activity`. Poll the selected workspace every three seconds while visible, and refresh after writes. Show stale state on failed reads. Drafts and prices carry a live/sample label.

## Routes

| Route | Input beyond common write fields | Responsibility |
| --- | --- | --- |
| GET `/api/health` | None | Health only; no credentials. |
| GET `/api/workspace?workspaceId=…` | Selected group | Full group-scoped snapshot. |
| PATCH `/api/preferences` | Servings, restrictions, likes, time target; optional pooled/split mode | Validate explicit saved changes; update the group. |
| POST `/api/suggestions` | `message`, optional `previousDraftId`, optional `planDate` | Generate/refine a validated meal, grocery, or clarification draft; P1 weekly draft. No committed list/expense writes. |
| GET `/api/suggestions/{draftId}?workspaceId=…` | Draft and group | Restore a stored draft/previous version without a model call. |
| POST `/api/drafts/confirm` | `draftId`, `expectedListRevision`, optional excluded ingredient IDs, `target`; optional `requestFor` (`household` or a member ID) applied to every meal ingredient | Meal + `cart`: save its dated plan and apply visible list changes. Grocery + `cart`: apply its list changes only. P1 weekly + `plans`: save dated plans, never a week's groceries. Clarifications cannot be confirmed. |
| POST `/api/actions/{actionId}/undo` | Action ID | Reverse only this action's eligible untouched changes; preserve earlier requests and subsequent edits/buys. Return any retained changes and an explanation. |
| POST `/api/items` | Name; quantity=1, unit=count, note empty, requestFor=household by default | Add direct requests; exact duplicate returns existing row and an explicit quantity-change option. Name is the only required user-entered field. |
| PATCH `/api/items/{itemId}` | `expectedItemVersion`; editable details, bought, removed, or `punted` (shopper only) | Safe row update; do not infer any debt. |
| PATCH `/api/trip` | `expectedTripVersion`, action=start/release/finish; start includes store name and requestWindowMinutes=10 | Atomic one-shopper run per group; deadline assigned by server. Finish preserves unbought requests and requires no price. |
| POST `/api/expenses` | Run ID if applicable, totalCents, payerId, mode, sharedMemberIds, personalAllocations, status | Validate actual purchase and allocations; only confirmed split records affect balances. |
| POST `/api/ai/expense-draft` | `workspaceId`, `actorId`, `requestId`, `message`, `mode` | Extract receipt details into a review-only draft (`saved:false`); never writes an expense or calculates balances. User confirms by reviewing the form and submitting `/api/expenses`. |
| POST `/api/baskets/compare` | Selected cart item IDs and ZIP/postal code | One authorized provider if available; otherwise explicit sample/unavailable response. Rank only complete comparable baskets. |

Provider-dependent payment transfers, repayment reconciliation, real group invitations/accounts, and background push have no P0 endpoints. Group switching selects an existing seeded workspace and fetches its snapshot. Ordinary reads are not writes and do not require request IDs.

Return `{workspace,actionId,changeSummary}` after a committed write; direct add may also return `itemId,duplicate`. API v1's `/api/meals/confirm` is replaced by the unified draft confirmation in this proposal. No production callers exist in this repository yet; if a teammate has started one locally, coordinate the change before merging.

## Draft shapes and list rules

Normal meal: retain `kind:"recommendation"` and `recommendation` from the initial fixtures. Add `planDate` (today by default). Grocery: `kind:"grocery_list"`, `items`, and `listPreview`, with no recipe required. Clarification: `kind:"clarification"` and one question, with no list mutation. P1 weekly: `kind:"weekly_plan"` and exactly seven dated meal drafts; saving plans does not generate cart requests.

All drafts have IDs, workspace, previous-draft reference, sourceMode=`live_ai`/`sample`, interpreted request context, and the relevant list revision. A model supplies proposed content; the server supplies IDs, list previews, and state changes. Keep servings, explicit restrictions, and valid context across refinements. Do not persist a one-off soft preference as a household setting. Reject obvious restriction conflicts; unclear packaged ingredients get a label-check warning, not an allergy-safety guarantee.

Cap message length at 500 characters, each meal at 20 ingredients/10 steps, servings at 1–12, and grocery drafts at 30 requests. Only use supported count/g/ml/can/pack units in core matching. `requestFor` is `household` or a valid workspace actor ID for a personal request. Never merge different scope, note/brand constraints, or incompatible units. Compare only active unbought requests, not history or kitchen stock. Never reuse a quantity already committed to another saved meal; combine those needs or return review. A meal ingredient that matches a request already reserved for another saved meal, and not yet out shopping (waiting for the next run or on a run still taking requests), increases that request by the full amount instead of adding a second row. Meal ingredients match by name, unit, and scope; their notes are cooking instructions and don't block combining.

`listPreview` uses add/increase/keep/review. Its `ingredientId` references a recipe ingredient or, for a grocery draft, an entry in `items`. Increase means only the compatible quantity shortfall; review preserves ambiguous variants. Excluding an ingredient affects this addition, not another person's existing request. Confirmation checks the current list revision atomically and records deltas for safe Undo. Changed preferences/restrictions must also be revalidated before confirmation. A 409 returns the fresh snapshot/preview without another AI call.

Undo removes/restores only changes still matching the action's after-state and not bought. A complete meal-add Undo removes that action's saved plan; a partial Undo keeps the plan with a visible explanation. Do not remove unrelated plans or requests. Store completed Undo deltas so a retry cannot reverse them twice.

## Store runs and in-app alerts

A trip has an ID, version, claimedBy, storeName, claimedAt, requestDeadlineAt, state, and request IDs. The server permits request windows of 5, 10, or 15 minutes. Use server timestamps, not a browser-only timer.

At start, currently unbought/unassigned requests join the run. While the window is open, accepted new requests get that run ID. After the server deadline or run completion, new requests remain in the cart with no current run assignment and a Next run label. Do not reject or hide them. The shopper sees which requests arrived after start.

Proposed in #4: the current shopper can mark an unbought request on the active run as not available ("Not here") with `punted: true`. The server clears its run ID and records `punted: {by, at, storeName, runId}`; the next run claims it like any other unassigned request, and `punted` stays set ("Not found at QFC last time") until the request is bought. `punted: false` puts it back on the same run while that run is still active. Non-shoppers get 403 `NOT_SHOPPER`; requests not open on the active run get 422; stale versions get 409 with a fresh snapshot.

The snapshot derives the countdown/closed state at read time. Other open pages see a banner through polling. No background worker is required for the timer. Only the current shopper can release/finish; simultaneous starts yield one winner. Finishing records bought request IDs, releases ownership, and leaves unchecked requests for the next run. Native/background push is separate P1 work.

## Spending

Use integer cents. Pooled mode records the purchase/payer, with no debt. Split mode requires known participants, actual receipt total, and personal subtotals where personal bought requests exist. Shared remainder = total minus personal allocations. Allocate it deterministically across selected members; add each personal amount to that person's allocation. All allocations must sum to the receipt total; the payer can be outside the participants if buying on their behalf.

Unknown personal subtotals may be saved as `needs_review`, excluded from balances. Only `confirmed` split expenses create balance entries. Do not reuse the same completed run to accidentally post another receipt; an additional distinct receipt must be explicit. Replay protection is required. Tax/fees are included in the actual entered total, not silently estimated.

Balances report who owes whom from confirmed allocations. Member-supplied HTTPS Venmo/PayPal profile links are optional. Display the recorded recipient and amount to copy; opening a provider link never records a completed payment. Do not invent addresses, auto-send money, or verify repayment without provider evidence/manual reconciliation. No bank or payment SDK is required.

## Pricing boundary

Return live_api/sample/unavailable status, checked time, store/location IDs, product/brand identifiers, package size/unit, package count, current price in cents/currency, missing products, and explicit fee uncertainty. Calculate package count with compatible quantities; unknown conversions require review. Zero must never stand in for an unknown price.

A complete basket has all required products. Rank complete baskets by the comparable known subtotal, with the included/excluded fees stated; missing fees mean a final checkout total is unverified. Incomplete baskets remain visible but cannot win. An optional cheapest-per-item view must not conceal extra trips or different product constraints. ZIP-based retailer names alone cannot establish branch distance, prices, or stock.

The fixture is a sample comparison of two selected cart items after meal confirmation, with listRevision=2; it is not the entire recipe basket. It demonstrates full package costs and excludes unknown fees; it is not a store quote. Verify the provider's authorized location/product/price access before implementing live results.

## Errors and first integration

Use `{error:{code,message,retryable,requestId}}`. Validation errors use 400/422; conflict 409; provider capacity 429; unavailable/timeout 503. Return refreshed state for LIST_CHANGED, TRIP_CLAIMED, or stale item versions. Preserve user input. A twenty-five-second AI timeout offers retry, direct entry, or honestly labeled samples. Log request ID/duration/outcome, not secrets or raw prompts.

Frontend owners render the supplied fixtures first. Xavier returns the snapshot shape and real item/run state; Ethan returns the AI draft shape and pricing status. Before more features, prove meal/grocery confirmation and a store-run banner across two browsers. Confirm exact-cent fixtures and run cutoff rules before exposing balances or countdown commitments.
