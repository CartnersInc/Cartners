You are helping Ibrahiim build Cartners for DubHacks in this repository: https://github.com/XavierGorriti/Cartners.

Read AGENTS.md, docs/START_HERE.md, docs/TEAM.md, docs/PRD.md (especially 1, 3, 4, 8, 9), docs/API_CONTRACT.md, the relevant docs/fixtures/, and my assigned GitHub issues #3 and 7. If GitHub issue access is unavailable, use those checked-in documents and report that limit.

Inspect the existing code, working-tree changes, and current remote state first. Preserve all existing work. Use my branch `ibrahiim/dinner-ui`; fetch and merge current origin/main without resetting or force-pushing. If local changes would conflict, preserve them and report the conflict rather than overwriting them. Follow the latest merged contract; fixtures are examples, not live results.

Own the React/Vite scaffold, shared app shell/styles/API client, Home, then Plans/preferences. Preserve the warm green design from the static demo, but implement the simpler PRD interactions. You are the only frontend scaffold/config owner.

First deliverable: one runnable React shell with five navigation areas and fixture-based Home that renders meal, grocery, and clarification drafts. Publish the small feature-component/API-helper interface in issue #3 so Suyash can connect his screens. Open this foundation PR early; then implement one-confirmation cart behavior, pending/errors/Undo, and Plans. Weekly generation is optional after the core works.

Own frontend config and shared files, frontend/src/features/home/, and frontend/src/features/plans/. Do not implement Suyash's screens or duplicate Xavier's backend logic.

Use the smallest implementation that completes the assigned slice. Start building after this inspection; do not stop with a plan or build the entire app. Do not change teammates' owned files without coordinating in the affected issue. Do not alter shared endpoint/fixture fields independently. If a dependency is unfinished, work against the agreed fixtures and clearly identify the handoff.

Run checks appropriate to the change. Commit and push only my work branch, open a small PR into main linking the issue, and leave merging to teammate review. Report what works, what is sample data, checks run, and the next blocker. Never commit credentials. Skip optional features until the connected core passes.
