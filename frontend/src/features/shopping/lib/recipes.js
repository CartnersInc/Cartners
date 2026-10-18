// Which saved recipes a cart request is for, for display only. A request is linked to a plan
// when the server reserved it for that plan (reservedPlanId), or when a saved plan lists an
// ingredient with the same name. One request can serve several recipes.

const norm = value => String(value || '').trim().toLowerCase();
export const recipeTitle = plan => plan.title || plan.recommendation?.title || plan.event || 'Saved meal';
const ingredientsOf = plan => plan.recommendation?.ingredients || plan.plan?.ingredients || plan.ingredients || [];

export function recipeLookup(workspace) {
  const plans = workspace.plans || [];
  const byId = new Map(plans.map(plan => [plan.id, plan]));
  const index = plans.map(plan => ({ plan, names: new Set(ingredientsOf(plan).map(ingredient => norm(ingredient.name))) }));
  return item => {
    const found = [];
    const add = plan => { if (plan && !found.includes(plan)) found.push(plan); };
    add(byId.get(item.reservedPlanId));
    for (const { plan, names } of index) if (names.has(norm(item.name))) add(plan);
    return found;
  };
}

export const recipeLabel = plans => plans.map(recipeTitle).join(', ');
