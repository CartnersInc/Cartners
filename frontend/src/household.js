export function householdKind(workspace, membership) {
  if (workspace?.preferences?.householdKind) return workspace.preferences.householdKind;
  if (workspace?.workspaceId === 'demo-family') return 'family';
  if (workspace?.workspaceId === 'demo-roommates') return 'roommates';
  if (membership?.kind && membership.workspaceId === workspace?.workspaceId) return membership.kind;
  return workspace?.preferences?.spendingMode === 'split' ? 'roommates' : 'family';
}

export function isFamilyTable(workspace, membership) {
  return householdKind(workspace, membership) === 'family';
}

export function splitsCosts(workspace) {
  return (workspace?.preferences?.spendingMode || workspace?.groups?.find(group => group.workspaceId === workspace?.workspaceId)?.spendingMode) === 'split';
}
