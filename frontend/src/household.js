export function householdKind(workspace, membership) {
  const saved = membership?.kind;
  if (saved && saved !== 'other' && (!membership.workspaceId || membership.workspaceId === workspace?.workspaceId)) return saved;
  const fromPrefs = workspace?.preferences?.householdKind;
  if (fromPrefs && fromPrefs !== 'other') return fromPrefs;
  const fromGroup = workspace?.groups?.find(group => group.workspaceId === workspace?.workspaceId)?.kind;
  if (fromGroup && fromGroup !== 'other') return fromGroup;
  if (workspace?.workspaceId === 'demo-roommates') return 'roommates';
  if (workspace?.workspaceId === 'demo-family') return 'family';
  if (workspace?.preferences?.spendingMode === 'split') return 'roommates';
  return 'family';
}

export function isFamilyTable(workspace, membership) {
  return householdKind(workspace, membership) === 'family';
}

export function splitsCosts(workspace) {
  return (workspace?.preferences?.spendingMode || workspace?.groups?.find(group => group.workspaceId === workspace?.workspaceId)?.spendingMode) === 'split';
}

// Fictional demo handles (same as the backend seed). Used only when the snapshot has none.
const SAMPLE_PAY_LINKS = {
  leila: { venmo: 'leila-p', paypal: 'leilap', zelle: 'leila@example.com' },
  sam: { venmo: 'sam-k', cashapp: 'samk' },
  jordan: { paypal: 'jordanm' },
  maya: { venmo: 'maya-r' },
};

export function withMemberPayLinks(workspace, membership) {
  if (!workspace) return workspace;
  const mine = membership?.workspaceId === workspace.workspaceId && membership?.payLinks && typeof membership.payLinks === 'object'
    ? membership.payLinks
    : null;
  return {
    ...workspace,
    actors: (workspace.actors || []).map(actor => {
      if (actor.payLinks && Object.keys(actor.payLinks).length > 0) return actor;
      if (actor.id === membership?.actorId && mine) return { ...actor, payLinks: mine };
      if (membership?.demo && SAMPLE_PAY_LINKS[actor.id]) return { ...actor, payLinks: SAMPLE_PAY_LINKS[actor.id] };
      return actor;
    }),
  };
}
