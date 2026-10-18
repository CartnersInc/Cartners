# Cartners on Photon 2.0

A small Node service that puts Cartners in the household iMessage thread. Spectrum (`spectrum-ts`) is the live path. Dad or a roommate texts that they are going to the store; Cartners starts a real store run on the shared FastAPI cart. Other people text “need milk” and it joins that run. Meal ideas still require an explicit “add it” before anything hits the list.

The older Photon 2.0 poller remains as `npm run start:beta`.

## Household thread

From an allowed number, text the Cartners iMessage line:

- **Going to QFC — what do you guys need?** starts a 10-minute store run and reads the current cart.
- **Need milk and eggs** adds those requests (joins the open run when the window is still open).
- **Tacos for four** sends a meal draft. Reply **add it** to confirm, or **not now**.
- **What’s on the list?** reads the cart without changing it.
- **Done shopping** finishes the run. Unbought items stay for next time.

Unknown senders are ignored. Secrets stay in this service’s `.env`; never put them in React or GitHub Pages. Free-plan users text the `assignedPhoneNumber` on their Spectrum user record.

## Run locally

```sh
cd photon-agent
npm install
cp .env.example .env
```

Map every permitted iPhone to a Cartners actor ID. Run the shared FastAPI backend, point `CARTNERS_API_URL` at it, then:

```sh
npm start
```

This service calls `GET /api/workspace`, `POST /api/items`, `PATCH /api/trip`, `POST /api/suggestions`, and `POST /api/drafts/confirm`. It does not keep a second cart. GitHub Pages does not run it; keep this process up during a demo.

The agent stores pending drafts under `.runtime/` so message retries do not double-write. All configured senders currently share one `CARTNERS_WORKSPACE_ID`.
