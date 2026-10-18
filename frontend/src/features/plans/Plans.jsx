import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { isDraft } from '../../api/client.js';
import { localDate, weekDates, shiftWeek } from './dates.js';
import { recipeTitle } from '../shopping/lib/recipes.js';
import Preferences from './Preferences.jsx';

const WEEK_MESSAGE = 'Plan dinners for this week using our saved preferences.';
const planDateOf = plan => plan.date || plan.planDate;

export default function Plans({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected }) {
  const [anchor, setAnchor] = useState(localDate);
  const [date, setDate] = useState(localDate);
  const [weekDraft, setWeekDraft] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const dates = weekDates(anchor);
  const today = localDate();
  const format = (value, options) => new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T12:00:00`));
  const mealsByDate = new Map();
  for (const plan of workspace.plans || []) {
    const key = planDateOf(plan);
    if (!dates.includes(key)) continue;
    const list = mealsByDate.get(key) || [];
    list.push(plan);
    mealsByDate.set(key, list);
  }
  const locked = !!pending;

  function openNight(value) {
    setDate(value);
    navigate('home-new', value);
  }

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

  return <div className="plans-page"><div className="page-heading"><div><h1>This week</h1><p className="intro">Each night is already a date. Empty nights open the same dinner ask on Home. Groceries wait until you add one meal to the cart.</p></div><button className="button" onClick={() => navigate('shopping')}>View shopping list</button></div>
    <form className="plan-another" onSubmit={e => { e.preventDefault(); openNight(date); }}><label>Plan a meal for<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><button className="button primary">Find an idea</button><button type="button" className="button" disabled={locked} onClick={planWeek}>{pending === 'week' ? 'Planning…' : 'Plan this week'}</button></form>
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
    <div className="plans-layout">
      <div>
        <div className="week-toolbar"><h2>{format(dates[0], { month: 'short', day: 'numeric' })} – {format(dates[6], { month: 'short', day: 'numeric' })}</h2><div><button className="text-button" onClick={() => setAnchor(shiftWeek(anchor,-1))}>Previous week</button><button className="text-button" onClick={() => setAnchor(localDate())}>This week</button><button className="text-button" onClick={() => setAnchor(shiftWeek(anchor,1))}>Next week</button></div></div>
        <ul className="week-list">{dates.map(day => {
          const planned = mealsByDate.get(day) || [];
          const label = format(day, { weekday: 'long', month: 'short', day: 'numeric' });
          return <li key={day} className={day === today ? 'today' : undefined}>
            <div className="plan-day"><span>{format(day, { weekday: 'short' })}</span><strong>{format(day, { day: 'numeric' })}</strong>{day === today && <small>Today</small>}</div>
            <div className="plan-content">{planned.length ? planned.map(plan => {
              const recipe = plan.recommendation || plan.plan || plan;
              const steps = Array.isArray(recipe.steps) ? recipe.steps : (Array.isArray(plan.steps) ? plan.steps : []);
              return <article key={plan.id} className="saved-plan">
                <p className="small muted">{plan.servings ? `${plan.servings} servings` : 'Saved meal'}</p>
                <h3>{recipeTitle(plan)}</h3>
                {steps.length > 0 && <details><summary>How to make it</summary><ol className="recipe-steps">{steps.map((step, i) => <li key={i}>{step}</li>)}</ol></details>}
              </article>;
            }) : <button type="button" className="empty-day" data-date={day} onClick={() => openNight(day)} aria-label={`No meal planned ${label}`}>
              <span>No meal planned</span><span>Find an idea<Icon name="arrow" /></span>
            </button>}</div>
          </li>;
        })}</ul>
        <p className="calendar-note small muted">A confirmed dinner from Home lands on its date. Drafts alone do not fill this week.</p>
      </div>
      <Preferences workspace={workspace} actorId={actorId} api={api} onWorkspaceChange={onWorkspaceChange} connected={connected} notify={notify} />
    </div>
  </div>;
}
