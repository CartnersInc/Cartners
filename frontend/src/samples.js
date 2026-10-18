import workspace from '../../docs/fixtures/workspace.json';
import meal from '../../docs/fixtures/suggestions.json';
import refinement from '../../docs/fixtures/refinement.json';
import groceries from '../../docs/fixtures/groceries.json';
import clarification from '../../docs/fixtures/clarification.json';

export const initialWorkspace = workspace;
export const sampleDrafts = { meal, refinement, groceries, clarification };
export const starterPrompts = [
  { key: 'meal', label: 'Surprise me', message: 'Suggest a fun dinner for our group using our saved preferences.' },
  { key: 'refinement', label: 'A quick dinner', message: 'Suggest a dinner ready in 20 minutes, using our saved preferences.' },
  { key: 'groceries', label: 'Weekend groceries', message: 'Suggest a short grocery list for our weekend, using our saved preferences.' },
];
