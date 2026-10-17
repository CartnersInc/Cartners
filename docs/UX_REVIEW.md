# Make the everyday trip easier

## Scope

Focused interaction review of the existing five-screen demo: desktop and mobile captures plus the implemented controls and flow code. No fresh user study, success-rate claim, visual redesign, parallel agent audit, or AI API work was performed for this review. This document records proposed changes; the published demo remains the baseline.

## Root problem

The current app turns buying groceries into managing a small project. It exposes recipes, events, pantry records, votes, assignments, and accounting as separate things to maintain. A roommate usually needs to add something, see who is getting it, or record what was paid.

Keep the green visual identity and food imagery. Simplify the work around them.

## Priority findings

| Priority | Existing interaction | Why it gets in the way | Proposed change |
| --- | --- | --- | --- |
| P1 | Home's main action is Make a plan; that form asks for name, date, time, occasion, and participants. | An ordinary dinner or restocking trip looks like an event to organize. | Default to today's household list. Make event details optional for people planning ahead. |
| P1 | Meal flow can cross Home → Our plans → recipe dialog → ingredient dialog → confirm. The direct recipe route is shorter but visually secondary. | The same decision is spread across several views. | Put recipe, participants, missing ingredients, and one Add to list action in one review surface. Cooking instructions expand only when wanted. |
| P1 | Adding a plain item requires a quantity, store, shopper, and participants alongside its name; quantity and store are required. | Someone who just needs milk has to predict the shopping trip. | Start with one Add an item field. Default quantity to one and sharing to the household, visibly. Store and shopper remain unset until useful; exceptions expand on demand. |
| P1 | Shopping requires checking off purchases, finding Record costs near the bottom, then entering an amount for every item. | A long list creates many taps and accounting work; the next action is initially disabled without an inline explanation. | Keep Finish shopping visible. For one shared group, enter one receipt total and review the split. Expand personal-item or different-participant exceptions. Later add receipt extraction, with unclear lines flagged for review. |
| P1 | Every item has a claim button; reassignment can immediately replace another shopper. | One grocery trip becomes several assignments, and ownership changes can surprise people. | Let a shopper claim the unclaimed trip or a store group once. Keep an existing shopper until they release or accept reassignment. Retain per-item exceptions. |
| P2 | Tonight and Our plans repeat meal choices; five navigation destinations separate one journey. | New users must decide where their task belongs. | Use Home, List, and Costs as the daily navigation. Put household preferences in a clear settings entry and upcoming occasions inside Home. |
| P2 | “I’m in” appears beside recipes; voting and unanimous auto-add live in Household. Matching requires all four sample members. | Interest, joining a meal, permission to buy, and cost participation are easy to confuse. Unanimity can stall a subgroup. | Label votes explicitly, show who is joining, and state “Shared by Alex, Maya…” beside the confirmation. Voting is optional. Auto-add follows an explicit group rule and never invents consent to pay. |
| P2 | Have / Use soon / Out / Unsure controls require ongoing pantry maintenance. | An inaccurate inventory creates more work and unreliable duplicate promises. | Treat recent purchases as “might already have.” Ask Have it / Need it only where that changes the current list; allow correction in place. Do not claim to know what remains. |
| P2 | Home offers saved hearts without a saved collection, theme chips that mainly reorder the same recipes, and a photo flow that always returns the same examples. | These controls imply capabilities or destinations the demo does not provide. | Remove incomplete controls or give them clear results. Label photo generation as a demo until a real API exists; keep it secondary to the list. |
| P2 | Long playful headings and explanatory notes appear across operational screens; search, tabs, edit, and claim compete on each row. | Reading and control selection add friction during a quick phone task. | Use direct headings such as Shopping list and Who owes what. One primary row action; put less frequent changes in a labeled details menu. Show explanations at the relevant decision. |

## Proposed everyday experience

1. **Add or choose.** Type an item, pick a meal, or bring a food photo. Household defaults are remembered and visible. No event creation required.
2. **Confirm once.** See what is being added, who shares it, and uncertain pantry matches together. Change exceptions inline. Joining a meal and owing money remain distinct.
3. **Shop and finish.** One person claims an errand. Mark what was bought, enter a shared total or review extracted receipt details, then confirm the actual split. Payment completes in an external provider.

The list also works when nobody wants a recipe, a theme, a vote, or AI.

## Where AI earns its place

Start with meal suggestions from saved preferences and receipt text extraction. Return editable drafts; the app validates and calculates costs in regular code. AI cannot reliably know pantry stock, current merchant prices, allergies hidden in products, people's availability, or linked-account benefits without supplied and verified information. Live recipe and merchant sources may be added later. Avoid a general chatbot as a required navigation step.

## Four-person implementation order

1. Frontend owner: simplify navigation, direct list entry, and the one-surface meal review. Preserve the approved visual direction.
2. Backend/data owner: shared household/list records, authorization, and participation scopes. Cross-device updates matter more than extra themes.
3. AI owner: one server-side meal-generation endpoint, then receipt extraction. Validate structured results, retain manual fallback, and label uncertainty.
4. Integration/QA owner: implement trip completion and exact-cent split review with the data owner; test the three everyday tasks on a phone with people outside the team.

These are roles, not claims about the teammates' experience. Coordinate API/data shapes before building in parallel.

## Cheap validation before adding features

Ask three people to add milk, claim a grocery trip, and record a mixed shared/personal purchase without instructions. Observe where they pause, backtrack, or ask what a label means. Measure the baseline and revised flow; no improvement percentage is established yet. Keep the next release focused on completing those tasks with fewer decisions.
