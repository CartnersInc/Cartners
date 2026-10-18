# One shared live demo

`main` is the source of truth. Teammates build on their own branches and open pull requests; after a change is merged to `main`, GitHub Actions tests and deploys the React app to one stable URL:

**https://xaviergorriti.github.io/Groceries_fun_time_with_friends/**

Branch previews are not published. Each successful deployment replaces the previous live app at that URL, so the team always shares the current `main` build.

## One-time setup

GitHub Pages is not enabled yet. A repository admin must open [Settings → Pages](https://github.com/XavierGorriti/Groceries_fun_time_with_friends/settings/pages), set **Build and deployment → Source** to **GitHub Actions**, and save. Then open **Actions → Publish Cartners demo → Run workflow**, choose `main`, and run it once. Later pushes to `main` deploy automatically.

Ibrahiim has Write access, which cannot change the Pages setting. The existing `chatgpt.site` preview is a separate snapshot and can become stale; use the GitHub Pages URL as the team's shared demo once the first deployment succeeds.

## What the hosted demo needs

GitHub Pages serves the frontend only. To use live AI, Kroger lookup, and shared saved changes, deploy the FastAPI backend separately and set repository variable `VITE_API_BASE_URL` to its HTTPS origin under **Settings → Secrets and variables → Actions → Variables**. Keep Gemini and Kroger credentials in the backend host's secret settings; never place them in frontend variables or source code.

The old `demo/` and `prototypes/` folders are local references, not deployment targets. Do not share their local server URLs as the team demo.
