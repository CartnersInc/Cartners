Start with [the team workspace](docs/TEAM.md) for named owners, existing branches, and file boundaries.

# Working together

Clone this repository, use your existing work branch from the team guide, and open a pull request for each small completed change. Include what changed, a screenshot for UI changes, and the checks you ran. Avoid editing the same files at the same time; use the assigned GitHub issues and PRD v2 build order. Agree on docs/API_CONTRACT.md v2 and its fixtures before splitting frontend, backend, and AI work. Reconcile any locally started v1 callers before changing endpoints.

For the new React app, use [frontend/README.md](frontend/README.md). Its sample mode does not replace the shared backend; use one API URL for integration.

Run the static demo from the root with `python3 -m http.server 4173 --directory demo/dist`. It has no dependencies or build. Run `cd demo` then `npm test` for the model checks. Reload the browser after source edits.

`demo/dist/app.js` contains screens and interactions. `style.css` contains responsive styles. `model.js` contains sample data and money/list rules. Prototype view templates are compact; replace them with maintainable React components when moving to the production frontend rather than adding a second production system inside the demo.

The prototype stores data locally. Teammates share source code through GitHub; their running browsers do not share household data. Keep those two forms of collaboration distinct.

Keep API keys in backend environment variables. Do not commit .env files, credentials, uploaded personal receipts, or real household data. Use sample data in screenshots and tests. A paid AI provider is not required to run the current demo.
