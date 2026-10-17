# Team workspace

Repository: https://github.com/XavierGorriti/Groceries_fun_time_with_friends

Start with [PRD sections 1, 5, 6, and 11](PRD.md), then use the [API contract](API_CONTRACT.md) and [fixtures](fixtures/). The current static demo is a visual reference; the new React/FastAPI app still needs building.

## Owners and work branches

| Person | GitHub | Owns | Work branch |
| --- | --- | --- | --- |
| Ibrahiim | @ibrahiimmuhamud | Dinner interface, React/Vite shell, shared frontend integration | `ibrahiim/dinner-ui` |
| Suyash | @sdpandit | Shopping interface and trip controls | `suyash/shopping-ui` |
| Xavier | @XavierGorriti | FastAPI routes, SQLite, shared state and backend deployment | `xavier/backend` |
| Ethan | @chocbox2 | AI meal generation/refinement and grocery-price API investigation | `ethan/ai-integrations` |

Each teammate has their own local clone. GitHub shares source code; it does not make separately running browsers share household data. Use Xavier's shared backend URL for the two-browser integration check.

## Start your copy

```sh
git clone https://github.com/XavierGorriti/Groceries_fun_time_with_friends.git
cd Groceries_fun_time_with_friends
git switch YOUR-BRANCH-FROM-THE-TABLE
```

The branches already exist remotely. Replace the final line with your branch, for example `git switch suyash/shopping-ui`. Do not create a second copy of someone else's branch.

The old demo runs with `python3 -m http.server 4173 --directory demo/dist`. Follow the new frontend/backend setup instructions once their owners add them; there is no production application to install yet.

## File boundaries

- Ibrahiim creates the Vite package and shared frontend shell first. Own `frontend/package.json`, lockfile, Vite config, `src/App.jsx`, shared styles, and `src/api/`. Build dinner components in `frontend/src/features/dinner/`.
- Suyash starts in `frontend/src/features/shopping/` against the JSON fixtures. Do not independently run a second frontend generator or replace the shared App/package files. Coordinate the small shell hookup with Ibrahiim.
- Xavier creates the backend entrypoint, shared request/response models, database code, and HTTP routes under `backend/`. Own the dependency file and backend configuration.
- Ethan builds AI/provider code in `backend/app/services/`. Coordinate the function boundary with Xavier before wiring it into routes; do not independently replace the server entrypoint or shared models.
- Discuss a fixture/schema change in its GitHub issue before changing field names. Update the example and both affected callers together. No provider keys, real receipts, or private household data in commits.

These are coordination conventions, not GitHub-enforced file permissions. Swap roles together if another allocation suits the team's experience better.

## One task, one pull request

1. Choose your assigned issue and start on your branch.
2. Keep the first change small enough to review: shell, component, endpoint, or validated AI adapter.
3. Commit and push your branch. Open a PR into `main`, link its issue, describe what actually works, and include a screenshot for UI changes.
4. Ask one teammate to review it before merging. Use the PR template; report unfinished or simulated behavior honestly.
5. Incorporate `main` before the next handoff:

```sh
git fetch origin
git merge origin/main
```

Resolve conflicts with the other file owner; do not overwrite their work or force-push over it. Each person pushes only their own branch. The review rule is a team convention; branch protection is not configured by this setup.

## Integration checkpoints

- First hour: frontend shell and backend health route run; agree on request/response shapes and reachable deployment URLs.
- First usable loop: fixtures render a meal and shopping list; adding an item through the backend appears in two browsers.
- Next: live AI recommendation and a contextual refinement; Make this commits the shared list; exactly one shopper can claim the trip.
- Test one family scenario (four diners, two adults using the app) and one roommate scenario (only part of the household eating). No accounts or payment integration.

## Grocery pricing: prove access before promising it

Ethan owns a separate 30-minute access check. Success means an authorized source returns a specific store/location, matching product, package quantity/unit, actual price, and retrieval time. Nearby-retailer discovery or a shopping-list checkout link alone is not proof of product-price access.

If verified, document coverage and limits, then agree on a small price response shape with Xavier before implementation. Compare actual packages needed, preserve restrictions, and default to a complete basket at one store. Claim only the lowest-priced basket among checked stores. Missing prices and fees must remain visible.

If access is not available in the time box, record the blocker and use visibly labeled sample prices. No scraping project, multi-provider framework, or invented live prices. Grocery pricing is a gated extension to the PRD; it must not delay the live AI-to-shared-list core.

## Communication

Use your existing group chat for quick coordination. Put tasks, blockers, API decisions, and review conclusions in GitHub Issues or PRs so all four people can find them. Do not rely on a private chat agreement that changes the shared contract without recording it.
