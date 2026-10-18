import workspace from '../../docs/fixtures/workspace.json';

const localActor = workspace.actors[0];
export const initialWorkspace = {
  ...workspace,
  preferences: { servings: 2, restrictions: [], likes: [], maxPrepMinutes: 30, spendingMode: 'split' },
  actors: [{ ...localActor, name: 'You' }],
  groups: [{ workspaceId: workspace.workspaceId, name: 'Your table', memberIds: [localActor.id], spendingMode: 'split' }],
  items: [], plans: [], expenses: [], balances: [], activity: [], trip: null,
};
export const starterPrompts = [
  { key: 'meal', label: 'Surprise me', message: 'Suggest a fun dinner for our group using our saved preferences.' },
  { key: 'refinement', label: 'A quick dinner', message: 'Suggest a dinner ready in 20 minutes, using our saved preferences.' },
  { key: 'groceries', label: 'Weekend groceries', message: 'Suggest a short grocery list for our weekend, using our saved preferences.' },
];
