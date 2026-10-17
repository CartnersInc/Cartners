# Common: decide dinner, share the shopping

**PRD v1 · October 17, 2026 · 18-hour hackathon build**

Status: a concrete build proposal for the team to review before implementation. It replaces the earlier broad feature scope and the navigation proposal in `UX_REVIEW.md`. The current demo remains a visual reference and a record of the interactions we are replacing. This document does not claim the overhaul is implemented or validated with users.

**Team kickoff:** read sections 1, 5, 6, and 11 together, then freeze `API_CONTRACT.md`. Use the remaining sections as implementation and QA references; do not turn document review into a second project.

## 1. The product decision

Common helps people sharing a household decide what to eat and get the right things onto one shared shopping list. It works for a family organizing dinner, roommates sharing some meals, or friends bringing food to a gathering.

**Problem statement:** Turning “what should we eat?” into an agreed meal and a usable shopping list takes repeated coordination. Preferences, requests, and shopping responsibilities are scattered, so one person often ends up assembling the plan and checking what everyone needs. A useful app should reduce that organizing work without requiring the household to maintain another system.

The 18-hour build proves one complete loop:

**Request or food photo → two editable meal ideas → one confirmation → shared list → someone claims the trip.**

Adding milk directly remains faster than that loop. Recipes, votes, and AI are never prerequisites for a shopping list.

### Decisions already made

- Audience is shared households, including families; roommate reimbursement is not the universal home screen.
- Keep the approved garden-table visual direction: green, warm, natural food imagery, clear working controls.
- Use React/Vite, Python/FastAPI, and a small SQL database. No framework switch during the build.
- Spend the hackathon on generative AI and the connected shopping experience. Skip accounts and actual payments.
- Real shared state matters: two browsers must see the same list and shopper claim.
- The hackathon demo uses fictional household data. It is not ready for private household use.

### Assumptions to test

People will use a shared list often enough to keep it relevant; seeing two suitable meal ideas is easier than starting from a blank search; one review can replace several planning steps. These are product hypotheses, not established findings.

## 2. Evidence and its limits

The supplied UW report, *A Modern Way to Coordinate Your Shopping Trip*, describes four contextual inquiries across different household situations, including a family, couples, and college roommates. Pages 2–4 discuss list availability, forgotten or wrong items, transport, budget, preferred brands, and the burden of separating personal purchases and reimbursement. Its eventual design emphasizes list creation and accounting.

Use that evidence to justify a shared, accessible list and clear responsibility. It does not prove demand for AI, themed dinners, unanimous voting, automatic inventory, or this product. The duplicate-eggs opening is a hypothetical scenario, not a measured prevalence statistic. The team has not yet done its own household interviews.

The demo review supplies a second kind of evidence: observable interaction problems in our prototype. It is a design assessment, not a usability study. Sources are listed at the end.

## 3. Who we are designing for

These are illustrative scenarios, not real interview participants.

| Person and situation | What they need | What the app must avoid |
| --- | --- | --- |
| Leila organizes dinner for two adults and two children. Her partner can shop on the way home. | A manageable meal, four servings, and a list her partner can immediately use. | Asking every diner to vote, create an account, or owe an individual share. |
| Maya shares a home with three other adults. Only two are eating together tonight. | A meal for two, a clear shared list, and room to add personal requests. | Treating everyone in the household as a diner or silently committing them to a purchase. |
| Sam is already near a store. | Know what is still needed and tell the group “I’m getting it.” | Reading event setup, planning dates, or assigning twenty separate items. |
| Alex is hosting a casual dinner. | Change the serving count and add drinks or paper plates alongside ingredients. | Building a guest-management system before making a list. |

**Primary user:** the person carrying the mental work of deciding and organizing a meal. **Second user:** the person doing the shopping. They may be the same person. The product should help both without requiring everyone else to participate.

Household members, diners, and shoppers are different concepts. Four servings can mean two adults cooking for four people; it does not require four app users.

## 4. What is wrong with the current demo

The full baseline review remains in `UX_REVIEW.md`. This table adds the consequences for the broader audience and makes the overhaul decisions explicit.

