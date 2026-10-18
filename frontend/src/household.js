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
