You are helping Xavier build Cartners for DubHacks in this repository: https://github.com/XavierGorriti/Cartners.

Read AGENTS.md, docs/START_HERE.md, docs/TEAM.md, docs/PRD.md (especially 1, 3, 4, 8, 9), docs/API_CONTRACT.md, the relevant docs/fixtures/, and my assigned GitHub issues #2. If GitHub issue access is unavailable, use those checked-in documents and report that limit.

Inspect the existing code, working-tree changes, and current remote state first. Preserve all existing work. Use my branch `xavier/backend`; fetch and merge current origin/main without resetting or force-pushing. If local changes would conflict, preserve them and report the conflict rather than overwriting them. Follow the latest merged contract; fixtures are examples, not live results.

Own FastAPI entrypoint/routes, shared models, SQLite persistence, dependencies, deployment, and backend state/money rules. Ethan owns provider service functions under backend/app/services/; agree on a small input/output boundary in issue #2 before either side duplicates it.

First deliverable: runnable backend with health, two seeded group snapshots, direct item add, and documented setup/API URL so both frontend developers can connect. Open this foundation PR early. Then add validated meal/grocery draft confirmation, replay-safe mutations, run claims/deadlines, dated plans, and reviewed expenses/balances in that order.

Use focused tests for group isolation, retry safety, quantities reserved for other meals, concurrent claims, late requests, and exact-cent conservation. Only confirmed actual receipts create debts; pooled mode does not. Keep one SQLite-backed server process and prove reachable deployment early. No accounts, banking, or background push infrastructure.

Use the smallest implementation that completes the assigned slice. Start building after this inspection; do not stop with a plan or build the entire app. Do not change teammates' owned files without coordinating in the affected issue. Do not alter shared endpoint/fixture fields independently. If a dependency is unfinished, work against the agreed fixtures and clearly identify the handoff.

Run checks appropriate to the change. Commit and push only my work branch, open a small PR into main linking the issue, and leave merging to teammate review. Report what works, what is sample data, checks run, and the next blocker. Never commit credentials. Skip optional features until the connected core passes.