| Current pain point | Cost to the user | Overhaul decision |
| --- | --- | --- |
| Make a plan leads the home screen and asks for name, date, time, theme, and participants. | Buying groceries feels like organizing an event. | Default to today. Occasion name and scheduling leave the required path. |
| Tonight and Our plans repeat the meal choices. | People must understand our sections before taking action. | One Dinner screen and one Shopping screen. |
| Recipe → ingredients → confirmation uses successive dialogs. | Users repeatedly reorient and approve related information. | One meal review surface with the ingredients and the action together. |
| New items require quantity and store before adding. | “We need milk” becomes a form. | Item name is the only required field. Quantity defaults to one; store is optional. |
| Participants and household settings reappear in routine flows. | The app repeatedly asks for information it should remember. | Remember servings and preferences; show a compact summary and an Edit control. |
| Likes, votes, diners, purchasing approval, and cost shares overlap. | A tap can mean several things. | P0 has no voting or debt inference. The organizer chooses the meal; reactions are optional later. |
| Auto-add requires all four sample roommates. | Subgroups and families are forced into an irrelevant consensus rule. | Remove unanimous matching from the 18-hour build. |
| Each item needs an assignment; reassignment can replace someone immediately. | One trip becomes many taps and ownership is unreliable. | Claim the current trip once. Existing ownership cannot be silently taken. |
| Complete pantry controls require constant maintenance. | An outdated inventory creates work and false confidence. | No full pantry in P0. Offer “Already have this” only within the current meal review. |
| Duplicate detection checks names without enough attention to quantity or constraints. | A list can look clean while still being wrong. | Compare quantity/unit and explicit notes; keep ambiguous items separate. Never equate a request with stock at home. |
| Receipt entry requires purchased checkboxes and a price for every item. | The shopper performs bookkeeping after the trip. | Remove itemized accounting from P0. Optional trip total is the first extension. |
| Spending and repayments occupy a main destination. | A family with pooled money sees work it does not need. | No Costs tab in P0. Later summaries live with completed trips and are optional. |
| Saved hearts have no collection; themes mostly reorder the same results. | Controls promise more than they deliver. | Ship only controls with a clear result. Keep fun in the meal ideas and imagery. |
| Food photo suggestions are always the same examples. | The apparent AI benefit is not real. | Connect one real text/image-to-meal endpoint; label fallback examples honestly. |
| Long headings and repeated explanatory notes compete with actions. | Shopping becomes reading. | Plain task headings, concise state labels, one obvious next action. |
| Reloading or changing screens can lose the selected plan context. | People cannot trust where their work went. | The server stores the current meal and active trip; navigation does not create a new plan. |

Do not turn these fixes into sixteen new settings. Most are defaults, removals, or consolidation.

## 5. The new experience

### Dinner: start with something useful

Opening the app shows the current household, serving count, and either the chosen dinner or two starter meals. The primary action is **Find a dinner**. A secondary **Add food photo** control uses the same request surface.

The request is one short text field, with a real example: “Quick dinner for four, one vegetarian.” People can also tap a useful preset such as Quick dinner or Try something new; it populates the request rather than starting another workflow. Saved preferences and servings appear in a compact editable summary. No setup wizard.

Generate exactly two options. Each includes a name, approximate preparation time, serving count, one sentence explaining the fit, and a clearly marked illustration if a suitable image exists. Do not require generated photography; no image is better than a misleading dish photo. A result opens directly into its meal review. **Try another idea** is secondary and never regenerates on page load.

### Meal review: make one informed choice

Use an inline expanded area or a single full-height mobile sheet. Keep the meal name, servings, proposed list changes, and **Choose dinner & add items** together. Cooking steps are collapsed until needed.

Show new ingredients and any matching items already requested. For each match, show the required and listed quantities. Clear compatible shortfalls can be added; uncertain units, brands, or dietary constraints stay visible for review. A collapsed **Already have something?** section lets someone exclude specific ingredients from this addition. It is not an inventory database.

One confirmation chooses the dinner and updates the list. Show “Dinner chosen · 5 items added” with **View list** and **Undo**. Items already present are not blindly duplicated. The action does not start a payment, assign anyone a debt, or require other household members to react.

