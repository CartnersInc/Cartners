// Preview-only split math. Confirmed cents still come from POST /api/expenses.

export function lastConfirmedSplit(expenses) {
  return [...(expenses || [])].reverse().find(expense => expense.status === 'confirmed' && expense.mode === 'split') || null;
}

export function rememberedSharers(workspace, memberIds) {
  const allowed = new Set(memberIds);
  const last = lastConfirmedSplit(workspace?.expenses);
  const fromLast = (last?.sharedMemberIds || []).filter(id => allowed.has(id));
  return fromLast.length ? fromLast : memberIds.filter(id => allowed.has(id));
}

export function rememberedPayer(workspace, memberIds, run) {
  const allowed = new Set(memberIds);
  if (run?.claimedBy && allowed.has(run.claimedBy)) return run.claimedBy;
  const last = lastConfirmedSplit(workspace?.expenses);
  if (last?.payerId && allowed.has(last.payerId)) return last.payerId;
  return '';
}

export function unrecordedRuns(runs, expenses) {
  const recorded = new Set((expenses || []).map(expense => expense.runId).filter(Boolean));
  return (runs || []).filter(run => run?.id && !recorded.has(run.id));
}

export function allocateSplit(totalCents, sharedMemberIds, personalAllocations = {}) {
  if (!Number.isInteger(totalCents) || totalCents < 0) return null;
  const known = {};
  let personal = 0;
  for (const [id, amount] of Object.entries(personalAllocations)) {
    if (amount == null) return null;
    if (!Number.isInteger(amount) || amount < 0) return null;
    known[id] = amount;
    personal += amount;
  }
  if (personal > totalCents) return null;
  const remainder = totalCents - personal;
  const shared = [...sharedMemberIds];
  if (remainder > 0 && !shared.length) return null;
  const allocations = {};
  for (const id of shared) allocations[id] = 0;
  for (const [id, amount] of Object.entries(known)) allocations[id] = (allocations[id] || 0) + amount;
  if (shared.length && remainder) {
    const base = Math.floor(remainder / shared.length);
    const extra = remainder % shared.length;
    [...shared].sort().forEach((id, index) => {
      allocations[id] = (allocations[id] || 0) + base + (index < extra ? 1 : 0);
    });
  }
  const sum = Object.values(allocations).reduce((total, cents) => total + cents, 0);
  if (sum !== totalCents) return null;
  return allocations;
}
