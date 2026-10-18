import workspace from '../../docs/fixtures/workspace.json';
import meal from '../../docs/fixtures/suggestions.json';
import refinement from '../../docs/fixtures/refinement.json';
import groceries from '../../docs/fixtures/groceries.json';
import clarification from '../../docs/fixtures/clarification.json';

export const initialWorkspace = workspace;
export const sampleDrafts = { meal, refinement, groceries, clarification };
export const samplePrompts = [
  { key: 'meal', label: 'Something fun for dinner' },
  { key: 'groceries', label: 'Milk for Sam & paper plates' },
  { key: 'clarification', label: 'Chicken for dinner' },
];