Before confirmation, **Back to ideas** preserves the draft. After confirmation, P0 offers the chosen recipe, list, and Undo for the addition; it does not offer a second meal-calendar system. Choosing a replacement must not silently delete purchases or unrelated list items.

### Shopping: work immediately, even without a meal

The Shopping screen starts with a one-line **Add an item** field and the shared list. Pressing Enter adds the item. Optional details expand for quantity, a brand/substitution note, or a personal request label. Do not ask for a store or shopper at creation.

A visible trip strip says either **Nobody’s shopping yet — I’m getting these**, **Maya is shopping**, or **You’re shopping — Finish trip**. Claiming applies to the currently unbought items as one errand. New requests added afterward are visibly marked as new, so they are not mistaken for things the shopper already saw. P0 supports one active shopper; a second person can still add requests and check the shared state.

Rows show item name, quantity, and relevant notes. The main row action is a large Bought checkbox. Less frequent editing belongs behind a labeled Details control. Bought items move into a collapsed section; remaining items stay visible.

**Finish trip** marks the trip complete using the items actually checked. Unbought items remain for the next trip. No receipt or price is required to finish. In P0, a confirmation says how many items were bought and what remains, then releases the shopper claim.

## 6. Hackathon scope

| Priority | Deliverable | Done means |
| --- | --- | --- |
| P0 | Responsive React app with Dinner and Shopping | Both work on a phone; no onboarding or dead controls. |
| P0 | One seeded demo household | At least two fictional actors, four default servings, editable relevant preferences. A small actor selector is labeled as a demo control, not authentication. |
| P0 | Real text or food-photo meal generation | One server-side AI integration returns two validated editable options. Photo results are plausible adaptations, not an assertion that the exact original recipe was recovered. |
| P0 | One review and ingredient-to-list confirmation | Existing requests and constraints are considered; repeated confirmation cannot duplicate the batch; Undo is available. |
| P0 | Direct item entry and shared list | One required field; another browser can see a successful addition. |
| P0 | One trip claim, bought status, finish | Two simultaneous claim attempts cannot both win. Unbought items survive completion. |
| P0 | Honest failure and demo fallback | AI failure preserves work and offers retry, direct entry, or labeled sample ideas. |
| P1 | Optional group reactions | “Like this idea” records preference without preventing the organizer from proceeding or implying cost consent. |
| P1 | Optional trip spend | One actual total; optional equal split among explicitly selected adults. No account linking or transfers. Build only after all P0 checks pass. |
| P2 | Receipt extraction, payments, event calendar, recurring menus, saved collections | Explicitly outside the 18-hour commitment. |
| P2 | Store routing, live offers/prices, linked memberships, full pantry, automatic habit learning | Deferred; none may be implied by the demo. |

Direct additions may include snacks, cleaning supplies, or party items. Specialized furniture purchasing, subscription management, and household chores are not separate features in this build.

## 7. Rules that keep automation trustworthy

1. **AI proposes; the user commits.** A generated idea cannot write to the shared list before confirmation. The server checks the response structure, limits, and list changes.
2. **Remember confirmed preferences, not guessed habits.** P0 uses editable explicit preferences. A preference is not a guarantee of allergy safety; the result must name relevant ingredient uncertainty.
3. **No silent restrictions override.** If a request conflicts with a saved restriction, explain the conflict and ask for a change. Do not automatically relax it. Never call a photo-derived meal allergen-free.
4. **A list request is not kitchen inventory.** “Already on list” and “Already have” are separate states. Exclusions apply to this meal addition only.
5. **Compatible quantities only.** Normalize case/spacing and known singular/plural units. Compare quantities only in the same supported unit. Keep oat milk and dairy milk, and distinct brand/restriction notes, separate. Do not build a general food ontology in 18 hours.
6. **Explicit consequential actions.** Choosing dinner does not charge anyone. Claiming a trip means responsibility, not proof of purchase. Bought status is not a financial ledger.
7. **No local success before server success.** Show pending writes, retain the user's input on failure, and retry safely using the same action ID. A stale list returns a refreshed review rather than silently overwriting another person's change.
8. **Safe reversal.** Undo reverses this batch's untouched changes only. It preserves earlier requests and items subsequently edited or bought by someone else; explain any portion that cannot safely be undone.

