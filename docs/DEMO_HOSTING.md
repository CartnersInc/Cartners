# One shared live demo

`main` is the source of truth. Teammates build on their own branches and open pull requests; every push to `main` runs frontend checks and deploys the app to one stable public URL:

**https://xaviergorriti.github.io/Cartners/**

Branch previews are not published. Each successful deployment replaces the previous live app at that URL, so the team shares the current `main` build. The first deployment is live; no additional setup is needed.

## What the hosted demo needs

GitHub Pages serves the frontend only. To use live AI, Kroger lookup, and shared saved changes, deploy the FastAPI backend separately and set repository variable `VITE_API_BASE_URL` to its HTTPS origin under **Settings → Secrets and variables → Actions → Variables**. Keep Gemini and Kroger credentials in the backend host's secret settings; never place them in frontend variables or source code.

The old `demo/` and `prototypes/` folders are local references, not deployment targets. Do not share their local server URLs as the team demo.
