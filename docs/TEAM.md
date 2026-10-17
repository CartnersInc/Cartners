# Team workspace — final brainstorm

Repository: https://github.com/XavierGorriti/Groceries_fun_time_with_friends

Read [PRD v2 sections 1, 3, 4, and 9](PRD.md), then agree on the [API contract v2](API_CONTRACT.md) and [fixtures](fixtures/). The [final brainstorm](FINAL_BRAINSTORM.md) is the scope source. The static demo is a visual reference; the new React/FastAPI app still needs building.

Five pages are places to find things, not five required steps. Build the connected AI → confirmed cart → shared store-run path first. Keep thin Plans, Spending, and Groups views; attempt weekly generation and background push only after core acceptance.

## Owners, assigned tasks, and work branches

| Person | Ownership and assigned GitHub issues | Existing work branch |
| --- | --- | --- |
| Ibrahiim · @ibrahiimmuhamud | [Home and shared React shell #3](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/3); [Plans and preferences #7](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/7) | `ibrahiim/dinner-ui` |
| Suyash · @sdpandit | [Shopping #4](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/4); [Spending UI #8](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/8); [Groups and countdown #9](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/9) | `suyash/shopping-ui` |
| Xavier · @XavierGorriti | [FastAPI, SQLite, group/run state, plans, expense calculations and deployment #2](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/2) | `xavier/backend` |
| Ethan · @chocbox2 | [AI meal/grocery/refinement drafts #5](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/5); [authorized price access and integration #6](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/issues/6) | `ethan/ai-integrations` |

Issues contain acceptance criteria and handoffs. Suyash builds the three thin UI areas in sequence, not three simultaneous projects; Xavier supplies their shared routes and money calculations. Ibrahiim finishes shell/Home before Plans. Ethan connects live AI before optional weekly generation. Rebalance a task together if someone finishes early.

Each teammate uses their own local clone. GitHub shares code; shared household data requires Xavier's common backend URL.

## Start your copy

```sh
git clone https://github.com/XavierGorriti/Groceries_fun_time_with_friends.git
cd Groceries_fun_time_with_friends
git switch YOUR-BRANCH-FROM-THE-TABLE
```

The branches already exist remotely. Replace the last line with your branch, for example `git switch suyash/shopping-ui`. Keep existing commits and work. Once the PRD v2 pull request is merged, fetch and merge `origin/main` into your branch before using the new contract. In particular, v2 uses `/api/drafts/confirm` instead of `/api/meals/confirm`; coordinate any locally started callers.

The old demo runs with `python3 -m http.server 4173 --directory demo/dist`. Follow the new frontend/backend setup when their owners add it; no production app is present yet.

## File boundaries

- Ibrahiim creates the Vite package once. Own `frontend/package.json`, lockfile, Vite config, `frontend/src/App.jsx`, shared styles, and `frontend/src/api/`; build Home and Plans under `frontend/src/features/home/` and `frontend/src/features/plans/`.
- Suyash owns `frontend/src/features/shopping/`, `frontend/src/features/spending/`, and `frontend/src/features/groups/`. Start against fixtures. Coordinate shell hookups with Ibrahiim; do not generate a second frontend or replace shared package/config files.
- Xavier owns backend entrypoint, shared request/response models, SQLite, routes, dependency file, and deployment under `backend/`. Test group isolation, concurrent claims, run deadlines, retry safety, and exact-cent allocations.
- Ethan owns AI/provider functions under `backend/app/services/`. Agree on function boundaries with Xavier; do not independently replace routes or shared models. Server code calculates money/package costs from validated data.
- Record schema changes in the affected issue before editing fields; change the contract, fixture, and callers together. Never commit provider keys or real private household data.

These are coordination conventions, not enforced file permissions.

## One task, one pull request

1. Start the assigned issue on your work branch. Keep the first change small enough to review.
2. Push and open a PR into `main`, link its issue, describe working behavior and limits, and include a screenshot for UI changes.
3. Ask one teammate to review before merging. This is a team convention; this setup does not configure branch protection.
4. Before the next handoff, incorporate `main`:

```sh
git fetch origin
git merge origin/main
```

Resolve conflicts with the relevant owner. Do not overwrite another person's work or force-push over it.

## Integration checkpoints

- First: agree on v2 shapes; one frontend shell and backend health/snapshot route run on reachable URLs; seed two groups. Time-box price access to thirty minutes.
- First connected slice: meal or grocery draft → one confirmation → shared cart → another browser starts a store run. No polished secondary screens needed yet.
- Next: live AI/refinement, dated Plans, group switching, request countdown, and actual-total Spending. Test personal/shared requests, run concurrency, and exact-cent splits as they arrive.
- Test both a family (four diners, two adults, pooled spending) and roommates (selected participants, personal exceptions). Opening a payment link must never mark a debt paid.
- Final three hours: freeze features, run PRD acceptance checks, fix material failures, rehearse and record a fallback. Confirm actual time remaining rather than restarting an eighteen-hour clock.

## Price access gate

Ethan must prove an authorized source returns store/location, matching product, package size/unit, actual price, and retrieval time. Nearby retailer names or checkout links alone do not prove price access.

With verified access, implement one provider and document coverage. Without it, record the blocker and use visibly labeled sample comparisons. Rank complete comparable baskets, disclose missing products/fees, and never claim universal cheapest or guaranteed stock. This must not delay the shared-list core.

## Communication

Use the existing group chat for quick coordination. Record blockers, contract changes, and review decisions in GitHub Issues/PRs so everyone can find them. No separate task board or project-management setup is needed to start.