## 8. AI contract and failure behavior

Use one provider and a vision-capable model through FastAPI. Keep the provider/model configurable on the server, but do not build a provider framework. Agree on the response contract before frontend implementation. OpenAI image inputs and structured outputs are one suitable documented option; another provider can be used if already available to the team.

Inputs: a short request, serving count, relevant explicit preferences, and an optional user-selected food photo. Do not send names, repayment records, live locations, or unrelated list history. Label the photo upload as being sent to the AI service before submission; retain no photo file or image contents in application logs. Never place the provider key in React or Git.

Outputs: two meal options with ingredients, quantities, units, cooking steps, approximate preparation time, fit explanation, and specific uncertainties. No merchant price claim. A user's dollar budget is a planning target; without verified price data, say **Cost not verified** and offer ingredient substitutions rather than inventing an exact total.

Failure handling:

- Blank request with no photo: inline prompt to enter an idea or choose a preset.
- Non-food or unreadable photo: explain that a recipe cannot be inferred and offer text entry; do not fabricate a confident match.
- Invalid/incomplete model output or conflicting restrictions: reject it as unusable, keep inputs, and offer retry or sample ideas.
- Request takes longer than 3 seconds: show that suggestions are still being prepared. Stop waiting at 25 seconds and offer retry; these are implementation targets, not measured latency claims.
- Provider unavailable or quota exhausted: show **Live suggestions unavailable**. Labeled samples can demonstrate the rest of the flow. Never present a sample as a live result.
- Reject files over 5 MB or outside JPEG/PNG/WebP before upload and at the server. Show a readable recovery action.

Do not log raw prompts or photos. Log request ID, duration, provider outcome, and schema validation result only. Confirm provider retention behavior before inviting real personal data; the judging demo uses samples.

## 9. Architecture and shared contract

Use a client-side React/Vite frontend, FastAPI HTTP endpoints, and SQLite for one backend process if a teammate knows SQL. Use Python's existing SQLite support and parameterized statements; a new ORM, migrations framework, event bus, and WebSocket server are not requirements. SQL unfamiliarity is an early mentor question. If persistence threatens the core demo, a documented in-memory emergency fallback may be used with the same response shape; disclose resets and process restarts.

React owns presentation and form state. FastAPI owns committed meal/list/trip state, writes, duplicate rules, and the AI call. The AI response never becomes executable instructions or unrestricted database updates.

Serve the frontend separately from the backend, with one configured API base URL and explicit allowed frontend origins. The API must be reachable from the second demo device. Use HTTPS when deployed. Deploy a health-check route and frontend shell during the first hour; do not discover hosting issues near submission.

For the demo, SQLite must run on a writable local/persistent disk with one backend instance. Do not deploy a SQLite file to an ephemeral multi-instance/serverless filesystem and claim shared persistence. Pick one host the team already knows; no cloud platform migration during the hackathon.

Poll the shared snapshot every 3 seconds while the page is visible and refresh after writes. Pause hidden-tab polling. Show a stale/offline indicator after failures; never promise real-time stock or offline write synchronization. No custom realtime infrastructure.

The minimal entities are Household settings, generated Draft, chosen Meal, List item, Trip, and an Action record for replay protection/Undo. Store generated recipe bodies as validated JSON instead of a heavily normalized recipe database. Use generated IDs, server timestamps, and a list revision. The exact agreed endpoint shapes and example payloads are in `API_CONTRACT.md` and `fixtures/`.

No accounts means no private user boundary. The demo actor selector is an attribution device and must not be presented as security. Use fictional data in an isolated judging workspace; do not open it for real families to store private information. Production identity, invitations, permissions, and private uploads are later work.

## 10. Interaction and accessibility requirements

