import { useState } from 'react';
import { localDate, weekDates, shiftWeek } from './dates.js';
import { recipeTitle } from '../shopping/lib/recipes.js';
export default function Plans({ workspace, navigate }) {
  const [anchor, setAnchor] = useState(localDate);
  const [date, setDate] = useState(localDate);
  const dates = weekDates(anchor);
  const format = (value, options) => new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T12:00:00`));
  const meals = (workspace.plans || []).filter(plan => dates.includes(plan.date || plan.planDate)).sort((a,b) => (a.date || a.planDate).localeCompare(b.date || b.planDate));
  return <div className="plans-page"><div className="page-heading"><div><h1>This week</h1><p className="intro">Meals you’ve chosen appear here automatically. Their ingredients go straight to your shopping list.</p></div><button className="button" onClick={() => navigate('shopping')}>View shopping list</button></div>
    <form className="plan-another" onSubmit={e => { e.preventDefault(); navigate('home-new', date); }}><label>Plan a meal for<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><button className="button primary">Find an idea</button></form>
    <div className="week-toolbar"><h2>{format(dates[0], { month: 'short', day: 'numeric' })} – {format(dates[6], { month: 'short', day: 'numeric' })}</h2><div><button className="text-button" onClick={() => setAnchor(shiftWeek(anchor,-1))}>Previous week</button><button className="text-button" onClick={() => setAnchor(localDate())}>This week</button><button className="text-button" onClick={() => setAnchor(shiftWeek(anchor,1))}>Next week</button></div></div>
    {meals.length ? <ul className="saved-meals">{meals.map(plan => {
      const recipe = plan.recommendation || plan.plan || plan;
      const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
      return <li key={plan.id}><p className="small muted">{format(plan.date || plan.planDate, { weekday: 'long', month: 'short', day: 'numeric' })}{plan.servings ? ` · ${plan.servings} servings` : ''}</p><h2>{recipeTitle(plan)}</h2>{steps.length > 0 && <details><summary>How to make it</summary><ol className="recipe-steps">{steps.map((step,i) => <li key={i}>{step}</li>)}</ol></details>}</li>;
    })}</ul> : <div className="empty-week"><h2>No meals planned for this week yet.</h2><p>Start with one dinner. Ask Cartners for an idea, then choose “Add to cart” to save the meal and its groceries together.</p><button className="button primary" onClick={() => navigate('home-new', dates.includes(localDate()) ? localDate() : dates[0])}>Plan your first meal</button></div>}
  </div>;
}
