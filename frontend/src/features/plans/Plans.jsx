import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { localDate, weekDates, shiftWeek } from './dates.js';
import EventPlan from './EventPlan.jsx';

const list = text => [...new Set(text.split(',').map(value => value.trim()).filter(Boolean))];
export default function Plans({ workspace, actorId, api, onWorkspaceChange, notify, connected, onPlanDateChange, onUseDraft }) {
  const [anchor, setAnchor] = useState(localDate);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({ servings: workspace.preferences.servings, restrictions: workspace.preferences.restrictions.join(', '), likes: workspace.preferences.likes?.join(', ') || '', maxPrepMinutes: workspace.preferences.maxPrepMinutes || 30 });
  const attempt = useRef(null);
  const busy = useRef(false);
  const [eventDraft, setEventDraft] = useState(null);
  const dates = weekDates(anchor);
  const format = (date, options) => new Intl.DateTimeFormat(undefined, options).format(new Date(`${date}T12:00:00`));
  function planFor(date) {
    onPlanDateChange(date);
    setEventDraft({ name: '', planDate: date, time: '18:30', theme: 'Weeknight dinner', notes: '' });
  }
  function editPreferences() {
    setValues({ servings: workspace.preferences.servings, restrictions: workspace.preferences.restrictions.join(', '), likes: workspace.preferences.likes?.join(', ') || '', maxPrepMinutes: workspace.preferences.maxPrepMinutes || 30 });
    setEditing(true); setError(''); attempt.current = null;
  }
  async function savePreferences(event) {
    event.preventDefault();
    if (busy.current || !connected) return;
    const servings = Number(values.servings), maxPrepMinutes = Number(values.maxPrepMinutes);
    if (!Number.isInteger(servings) || servings < 1 || servings > 12 || !Number.isInteger(maxPrepMinutes) || maxPrepMinutes < 1 || maxPrepMinutes > 240) { setError('Use 1–12 servings and a whole cooking time between 1 and 240 minutes.'); return; }
    const input = { workspaceId: workspace.workspaceId, actorId, servings, restrictions: list(values.restrictions), likes: list(values.likes), maxPrepMinutes };
    const key = JSON.stringify(input);
    if (attempt.current?.key !== key) attempt.current = { key, body: { ...input, requestId: crypto.randomUUID() } };
    setPending(true); busy.current = true; setError('');
    try {
      const result = await api.request('/api/preferences', { method: 'PATCH', body: attempt.current.body });
      if (!result.workspace) throw new Error('The save response was incomplete. Your edits are still here; retry to check the same action.');
      onWorkspaceChange(result.workspace); setEditing(false); attempt.current = null; notify('Group preferences saved.');
    } catch (err) { setError(err.message); }
    finally { setPending(false); busy.current = false; }
  }
  if (eventDraft) return <EventPlan workspace={workspace} actorId={actorId} api={api} connected={connected} initial={eventDraft} onBack={() => setEventDraft(null)} onUseDraft={onUseDraft} />;
  return <div className="plans-page">
    <div className="page-heading"><div><h1>A place for dinner plans.</h1><p className="intro">Keep what’s decided. Leave room for the rest.</p></div><button className="button primary" onClick={() => planFor(localDate())}>Plan a meal<Icon name="arrow" /></button></div>
    <div className="plans-layout"><section aria-labelledby="week-heading"><div className="week-toolbar"><h2 id="week-heading">{format(dates[0], { month: 'short', day: 'numeric' })} – {format(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}</h2><div><button className="text-button" aria-label="Previous week" onClick={() => setAnchor(shiftWeek(anchor, -1))}>Earlier</button><button className="text-button" onClick={() => setAnchor(localDate())}>This week</button><button className="text-button" aria-label="Next week" onClick={() => setAnchor(shiftWeek(anchor, 1))}>Later</button></div></div><ul className="week-list">{dates.map(date => {
      const meals = workspace.plans.filter(plan => (plan.date || plan.planDate) === date);
      return <li key={date} className={date === localDate() ? 'today' : ''}><div className="plan-day"><span>{format(date, { weekday: 'short' })}</span><strong>{format(date, { day: 'numeric' })}</strong>{date === localDate() && <small>Today</small>}</div><div className="plan-content">{meals.length ? meals.map((plan, index) => <div key={plan.id || index} className="saved-plan"><h3>{plan.title || plan.recommendation?.title || 'Saved meal'}</h3><p className="small muted">Saved dinner plan{plan.servings ? ` · ${plan.servings} servings` : ''}</p>{(plan.recommendation?.steps || plan.steps) && <details><summary>Recipe steps</summary><ol className="recipe-steps">{(plan.recommendation?.steps || plan.steps).map((step, i) => <li key={i}>{step}</li>)}</ol></details>}</div>) : <button className="empty-day" onClick={() => planFor(date)} aria-label={`Plan a meal for ${date}`}><span>No meal planned</span><span>Find an idea<Icon name="arrow" /></span></button>}</div></li>;
    })}</ul><p className="small muted calendar-note">A meal appears here after you confirm it on Home. Browsing plans never adds groceries or starts an AI call.</p></section>
    <aside className="preferences" aria-labelledby="preferences-heading"><div className="section-heading"><h2 id="preferences-heading">Your usuals</h2>{!editing && <button className="text-button" onClick={editPreferences}>Edit preferences</button>}</div><p className="small muted">Remembered for this group, so you don’t have to repeat yourself.</p>{editing ? <form onSubmit={savePreferences} className="preferences-form" aria-busy={pending}>
      <label>Servings<input name="servings" type="number" min="1" max="12" step="1" required value={values.servings} disabled={pending} onChange={e => setValues({ ...values, servings: e.target.value })} /></label>
      <label>Dietary restrictions<input name="restrictions" maxLength={300} value={values.restrictions} disabled={pending} onChange={e => setValues({ ...values, restrictions: e.target.value })} placeholder="Vegetarian, no peanuts" /><small>Separate with commas. Check ingredient labels too.</small></label>
      <label>Foods you like<input name="likes" maxLength={300} value={values.likes} disabled={pending} onChange={e => setValues({ ...values, likes: e.target.value })} placeholder="Mexican food, pasta" /></label>
      <label>Cooking time in minutes<input name="maxPrepMinutes" type="number" min="1" max="240" step="1" required value={values.maxPrepMinutes} disabled={pending} onChange={e => setValues({ ...values, maxPrepMinutes: e.target.value })} /></label>
      {!connected && <p className="small muted">Preview only. Connect the backend to save preferences.</p>}{error && <p className="notice error" role="alert">{error}</p>}<div className="preference-actions"><button className="button" type="button" disabled={pending} onClick={() => setEditing(false)}>Cancel</button><button className="button primary" disabled={pending || !connected}>{pending ? 'Saving…' : 'Save preferences'}</button></div>
    </form> : <dl className="preference-summary"><div><dt>At the table</dt><dd>{workspace.preferences.servings} servings</dd></div><div><dt>Dietary preferences</dt><dd>{workspace.preferences.restrictions.join(', ') || 'None saved'}</dd></div><div><dt>Foods you like</dt><dd>{workspace.preferences.likes?.join(', ') || 'None saved'}</dd></div><div><dt>Usually ready in</dt><dd>{workspace.preferences.maxPrepMinutes || 30} minutes</dd></div></dl>}</aside></div>
  </div>;
}
