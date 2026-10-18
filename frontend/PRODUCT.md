# Common product context

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-selected React/Vite frontend, Python/FastAPI backend, SQL. Backend/provider implementation belongs to other teammates; PRD v2 chooses SQLite for the hackathon.

## Users and purpose
Families, roommates, and other groups deciding meals and coordinating shared grocery requests. Help carry a request into a reviewed draft, shared cart, store run, and optional actual-purchase record. Diners and people splitting expenses are not necessarily the same people.

## Confirmed constraints
The user requested an AI-first input, few manual steps, all five areas (Home, Plans, Shopping, Spending, Groups), and a hackathon-sized build. Preserve the existing warm green visual direction. No required photo/event/account setup. This branch owns the shared frontend shell, Home, and Plans/preferences only; teammates own the remaining screens, backend, and provider services.

## Evidence and limits
The scope source is ../docs/FINAL_BRAINSTORM.md and ../docs/PRD.md. Fictional fixtures live in ../docs/fixtures/. The older static demo in ../demo/dist/ provides visual authority; its interactions are superseded by PRD v2. No measured time/money savings, live prices, real payments, or live AI are established by samples.

## Product principles
Start with the user's request. Reuse context. Confirm consequential changes once. Show sample/stale/error states truthfully. Keep simple direct entry available in the teammate-owned cart.

## Accessibility
Labeled keyboard-operable controls, visible focus, at least 44px controls, no phone overflow, and reduced-motion support as specified by the PRD.
