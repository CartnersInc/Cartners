# Shared team demo

**[Open the shared demo](https://common-table-household-demo.crisp-tide-4075.chatgpt.site)**

Anyone with the link can view the published frontend. No account is needed. Until Xavier’s backend and Ethan’s AI service are connected, the app uses explicitly labeled sample responses; it does not share saved cart data between visitors.

## Automatic updates from GitHub

The `Publish Cartners demo` workflow deploys the React frontend to GitHub Pages when frontend code or shared fixtures reach `main`. It runs unit checks before building, and uses the repository path for assets. Local edits and unmerged feature branches are not published.

Xavier, or someone with repository administration access, needs to complete this setup once:

1. Review and merge frontend PR #11 when the team is ready.
2. Open [repository Settings → Pages](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/settings/pages) and choose **GitHub Actions** as the build source. Enable Actions if the repository has disabled them.
3. Open **Actions → Publish Cartners demo → Run workflow**, choose `main`, and run it if the initial merge happened before Pages was enabled.
4. Share the deployment URL shown by the successful workflow. Future changes merged into `main` update that same Pages URL. Refresh the page after deployment to see them.

Ibrahiim’s current GitHub access is Write, which is sufficient to push the workflow but cannot enable Pages. GitHub rejected Pages configuration, so the public Sites link above provides a working preview immediately. That Sites link is a published snapshot; it requires republishing and does not automatically follow GitHub commits. Use the Pages URL once the owner enables automatic deployment.

## Connect the shared backend

Deploy the FastAPI backend separately to an HTTPS address. In **Settings → Secrets and variables → Actions → Variables**, set the repository variable `VITE_API_BASE_URL` to that backend origin, then rerun the workflow. The backend must permit the exact Pages frontend origin through CORS. This is build-time configuration; changing it requires another deployment.

Provider keys belong only in the backend environment. Never put an AI key in a `VITE_` variable, frontend source, or GitHub commit. The development proxy does not run on the hosted site.

Before claiming shared collaboration works, open the same workspace from two devices and verify a confirmed cart change appears on both. Before claiming live AI works, verify a new request reaches Ethan’s provider rather than a fixture.
