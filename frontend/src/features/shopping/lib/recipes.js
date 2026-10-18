// Which saved recipes a cart request is for, for display only. A request is linked to a plan
// when the server reserved it for that plan (reservedPlanId), or when a saved plan lists an
// ingredient with the same name. One request can serve several recipes.

const norm = value => String(value || '').trim().toLowerCase();
export const recipeTitle = plan => plan.title || plan.recommendation?.title || plan.event || 'Saved meal';
const ingredientsOf = plan => plan.recommendation?.ingredients || plan.plan?.ingredients || plan.ingredients || [];

export function recipeLookup(workspace) {
  const plans = workspace.plans || [];
  const byId = new Map(plans.map(plan => [plan.id, plan]));
  const index = plans.map(plan => ({
    plan,
    scope: plan.recommendation?.requestFor || 'household',
    ingredients: ingredientsOf(plan).map(ingredient => ({ name: norm(ingredient.name), unit: ingredient.unit || 'count' })),
  }));
  return item => {
    if (!item.reservedPlanId) return [];
    const found = [];
    const add = plan => { if (plan && !found.includes(plan)) found.push(plan); };
    add(byId.get(item.reservedPlanId));
    for (const { plan, scope, ingredients } of index) {
      if (scope === (item.requestFor || 'household') && ingredients.some(ingredient => ingredient.name === norm(item.name) && ingredient.unit === (item.unit || 'count'))) add(plan);
    }
    return found;
  };
}

export const recipeLabel = plans => plans.map(recipeTitle).join(', ');
