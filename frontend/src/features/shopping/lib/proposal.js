// "Not here" (#4): the shopper moves a request the store doesn't carry off the current run.
// The backend supports it (punted field, API contract); the buttons stay behind
// VITE_PUNT_PROPOSAL=1 until the team turns the feature on by default.
export const PUNT_PROPOSAL = import.meta.env?.VITE_PUNT_PROPOSAL === '1';
