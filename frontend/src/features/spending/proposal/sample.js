// PROPOSAL SAMPLE (#8), not part of API v2 or docs/fixtures. Fictional per-trip settlements and
// payment profiles for the Payments and Your profile tabs. If the proposal is agreed, this shape moves
// into the contract/fixtures and these tabs read workspace.settlements and actor.payProfiles instead.
// The server would compute every amount here; the UI only displays them.
export const proposalSample = {
  settlements: [
    {
      id: 'settle-tj', runId: 'run-tj', storeName: "Trader Joe's", finishedAt: '2026-10-17T19:30:00Z',
      receiptTotalCents: 3645, from: 'leila', to: 'sam', cents: 1215, status: 'open',
      breakdown: { sharedCents: 940, sharedNote: '1/3 of $28.20 shared', personalCents: 249, personalItems: ['Hot sauce'], feesCents: 26 },
    },
    {
      id: 'settle-safeway', runId: 'run-safeway', storeName: 'Safeway', finishedAt: '2026-10-14T18:05:00Z',
      receiptTotalCents: 2000, from: 'sam', to: 'leila', cents: 1300, status: 'open',
      breakdown: { sharedCents: 700, sharedNote: '1/2 of $14.00 shared', personalCents: 600, personalItems: ['Oat milk'], feesCents: 0 },
    },
    {
      id: 'settle-qfc', runId: 'run-qfc', storeName: 'QFC', finishedAt: '2026-10-11T17:40:00Z',
      receiptTotalCents: 2175, from: 'leila', to: 'sam', cents: 725, status: 'received', receivedAt: '2026-10-12T09:15:00Z',
      breakdown: { sharedCents: 725, sharedNote: '1/3 of $21.75 shared', personalCents: 0, personalItems: [], feesCents: 0 },
    },
  ],
  payProfiles: {
    sam: { venmo: 'sam-k', cashapp: 'samk' },
    leila: { venmo: 'leila-p', paypal: 'leilap', zelle: 'leila@example.com' },
  },
};