- Two main destinations: **Dinner** and **Shopping**. A clear Preferences entry holds infrequent settings. No separate plan, pantry, or spending destination in P0.
- Preserve green and warm surfaces, but use task language: Find a dinner, Add an item, I’m getting these, Bought, Finish trip.
- One primary action per decision area. Do not require chat to navigate or add an item.
- Phone targets at least 44×44 CSS pixels. Quantity and price inputs use appropriate keyboards. Desktop keyboard users can add items with Enter.
- Give every input a visible label. Errors identify the problem and recovery. Focus enters a sheet/dialog and returns to its trigger when closed.
- Announce saved/error states accessibly; never use color alone to communicate bought or claimed status.
- Preserve form inputs when interrupted or a request fails. Return from meal review to the same options without another paid generation call.
- Keep the shopping trip action visible without requiring scrolling through the entire list. Respect reduced motion. Food photography supports appetite; it must not obscure ingredients, notes, or actions.

## 11. The four-person build plan

| Owner | Owns | Must agree before splitting | First usable handoff |
| --- | --- | --- | --- |
| A: Dinner frontend | React shell, request/photo input, result cards, one meal review, preference summary | Snapshot and suggestion fixtures; confirm/Undo states | Entire flow working against fixtures by H3. |
| B: Shopping frontend | Direct entry, list rows, trip strip, bought/finish states, mobile layout | Item IDs, trip states, conflict/error responses | Shopping interactions against fixtures by H3. |
| C: Backend/data | FastAPI routes, SQLite state, list rules, trip concurrency, deployment of API | Endpoint names, revisions, action IDs, seeded household | Health + shared snapshot by H1; real add/claim by H3. |
| D: AI and integration checks | One AI adapter, response validation, food-photo path, deterministic fallback fixtures, demo evidence | Same schema as fixture; timeout and restriction rules | Validated live text/photo result by H5; error cases documented. |

A owns shared frontend files; B contributes shopping components without simultaneously rewriting the shell. C owns route/data files; D supplies a small meal-generation function and schema rather than editing C's router. Put shared examples in `docs/fixtures/` first. Announce contract changes before changing keys. Integrate early; do not wait for all four branches to be “finished.”

### Eighteen-hour checkpoints

| Time from build start | Required outcome | Cut decision |
| --- | --- | --- |
| H0–H1 | Read this PRD together, freeze P0 contract, seed the household, run both apps, smoke-test hosting. | Remove disputed optional features now. |
| H1–H3 | Fixture-based meal → list flow; real API list visible in two browsers. | Fix connectivity and state before visual refinements. |
| H3–H6 | Live text/photo AI reaches the meal review; real confirm and trip claim connected. | At H6, drop P1 if any core path remains disconnected. |
| H6–H10 | Complete vertical flow, safe retries, bought/finish, Undo; deploy the same build used in testing. | No new feature families after H10. |
| H10–H13 | Three short usability sessions and targeted fixes; verify family and roommate scenarios. | Remove confusing controls instead of adding explanations/settings. |
| H13–H15 | Run acceptance checks, test phone/desktop, create resettable demo and fallback recording. | Freeze functionality at H15. |
| H15–H18 | Submission, demo rehearsal, evidence capture, bug fixes, buffer. | No accounts, payments, framework changes, or bonus integrations. |

**If P0 slips:** cut every P1 first, then use seeded preferences instead of building their editor. If the photo path is still unreliable, ship a clearly labeled text-only live-AI demonstration rather than fake image understanding, and record that the full P0 image check was not met. Do not trade away the shared list or the honest fallback state to finish decorative controls.

Adjust the clock to the actual remaining submission time. These checkpoints include integration and submission work; they are not eighteen hours of uninterrupted feature coding.

## 12. Acceptance checks

These are release gates and evaluation targets, not results already achieved.

