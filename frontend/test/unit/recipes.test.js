import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeLookup, recipeLabel } from '../../src/features/shopping/lib/recipes.js';

const plan = (id, title, requestFor, ingredient) => ({ id, title, recommendation: { requestFor, ingredients: [ingredient] } });

test('cart recipe labels include compatible saved meals but exclude unrelated requests', () => {
  const workspace = { plans: [
    plan('tacos', 'Tacos', 'household', { name: 'Lime', unit: 'count' }),
    plan('curry', 'Curry', 'household', { name: 'lime', unit: 'count' }),
    plan('juice', 'Juice', 'household', { name: 'Lime', unit: 'ml' }),
    plan('personal', 'Personal drink', 'leila', { name: 'Lime', unit: 'count' }),
  ] };
  const recipesFor = recipeLookup(workspace);

  assert.equal(recipeLabel(recipesFor({ name: 'lime', unit: 'count', requestFor: 'household', reservedPlanId: 'tacos' })), 'Tacos, Curry');
  assert.deepEqual(recipesFor({ name: 'Lime', unit: 'count', requestFor: 'household' }), []);
});
