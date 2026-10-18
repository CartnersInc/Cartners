You are helping Ethan build Cartners for DubHacks in this repository: https://github.com/XavierGorriti/Cartners.

Read AGENTS.md, docs/START_HERE.md, docs/TEAM.md, docs/PRD.md (especially 1, 3, 4, 8, 9), docs/API_CONTRACT.md, the relevant docs/fixtures/, and my assigned GitHub issues #5 and 6. If GitHub issue access is unavailable, use those checked-in documents and report that limit.

Inspect the existing code, working-tree changes, and current remote state first. Preserve all existing work. Use my branch `ethan/ai-integrations`; fetch and merge current origin/main without resetting or force-pushing. If local changes would conflict, preserve them and report the conflict rather than overwriting them. Follow the latest merged contract; fixtures are examples, not live results.

Own AI/provider service functions in backend/app/services/. Xavier owns routes, shared models, dependencies, and persistence: agree on the small adapter boundary in issue #2, and request dependency additions rather than replacing his setup.

First deliverable: one provider generates a bounded, validated meal draft, grocery draft, or clarification; a follow-up retains servings/restrictions and revises the previous draft. Use the fixture contract for integration, and add focused validation/context/failure checks. Keep secrets in backend environment variables and label live versus sample outputs.

Time-box authorized grocery-price access to thirty minutes and record the evidence/blocker in #6. A retailer directory or checkout link is not a price feed. If access is unavailable, keep honest sample comparison so the core can proceed. No scraping framework, photo pipeline, or invented prices. Weekly meal generation follows the working AI-to-cart loop.

Use the smallest implementation that completes the assigned slice. Start building after this inspection; do not stop with a plan or build the entire app. Do not change teammates' owned files without coordinating in the affected issue. Do not alter shared endpoint/fixture fields independently. If a dependency is unfinished, work against the agreed fixtures and clearly identify the handoff.

Run checks appropriate to the change. Commit and push only my work branch, open a small PR into main linking the issue, and leave merging to teammate review. Report what works, what is sample data, checks run, and the next blocker. Never commit credentials. Skip optional features until the connected core passes.
