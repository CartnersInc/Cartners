# Cartners on Photon 2.0

A small, separate Node service that lets an approved household member ask Cartners for a meal or grocery idea in a Photon conversation. It sends the idea and cart preview to that conversation, then changes the shared cart only after an explicit “add it” reply. “Not now” leaves the cart alone. This uses Photon 2.0 beta (`@photon-ai/api`), not the older Spectrum SDK.

## Set up the channel

Create a Photon 2.0 beta project in the [Photon dashboard](https://app.beta.photon.codes), then create a project API key with `project:read` and `project:write`. Configure an iMessage line in the project and note the agent handle Photon assigns. Keep the API key in this service’s `.env`; never put it in React, a screenshot, or GitHub source.

Photon’s beta setup distinguishes shared iMessage lines from group chat: a shared line may only send in direct conversations, while the hackathon requires a dedicated iMessage line for group chats. Confirm the line type in the dashboard before testing the group flow. Telegram is another Photon channel the agent can use by setting `PHOTON_PLATFORM=telegram` and supplying the Telegram agent handle.

## Run locally

```sh
cd photon-agent
npm install
cp .env.example .env
```

Edit `.env` with the Photon project/key/line, the real seeded Cartners workspace ID, and each permitted tester’s Photon handle plus matching Cartners actor ID. The allowlist prevents an unknown sender from adding items to the shared cart. Run the shared FastAPI backend in another terminal, point `CARTNERS_API_URL` at it, then start the agent:

```sh
npm start
```

In the configured Photon conversation, try **“What should we eat tonight?”** Cartners replies with one meal idea and a proposed cart change. Reply **“Add it”** to confirm. Try **“Not now”** to leave the cart unchanged. Messages unrelated to food are ignored unless someone addresses `@Cartners`.

## Backend requirement

This service calls the shared API contract routes `POST /api/suggestions` and `POST /api/drafts/confirm`. The current `main` branch still has the earlier temporary `/api/ai/*` preview endpoints, which cannot save or confirm shared drafts. The Photon flow becomes end-to-end only after the shared v2 backend routes are deployed and `CARTNERS_API_URL` points to that backend. This package does not implement a second database, AI provider, or cart.

The agent keeps a small local cursor/draft file under `.runtime/` so message retries do not repeat cart writes. For a shared deployment, mount persistent storage for that path or replace it with an agreed durable store. The current demo maps all configured Photon conversations to one seeded Cartners workspace.
