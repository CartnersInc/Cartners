// PROPOSAL, not part of API v2: "Not here" lets the shopper move a request the store doesn't
// carry off the current run. The field shape is proposed for Xavier in issue #4. It stays off
// unless VITE_PUNT_PROPOSAL=1, so the default build never sends the unagreed `punted` field.
export const PUNT_PROPOSAL = import.meta.env?.VITE_PUNT_PROPOSAL === '1';
