// Reads store-run state from the v2 snapshot. Nothing here changes state; the server owns it.

// The current run, or null when nobody is shopping.
export function activeTrip(workspace) {
  const trip = workspace.trip;
  if (!trip || !trip.claimedBy) return null;
  if (['finished', 'released', 'completed'].includes(trip.state)) return null;
  return trip;
}

export function acceptingRequests(trip, serverNowMs) {
  return !!trip?.requestDeadlineAt && serverNowMs < Date.parse(trip.requestDeadlineAt);
}

export const liveItems = workspace => (workspace.items || []).filter(item => !item.removed);

// Where a request stands relative to the current run, for its label.
export function itemBadge(item, trip, actorId) {
  // Proposal (#4): a request the shopper couldn't find stays labeled until someone buys it.
  if (item.punted && !item.bought) {
    return item.punted.runId === trip?.id
      ? { kind: 'punted', text: `Not at ${item.punted.storeName}, moved to the next run` }
      : { kind: 'punted', text: `Not found at ${item.punted.storeName} last time` };
  }
  if (!trip || item.bought) return null;
  const afterStart = trip.claimedAt && Date.parse(item.createdAt) > Date.parse(trip.claimedAt);
  if (item.runId === trip.id && afterStart) return { kind: 'new', text: trip.claimedBy === actorId ? 'New since you started' : 'Added after the run started' };
  if (item.runId !== trip.id) return { kind: 'next', text: 'Next run' };
  return null;
}

// Last store this group went to, for the start-run sheet.
export function lastStore(workspace) {
  const completed = workspace.trip?.completedTrips;
  const recent = Array.isArray(completed) ? completed[completed.length - 1] : null;
  return workspace.trip?.storeName || recent?.storeName || '';
}