| ID | Scenario | Pass condition |
| --- | --- | --- |
| U1 | Someone just needs milk. | One field + submit adds it, with no required date, store, diner, or AI call. |
| U2 | Family of four, two adults using the app. | Four servings work without four accounts or a debt screen. |
| U3 | Roommates, only two diners. | Serving count changes before generation; no household-wide voting gate. |
| U4 | A request or sample food photo is submitted. | Live API produces two usable structured options, or an honest failure/fallback state. |
| U5 | One option is chosen. | One review + one commit creates the chosen dinner and correct list changes; repeated submit adds nothing twice. |
| U6 | Some ingredients are already requested or explicitly excluded. | Compatible shortfalls are considered; constrained products remain distinct; excluded ingredients are not added. |
| U7 | Two people claim simultaneously. | Exactly one claim wins; the other sees the current shopper and cannot silently replace them. |
| U8 | Another browser changes the list. | Update appears within two successful polling cycles, normally about six seconds. Failed sync is visible. |
| U9 | Shopper buys only part of the list and finishes. | Bought items are retained in history; unbought items remain; trip claim is released. No prices required. |
| U10 | Undo follows a meal addition. | Earlier requests and subsequently edited/bought items are preserved. Any unsafe partial reversal is explained. |
| U11 | AI/write request fails or is retried. | Input remains, loading ends, recovery is available, and no duplicate state is created. |
| U12 | The app is used at 390 px width and by keyboard. | No horizontal overflow; primary actions are reachable, labeled, and have visible focus. |

Have three people outside the team attempt U1, U5, and U9 without coaching. Aim for all three to finish without asking what the next button means. Record pauses, backtracking, and questions. If there is time for only one test, test the full task with a family organizer rather than asking whether the design looks good.

Instrument only what the demo needs: generation requested/succeeded/failed, meal confirmed, item added, trip claimed/finished. No analytics platform required. Observe time and action count manually. Do not advertise time saved or waste reduced without a measured comparison.

## 13. The judging story

Use one ordinary scenario: “Two adults are feeding four people, and one can shop on the way home.” Enter a short request or use a food photo. Show the preference-aware result, confirm one meal into the shared list, then use a second browser to claim and finish part of the trip. Add a non-recipe item to demonstrate that the list stands on its own.

For Visa Reimagine Shopping, the transformation is discovery and decision-making flowing into a coordinated shopping list. Show the real model call and why the result fits the supplied request. Describe fewer handoffs as the intended commerce benefit, not a quantified conversion or merchant-sales claim. Based on the supplied challenge text, a Visa payment API is not a stated requirement.

The pasted rubric contains conflicting UX weights: the top table says 20%, while the detailed entry says 25%. Confirm that with organizers; do not invent a corrected scoring formula. A polished, functioning journey and honest treatment of AI uncertainty serve either version.

Prepare a 2–3 minute run, a sample photo with permission to use it, a reset script for fictional state, and a short fallback recording. If using cached samples, say so. Do not perform a real payment during judging.

## 14. What happens after submission

Prioritize observed adoption problems before adding features. If people use the shared list and want help remembering dinner, consider Make again and lightweight reactions. If reimbursement is a recurring problem in tested households, add reviewed receipt extraction and explicit purchase participation. If families mostly use pooled spending, keep repayment invisible. Real accounts, household access control, data retention and private sharing are prerequisites for a public product, not hackathon demo embellishments.

## 15. Decisions the team must settle in the first hour

1. Who owns A/B/C/D, and who can run/debug SQL? If nobody can, consult a mentor and choose the documented emergency storage fallback before building around it.
2. Which single AI provider/model has a working key and image-input support? Verify with one sample, not an architecture debate.
3. Which known host provides a single writable backend process and a reachable frontend? Prove it early.
4. What fictional preferences and sample photo tell the demo story clearly? Avoid personally identifying household data.

The rest of P0 is specified so these choices do not reopen the product scope.

## Sources and precedence

- Team brainstorm, user-approved visual direction, explicit feedback on manual steps, the supplied DubHacks technical guide, and the stated eighteen-hour deadline are the product constraints.
- [UW project report: A Modern Way to Coordinate Your Shopping Trip](https://courses.cs.washington.edu/courses/cse440/14au/projects/groupshop/documents/Report1.pdf), especially pp. 1–4 and 12–15. Historical exploratory evidence, not current market validation.
- [Baseline UX review](UX_REVIEW.md). Superseded by this PRD where navigation or scope differs.
- [React: Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app). The supplied guide's CRA recommendation is dated; use the team's existing Vite decision.
- [Vite getting started](https://vite.dev/guide/) and [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/) for the client/API boundary. Check current runtime requirements at setup; do not assume the old demo's Node minimum is the Vite minimum.
- [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) support the proposed integration shape; they do not guarantee recipe correctness or safe ingredients.
