import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { isDraft } from '../../api/client.js';
import { localDate, weekDates, shiftWeek } from './dates.js';
import { recipeTitle } from '../shopping/lib/recipes.js';

const WEEK_MESSAGE = 'Plan dinners for this week using our saved preferences.';

export default function Plans({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected }) {
  const [anchor, setAnchor] = useState(localDate);
  const [date, setDate] = useState(localDate);
  const [weekDraft, setWeekDraft] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const dates = weekDates(anchor);
  const format = (value, options) => new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T12:00:00`));
  const meals = (workspace.plans || []).filter(plan => dates.includes(plan.date || plan.planDate)).sort((a,b) => (a.date || a.planDate).localeCompare(b.date || b.planDate));
  const locked = !!pending;

  async function planWeek() {
    if (locked) return;
    setPending('week'); setError('');
    try {
      const body = {
        workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(),
        message: WEEK_MESSAGE, planDate: dates[0],
      };
      const next = connected
        ? await api.request('/api/suggestions', { method: 'POST', body, timeoutMs: 45000 })
        : await api.request('/api/ai/suggestions', {
          method: 'POST',
          body: { ...body, listRevision: workspace.listRevision, preferences: workspace.preferences },
          timeoutMs: 45000,
        });
      if (!isDraft(next, workspace.workspaceId) || next.kind !== 'weekly_plan') throw new Error('The week preview could not be used. Try again.');
      setWeekDraft({ draft: next, previewOnly: !connected });
    } catch (err) { setError(err.message); }
    finally { setPending(''); }
  }

  async function saveWeek() {
    if (locked || !connected || !weekDraft?.draft || weekDraft.previewOnly) return;
    setPending('save'); setError('');
    try {
      const result = await api.request('/api/drafts/confirm', {
        method: 'POST',
        body: {
          workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(),
          draftId: weekDraft.draft.draftId, expectedListRevision: weekDraft.draft.listRevision,
          excludedIngredientIds: [], target: 'plans',
        },
      });
      if (!result.workspace) throw new Error('The save response was incomplete. Retry to check the same action.');
      onWorkspaceChange(result.workspace);
      setWeekDraft(null);
      notify(result.changeSummary || 'Saved this week’s meals. No groceries were added.');
    } catch (err) { setError(err.message); }
    finally { setPending(''); }
  }

  return <div className="plans-page"><div className="page-heading"><div><h1>This week</h1><p className="intro">Ask once for seven dinners. Saving the week puts meals on this calendar. Groceries wait until you confirm a single night.</p></div><button className="button" onClick={() => navigate('shopping')}>View shopping list</button></div>
    <form className="plan-another" onSubmit={e => { e.preventDefault(); navigate('home-new', date); }}><label>Plan a meal for<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><button className="button primary">Find an idea</button><button type="button" className="button" disabled={locked} onClick={planWeek}>{pending === 'week' ? 'Planning…' : 'Plan this week'}</button></form>
    {error && <div className="notice error" role="alert"><p>{error}</p></div>}
    {weekDraft && <section className="week-draft" aria-labelledby="week-draft-title">
      <span className="source-label">{weekDraft.previewOnly ? 'AI idea · preview only' : weekDraft.draft.sourceMode === 'sample' ? 'Sample week' : 'AI week'}</span>
      <h2 id="week-draft-title">Seven dinners, one ask</h2>
      <p className="muted">{weekDraft.draft.changesSummary || 'Preview only. Saving this week does not add groceries.'}</p>
      <ol className="week-plan-days">{(weekDraft.draft.days || []).map(day => {
        const recipe = day.recommendation || {};
        return <li key={day.planDate}><p className="small muted">{format(day.planDate, { weekday: 'long', month: 'short', day: 'numeric' })} · about {recipe.prepMinutesApprox} min</p><h3>{recipe.title}</h3><p>{recipe.fitReason}</p></li>;
      })}</ol>
      <div className="draft-actions">
        <p className="small muted">{weekDraft.previewOnly ? 'Connect the shared backend to save this week on the household calendar.' : 'Saves the calendar only. Pick a night later when you want those groceries on the list.'}</p>
        <button className="text-button" disabled={locked} onClick={() => setWeekDraft(null)}>Discard</button>
        <button className="button primary" onClick={saveWeek} disabled={locked || weekDraft.previewOnly || !connected}>{pending === 'save' ? 'Saving…' : 'Save this week'}<Icon name="arrow" /></button>
      </div>
    </section>}
    <div className="week-toolbar"><h2>{format(dates[0], { month: 'short', day: 'numeric' })} – {format(dates[6], { month: 'short', day: 'numeric' })}</h2><div><button className="text-button" onClick={() => setAnchor(shiftWeek(anchor,-1))}>Previous week</button><button className="text-button" onClick={() => setAnchor(localDate())}>This week</button><button className="text-button" onClick={() => setAnchor(shiftWeek(anchor,1))}>Next week</button></div></div>
    {meals.length ? <ul className="saved-meals">{meals.map(plan => {
      const recipe = plan.recommendation || plan.plan || plan;
      const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
      return <li key={plan.id}><p className="small muted">{format(plan.date || plan.planDate, { weekday: 'long', month: 'short', day: 'numeric' })}{plan.servings ? ` · ${plan.servings} servings` : ''}</p><h2>{recipeTitle(plan)}</h2>{steps.length > 0 && <details><summary>How to make it</summary><ol className="recipe-steps">{steps.map((step,i) => <li key={i}>{step}</li>)}</ol></details>}</li>;
    })}</ul> : <div className="empty-week"><h2>No meals planned for this week yet.</h2><p>Plan this week for seven dated dinners, or start with one night. Ingredients land on the shopping list only when you confirm a single meal.</p><button className="button primary" onClick={planWeek} disabled={locked}>{pending === 'week' ? 'Planning…' : 'Plan this week'}</button></div>}
  </div>;
}
