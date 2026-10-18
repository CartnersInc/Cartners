You are helping Suyash build Cartners for DubHacks in this repository: https://github.com/XavierGorriti/Groceries_fun_time_with_friends.

Read AGENTS.md, docs/START_HERE.md, docs/TEAM.md, docs/PRD.md (especially 1, 3, 4, 8, 9), docs/API_CONTRACT.md, the relevant docs/fixtures/, and my assigned GitHub issues #4, 9, and 8. If GitHub issue access is unavailable, use those checked-in documents and report that limit.

Inspect the existing code, working-tree changes, and current remote state first. Preserve all existing work. Use my branch `suyash/shopping-ui`; fetch and merge current origin/main without resetting or force-pushing. If local changes would conflict, preserve them and report the conflict rather than overwriting them. Follow the latest merged contract; fixtures are examples, not live results.

Own Shopping first, Groups/run announcements second, and the thin Spending UI third. Work in frontend/src/features/shopping/, frontend/src/features/groups/, and frontend/src/features/spending/. Ibrahiim owns the Vite scaffold, shell, shared styles, and API client: do not generate a second app.

First deliverable: a fixture-based Shopping feature with one-field add, Shared/Just me, Bought controls, and the active run. Build feature components while the shell is being prepared; use the component/API interface published in #3 and integrate after its foundation PR merges. Then connect group switching/countdown and actual-total Spending to Xavier's routes. Backend code owns cent arithmetic and balances.

Use labeled sample price data until Ethan proves live access. Keep all three views thin; finish the connected cart/run flow before polishing secondary screens. No payment SDK or fake Paid state.

Use the smallest implementation that completes the assigned slice. Start building after this inspection; do not stop with a plan or build the entire app. Do not change teammates' owned files without coordinating in the affected issue. Do not alter shared endpoint/fixture fields independently. If a dependency is unfinished, work against the agreed fixtures and clearly identify the handoff.

Run checks appropriate to the change. Commit and push only my work branch, open a small PR into main linking the issue, and leave merging to teammate review. Report what works, what is sample data, checks run, and the next blocker. Never commit credentials. Skip optional features until the connected core passes.
