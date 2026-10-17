# Common — the final household shopping plan

**PRD v2 · October 17, 2026 · planning specification, not implemented functionality**

Source of feature scope: [the team's final brainstorm](FINAL_BRAINSTORM.md). This supersedes the v1 two-page-navigation proposal. It retains the team's five areas and the approved green, warm visual direction. The goal remains a working hackathon demonstration, with an approximately eighteen-hour original build budget; use the actual time remaining when scheduling.

**Read first:** sections 1, 3, 4, and 9; then agree on [API_CONTRACT.md](API_CONTRACT.md). [TEAM.md](TEAM.md) identifies owners and work branches. The old demo is a visual reference, not the interaction contract.

## 1. The job

Common helps families, roommates, and other groups turn “what should we eat or buy?” into an agreed plan, a shared shopping run, and a clear record of spending.

The problem is coordination work: remembering different tastes, assembling requests, checking what is already requested, figuring out who is shopping, and accounting for actual purchases. One person often does that work for everyone. The app should carry information forward instead of asking that person to enter it again on five different pages.

**Primary path:** say what you want → AI prepares a meal or grocery draft → confirm once → shared cart → someone starts a store run → record what was bought and, optionally, the actual receipt total.

**Ordinary shortcut:** type “milk” directly into Shopping and press Enter. No recipe, event, vote, or AI call is required.

Diners, app users, shoppers, and people splitting costs are different sets. A family can cook four servings with two adults using the app and one pooled spending record. A roommate group can share dinner with only some people and keep personal requests separate.

### Evidence and assumptions

The earlier UW report supports list coordination, forgotten/wrong items, transportation, budget, and reimbursement as exploratory concerns; it included families and couples as well as students. Its duplicate-eggs opening was hypothetical. It does not establish current demand for this app or prove AI, weekly planning, price optimization, or countdowns are effective.

The existing demo review found too many forms, repeated meal decisions, compulsory details, item-by-item assignments, and bookkeeping. We have not yet tested the new design with users. The scenarios and acceptance targets below are proposed tests, not measured outcomes.

## 2. What changes from the demo

| Pain point | New rule |
| --- | --- |
| Ordinary dinner requires naming an event, setting a date/time, and choosing a theme. | Default to today and remembered servings. Occasion details are optional. |
| Meal and ingredient decisions are scattered across successive dialogs. | Keep AI response, recipe, list changes, and confirmation together. |
| A photo or detailed prompt seems necessary to get useful ideas. | Lead with “What do you want to eat today?” Accept vague requests using visible saved defaults. Photo input is not core. |
| New items require a quantity, store, shopper, and participants. | Name is the only required field. Quantity defaults to one. Shared/Just me is an optional quick choice. |
| Five pages feel like five required workflow stages. | Home handles discovery; every other page is independently usable and carries existing information forward. |
| Likes, diners, buying permission, and debt overlap. | Choosing a meal adds the visible list changes; it never proves someone agreed to pay. Cost participation is explicit. Voting is not required. |
| Assigning a shopper takes one action per item; claims can be silently overwritten. | Start one store run for the cart. Preserve the shopper until they end/release it. Per-item exceptions can follow later. |
| A full pantry requires constant upkeep. | Offer Already have only within the current ingredient review. A shopping request is never proof of kitchen stock. |
| Duplicate checks can hide quantity or product differences. | Compare compatible quantities, units, scope, and notes. Preserve constrained variants and personal requests. |
| Itemized receipts require typing a price for every line. | Record one actual total; ask only for personal exceptions when splitting requires them. Unresolved receipts do not create debt. |
| Family households see roommate repayment work by default. | Pooled spending records purchases without generating debts; split mode is optional per group. |
| Saved hearts, theme chips, or photo controls have no complete result. | Omit unfinished controls. Every shipped control changes something visible or has an honest disabled reason. |
| Store/price recommendations imply information the app does not have. | Use provider-backed data or conspicuously labeled samples; show coverage, missing products, and price freshness. |
| Long copy, tiny controls, and disappearing context make phone use slow. | Plain labels, large targets, persistent drafts, one primary action per decision area. |
| People add late requests without knowing whether the shopper will see them. | Show the store-run deadline and route requests after cutoff to the next run. Do not silently lose them. |

## 3. Final feature map and build cuts

P0 is the thin integrated demonstration. P1 follows only after the core path works. Gated capabilities require real access; fixtures may demonstrate the interface but must retain a sample label. No feature from the final brainstorm is silently discarded.

| Brainstorm area | P0: small working version | P1 / gated extension |
| --- | --- | --- |
| Home | AI input for a recipe, meal idea, grocery request, or revision; five navigation tabs; last five actual group activities and quick links. | Photo inspiration or a larger saved collection. |
| Plans | Save confirmed meals to dates, default today; simple current-week list/calendar; remembered editable preferences. | One AI request generates a seven-day draft; swap a day and confirm the batch. No drag-and-drop calendar library required. |
| Shopping | Collaborative cart, Shared/Just me scope, quantities/notes, one run shopper, Bought status, shopping suggestions and a price-comparison result view. | Live nearby product/price feed if authorized access is verified; multiple shoppers and multi-store routes later. Otherwise comparison uses labeled fixtures. |
| Spending | Actual total, payer, explicit pooled/split mode, personal allocation exceptions, exact-cent balances, member-provided Venmo/PayPal profile handoff. | Receipt extraction, custom weighted splits, repayment reconciliation. No actual payment integration. |
| Groups | Switch between two seeded groups, view members, start a named store run with a default ten-minute request window, in-app alerts in another open browser. | Create/join real private households, invitations/accounts, and background web push. |

Do not build accounts, bank connections, automatic transfers, scraping infrastructure, a full pantry, loyalty-account linking, or a general-purpose assistant. A fake login or fake payment success screen is not a useful shortcut.

## 4. The experience, page by page

### Home: AI is the first point of contact

The main input asks **“What do you want to eat today?”** A small hint makes groceries discoverable: “Or tell us what you need to buy.” Example prompts submit a useful request for people who have no idea where to start. No initial questionnaire.

Visible context: active group, serving default, and relevant dietary preferences. Seed this context for judging. Real households would have to supply it; the model does not magically know preferences or kitchen stock.

“Something fun for dinner” returns one recommended meal with approximate prep time, a fit explanation, and proposed cart changes. “Milk, eggs, and snacks for the weekend” returns a grocery draft without manufacturing a recipe. The same input handles “Make it quicker,” “Use beans instead,” or “Add paper plates.” Retain unchanged servings and restrictions across revisions.

A request to make a meal healthier becomes a concrete editable change, such as more vegetables or less added salt, not an unverified nutrition score or medical recommendation. An allergen-related request must preserve saved restrictions, flag uncertain packaged ingredients, and never claim the generated recipe is guaranteed safe.

One action, **Add to cart**, commits the visible draft. Meal confirmation also saves the meal to Plans, dated today unless changed. AI generation and refinement alone never mutate the shared cart. Show a concise saved message, View cart, and Undo. The last valid draft and previous version survive navigation; no paid call just to redraw the screen.

The activity feed reflects saved events, such as Sam added milk or Leila started a store run. It is not a social feed to maintain. Keep the input dominant.

### Plans: find or reuse what is already decided

Show the current week and its saved dinners. Empty days say No meal planned; selecting one opens the same AI input with that date, rather than an event form. Preferences are editable here and summarized on Home; users do not re-enter them for each meal.

P1 weekly generation produces one seven-day draft with relevant preferences and reasonable variety. Preview it before saving. Changing one day should retain the others. Preparing a week does not add seven dinners' ingredients automatically: save the plan, then choose which meals to shop for and review the combined quantities once. This prevents a planning action from unexpectedly filling the cart or committing money.

Use ordinary date rows if a calendar grid is slower to build. Recurrence, reminders, and drag-and-drop scheduling are not required for the hackathon.

### Shopping: the cart stays useful on its own

An Add an item field needs only a name. Default Shared; offer Just me beside it. Quantity, brand, or substitution details expand only when needed. A shared request and someone's personal version remain separate underlying requests even if visually grouped.

Rows show name, quantity, scope, relevant notes, and a large Bought checkbox. Keep infrequent editing in Details. Compare only current unbought requests. An eight-tortilla recipe with six compatible tortillas already requested adds the two-item shortfall. Do not convert a pack to grams without a known package size or merge products with different restrictions/notes. Already have excludes an ingredient from this draft; it does not delete another person's request. Quantities already committed to a different saved meal cannot satisfy this meal again: combine those needs or mark them for review.

One visible action starts a store run for the active group. Show the shopper and destination. Existing claims cannot be silently taken. Bought requests collapse; unchecked ones remain. Finish run preserves unbought requests and ends the shopper claim. Finishing does not require entering money.

**Nearby shopping and price comparison:** ask for or remember a demo ZIP/postal code once. Supported location data identifies the stores checked. Match recipe quantities to purchasable products, preserve restrictions, and compare the number of packages actually required. AI helps interpret and match; backend code calculates costs from source data.

Default to the lowest-priced complete basket at one checked store. Offer per-item cheapest matches as an optional comparison; explain that extra stops and known fees may erase the savings. Incomplete baskets show missing products and are never ranked as complete cheapest options. Label provider, store/location, checked time, currency, fees included/excluded, and live/sample/unavailable status. A nearby retailer's name or hosted checkout link alone is not a product-price feed.

Ethan's price-access task is a thirty-minute gate. With a usable provider, build one integration; without it, show the comparison using explicit sample data and record the blocker. The rest of the shopping path must still work. Do not claim cheapest everywhere or guaranteed inventory.

### Spending: show the purchase, not a payment project

Record purchase is optional after a run. Default payer to the current demo actor and prefill the run context; the only required number for a fully shared receipt is its actual total. Never turn an AI estimate into debt.

A group can be **Pooled** or **Split**. Pooled shows totals and who paid, with no individual debts. Split shows the participating adults before saving; the number of diners never decides this set automatically.

In split mode, personal bought requests trigger a compact exception section: enter each person's actual personal subtotal, not every receipt line. The remaining shared subtotal is divided equally among the selected people. Include tax/fees in the receipt total and allocate them consistently. If personal amounts are unknown, save Needs review and exclude that receipt from balances instead of silently making everyone pay.

Validate nonnegative integer cents, personal subtotals no larger than the total, and at least one valid shared participant when a shared remainder exists. Deterministic cent rounding must sum exactly to the receipt total. Preserve who paid, what run the expense belongs to, and the allocations; retry cannot create a second expense.

Show **Who paid** and **Who owes whom** from confirmed purchase records. Keep Venmo/PayPal profile links voluntary and member-provided. Display the recipient and amount to copy before opening their verified HTTPS provider link; no SDK, bank connection, automatic transfer, or invented recipient. Opening a link is not proof of payment. Repayment verification/reconciliation is later work.

### Groups: one quick store-run announcement

Show groups the demo actor belongs to, members, the active shopper, and the run countdown. P0 uses two seeded groups so switching is real without building invitations or accounts. All API state is scoped to the selected group.

Starting a run uses a short sheet: destination and a default **10 minutes for requests**, editable to 5 or 15 minutes. Reuse the last destination if known; do not require GPS or an API lookup to announce a run.

Other open browsers in the group see an in-app banner: **Sam is going to the store. Want anything? 9:42 left.** Add an item uses the same cart input. Requests accepted before the server deadline join the current run; later requests stay visible for the next run with a clear label. The shopper sees newly added requests. No scheduled background job is needed merely to display a server-timestamp countdown.

Only one active run per group in P0. Concurrent starts yield one winner. End/release remains available to the shopper. Background push when the app is closed requires permissions and delivery infrastructure and is P1; do not describe open-page polling as native push.

## 5. Defaults that remove work

- Remember group, servings, preferences, and spending mode. Show them; allow corrections without making them a routine form.
- Today is the default date, Shared the default request scope, current actor the default payer/shopper, and ten minutes the default request window.
- Keep five labeled tabs, but never require visiting them in order. No introductory wizard, calendar setup, vote, or shopping-account link blocks use.
- Make consequential writes explicit once; show pending writes and preserve failed input. Use the same action ID on retries.
- Undo only the eligible changes from that draft, preserving prior requests and subsequently edited/bought items. Explain a partial reversal.
- One primary action per response/area. At least 44-pixel touch targets, visible labels/focus, accessible save/error messages, no horizontal phone overflow, and reduced-motion support.

## 6. AI and technical boundaries

Use React/Vite, FastAPI, and one SQLite-backed server process. Start from the existing contract/fixtures, updating all affected callers together to contract v2. No new framework or provider abstraction. Keep server secrets out of React and Git.

One AI endpoint takes the message, group preferences, and previous draft. It returns a validated meal recommendation, grocery draft, or one focused clarification. P1 adds a weekly draft. No full chat-history service, training, vector database, or agent swarm. For vague tastes, suggest something using visible defaults; ask a question only for a real blocking contradiction. Cap model output and preserve the last valid draft on failure.

Wait state after roughly three seconds; recoverable timeout after twenty-five. Those are targets, not observed performance. Labeled samples can keep the rest demonstrable after a provider failure. Log outcome, duration, and request ID rather than prompts, photos, or credentials. No photo pipeline is needed for P0.

FastAPI owns group scoping, current drafts/plans, list revisions, run deadlines/claims, expense calculations, and provider access. Use parameterized SQL and small shared data models. SQLite needs a writable disk and one process; do not pretend an ephemeral multi-instance deployment shares a durable file. Prove frontend/backend hosting early and restrict CORS to the agreed frontend origins.

Poll the active group snapshot about every three seconds while visible; refresh after writes. Show stale/offline state on failure and pause hidden-tab polling. Native push, private accounts, and production access control are not implemented. The demo actor selector is attribution, not authentication: use fictional data only.

## 7. Data and invariants

Reuse one Group/Workspace, Actor, Draft, Plan, Item, Run, Expense, Activity, and replay/Undo action record. Store recipe bodies and generated draft content as validated JSON. Do not build a separate backend for each page.

- Every draft, item, plan, run, expense, and activity belongs to a workspace ID. A group's data cannot be accidentally mixed into another group's view.
- An item carries name, quantity/unit, notes, requester, Shared/Just me scope, bought status, version, and optional run assignment.
- A run carries shopper, destination, server deadline, state, and bought request IDs. Late requests remain for the next run.
- An expense records actual cents, payer, mode, selected participants, personal allocations, and review status. Only confirmed split expenses affect debts.
- Live-price data retains source, checked time, store/product/package identifiers, coverage, and unknown fees. Unknown is not zero.
- Successful action IDs are replay-safe. A replay returns original action metadata and a fresh workspace snapshot, not stale shared state.

The exact endpoints and example payloads live in API_CONTRACT.md; that is the integration boundary to agree before coding.

## 8. Acceptance checks

| ID | Task | Pass condition |
| --- | --- | --- |
| A1 | “Something fun for dinner,” then “make it quicker.” | One coherent revised meal retains servings/restrictions; one confirmation saves its dated plan and cart changes. |
| A2 | “Milk, eggs, paper plates” in Home, or just milk in Shopping. | Grocery requests work without creating a meal/event. Direct entry has one required field. |
| A3 | Family vs roommate group. | Four diners do not require four users; pooled spending creates no debt; group switching preserves separate records. |
| A4 | Existing quantities and personal variants. | Only compatible shortfalls are added; personal/shared or constrained products are not silently merged; retry adds nothing twice. |
| A5 | Store-run countdown in two browsers. | Another actor sees the announcement within two successful polls, can add before the deadline, and sees late requests labeled for next run. |
| A6 | Two shoppers start at once; one finishes a partial run. | Exactly one claim wins. Bought requests persist, unchecked ones survive, and run ownership ends correctly. |
| A7 | Nearby basket comparison. | Every price has live/sample status and source; package counts are respected; incomplete baskets cannot win a complete-basket ranking. Missing fees remain explicit. |
| A8 | Shared receipt: 1,001 cents among three adults. | Allocations total exactly 1,001 cents, with a deterministic one-cent remainder. |
| A9 | 2,000-cent receipt with 600 personal cents and two shared participants. | Shared remainder is 1,400; shares are 700 each, plus the assigned person's 600. Unknown personal amounts yield Needs review, no debt. |
| A10 | Payment link is opened. | Recipient/amount are visible; no transfer is triggered by the app and no automatic Paid state is invented. |
| A11 | Plans and recent activity. | Confirmed meals appear on their dates; the feed contains actual saved events; drafts alone create no shopping or spending history. |
| A12 | AI/API failure, refresh, phone, keyboard. | Work is retained, fallback is honest, important controls remain reachable/labeled, and no duplicate writes or horizontal overflow occur. |
| P1 | Generate a week. | One batch returns seven dated draft meals, one day can change independently, and saving plans does not automatically add a week's groceries. |

Test the ordinary flow with three people outside the team if possible. Watch hesitation and backtracking; do not claim saved time, money, waste, or higher conversion without measurements. If only one person is available, prioritize a family organizer who did not design the app.

## 9. Owners and integration order

| Person | Primary ownership | GitHub tasks |
| --- | --- | --- |
| Ibrahiim | Shared React shell, Home/AI conversation, Plans and preferences | Home task plus Plans task |
| Suyash | Shopping, Groups/run UI, Spending UI | Shopping task plus Groups and Spending tasks |
| Xavier | FastAPI, SQLite, shared schemas, group/run state, exact-cent expense logic, deployment | Backend foundation task; supplies routes for each UI |
| Ethan | AI meal/grocery/refinement adapter; weekly generation after core; provider-backed store data if available | AI task and pricing-access task |

Ibrahiim owns shared frontend config/API client; Suyash does not generate a second app or rewrite the shell. Xavier owns server routes/models; Ethan supplies service functions instead of replacing the router. Keep the existing four work branches. Update issue checklists rather than creating parallel competing task sets.

Build order:

1. **First hour:** agree on v2 response shapes, seed two groups, run/deploy a frontend shell and health/snapshot route. Time-box grocery-price access to thirty minutes.
2. **First connected slice:** fixture meal/grocery draft → confirmed cart → another browser starts a run. Use real shared state before polishing five views.
3. **Next:** connect live AI refinement; add dated Plans, group switching, countdown alerts, scope labels, and one-total Spending. Test expenses and run concurrency as they arrive.
4. **Only after that:** weekly generation, richer live price coverage, and background push. Keep sample/live labels throughout.
5. **Final three hours:** freeze features, run acceptance checks, fix material problems, rehearse, record a fallback, and submit.

If time tightens, retain thin views and the complete core journey. Cut weekly generation and background push first. If price access fails, keep honest sample comparison. If expense allocations cannot be validated, retain purchase records as Needs review rather than shipping incorrect debts. No one should spend the last hours building accounts or payment infrastructure.

## 10. Judging and remaining decisions

Demo one family meal and a roommate shopping run: conversational discovery, a natural refinement, one cart confirmation, another browser adding a request to a countdown run, a marked sample/live basket comparison, and a reviewed purchase total. Keep the main run to 2–3 minutes; use the secondary pages to answer questions, not force a page tour.

This fits the provided Visa track through discovery, decision-making, coordinated purchasing, and post-purchase clarity. A Visa payment integration is not required by the supplied text. Its pasted UX weights conflict, so verify the rubric with organizers rather than invent a weighting. No winning outcome or commercial impact is established.

Team decisions to settle immediately: actual time left, one AI provider/key, one reachable backend host, the grocery provider/access result, and which P1 items can be attempted after core acceptance. All personal/example data used during judging must be fictional.

## Sources

- [Final team brainstorm](FINAL_BRAINSTORM.md): all five page areas and requested capabilities are mapped in section 3.
- The user's explicit AI-first, low-manual-work feedback and the original eighteen-hour deadline.
- [Baseline UX findings](UX_REVIEW.md), used to avoid recreating the old workflow.
- [UW exploratory report](https://courses.cs.washington.edu/courses/cse440/14au/projects/groupshop/documents/Report1.pdf), pp. 1–4 and 12–15; historical task evidence, not current market validation.
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): one possible integration shape, not a recipe-safety guarantee.
- [Instacart nearby retailers](https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/) and [shopping-list links](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page): these documented endpoints alone do not establish a direct cross-store price feed.
