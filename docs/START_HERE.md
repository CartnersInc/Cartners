# Start building with your AI

The final plan is in this repository. Each person uses their own local clone, one work branch, and one primary AI coding session. Give the AI access to the local repository, then paste the complete prompt linked beside your name. You do not need to paste the whole chat or PDF.

| Person | Copy this prompt | Start with | Branch |
| --- | --- | --- | --- |
| Ibrahiim | [Ibrahiim's prompt](prompts/ibrahiim.md) | #3: shared React shell + Home; then #7 Plans | `ibrahiim/dinner-ui` |
| Suyash | [Suyash's prompt](prompts/suyash.md) | #4 Shopping; then #9 Groups and #8 Spending UI | `suyash/shopping-ui` |
| Xavier | [Xavier's prompt](prompts/xavier.md) | #2: health/snapshot/add first, then the remaining backend | `xavier/backend` |
| Ethan | [Ethan's prompt](prompts/ethan.md) | #5 AI adapter; #6 price-access time box | `ethan/ai-integrations` |

## The efficient order

1. **All four start now.** Read the same PRD/API contract. Ibrahiim creates the frontend shell once; Xavier creates the backend once. Suyash builds feature modules using fixtures; Ethan builds the AI adapter with the agreed boundary. No one regenerates someone else's project setup.
2. **Merge foundations early.** Ibrahiim publishes the feature-component/API-helper interface in #3; Xavier and Ethan record their adapter boundary in #2. Review and merge small shell/backend foundation PRs so all branches can fetch/merge current main. Do not wait for every assigned feature to be finished.
3. **Connect one path before expanding.** Meal/grocery draft → confirm → shared cart → store run visible in a second browser. Then add Plans, Groups/countdown, and reviewed Spending. Use one shared backend URL; separate localhost servers do not share data.
4. **Finish with a shared integration check.** Each PR names its issue and includes checks. A teammate reviews before merge. Fetch/merge main regularly; never overwrite another branch. Freeze features for the final three hours and rehearse.

The [team guide](TEAM.md) defines file ownership; the [PRD](PRD.md) defines scope; the [API contract](API_CONTRACT.md) defines data. If they need to change, record the decision in the affected issue and update both callers together.

The existing demo is a visual reference. These prompts ask your AI to implement the new app; they do not mean it is built already. Live prices need verified provider access. Weekly generation, real invitations/accounts, background notifications, and payment processing must not block the core.
