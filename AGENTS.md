# Cartners — team AI instructions

Read `docs/START_HERE.md`, `docs/TEAM.md`, `docs/PRD.md`, and `docs/API_CONTRACT.md` before implementation. They define the current scope, owners, and shared contract. The static `demo/` is a visual reference, not the production app.

- Identify the human teammate and their assigned issue/branch. Use their matching prompt in `docs/prompts/`. If identity is not supplied, inspect the current branch and ask only if ownership remains unclear.
- Preserve existing local changes and commits. Fetch/merge current main; never reset or force-push over another person's work.
- Build only the assigned slice. Respect the file boundaries in TEAM.md. One frontend scaffold (Ibrahiim), one backend entrypoint/schema/dependency owner (Xavier), feature UI (Suyash), provider services (Ethan).
- Use the current API contract and fictional fixtures; coordinate schema changes with affected owners. Never call fixture output live AI, real store prices, or completed payments.
- Prioritize the connected AI draft → confirmed cart → shared store-run path. No accounts, bank integration, scraping platform, or optional infrastructure before core acceptance.
- Keep secrets server-side and out of commits. Add focused checks for nontrivial logic, especially state conflicts, quantities, and money.
- Push only the assigned work branch. Open small PRs into main linked to assigned issues; leave merge to teammate review unless the human explicitly authorizes it.
- Report working behavior, checks, sample/unfinished behavior, and concrete handoffs. Do not claim the complete app works from isolated component checks.
