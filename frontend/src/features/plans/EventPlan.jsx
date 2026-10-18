import { useState } from 'react';
import Icon from '../../components/Icon.jsx';

const THEMES = ['Weeknight dinner', 'Movie night', 'Game night', 'Friends over', 'Birthday', 'Potluck', 'Brunch', 'Other'];

export default function EventPlan({ workspace, actorId, api, connected, initial, onBack, onUseDraft }) {
  const [form, setForm] = useState(initial);
  const [customTheme, setCustomTheme] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const savedSuggestions = (workspace.plans || [])
    .map(plan => ({ title: plan.title || plan.recommendation?.title || '', planDate: plan.date || plan.planDate || null }))
    .filter(plan => plan.title)
    .slice(-8);

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function findMeals(event) {
    event.preventDefault();
    if (pending) return;
    const name = form.name.trim();
    const theme = form.theme === 'Other' ? customTheme.trim() : form.theme;
    if (!name) { setError('Give the event a name.'); return; }
    if (!form.planDate || !form.time) { setError('Choose a date and time.'); return; }
    if (!theme) { setError('Describe the kind of gathering.'); return; }
    setPending(true);
    setError('');
    try {
      const next = await api.request('/api/ai/event-suggestions', {
        method: 'POST',
        body: {
          workspaceId: workspace.workspaceId,
          requestId: crypto.randomUUID(),
          name,
          planDate: form.planDate,
          time: form.time,
          theme,
          notes: form.notes.trim(),
          guestCount: workspace.preferences.servings,
          preferences: workspace.preferences,
          savedSuggestions,
        },
      });
      setResult(next);
    } catch (err) {
      setError(err.message || 'Meal ideas are unavailable. Your event details are still here.');
    } finally {
      setPending(false);
    }
  }

  async function useMeal(option) {
    if (!connected || pending) return;
    setPending(true);
    setError('');
    try {
      const draft = await api.request('/api/event-drafts', {
        method: 'POST',
        body: {
          workspaceId: workspace.workspaceId,
          actorId,
          requestId: crypto.randomUUID(),
          planDate: form.planDate,
          eventName: form.name.trim(),
          option,
        },
      });
      onUseDraft(draft);
    } catch (err) {
      setError(err.message || 'This meal could not be saved.');
      setPending(false);
    }
  }

  return <div className="event-page">
    <div className="page-heading">
      <div>
        <button className="text-button" onClick={onBack}>Back to the week</button>
        <h1>Plan this event</h1>
        <p className="intro">Name the occasion. Meal ideas use your preferences, this time, and meals you already saved.</p>
      </div>
    </div>
    <form className="preferences-form event-form" onSubmit={findMeals}>
      <label>Event name<input name="name" maxLength={80} required value={form.name} disabled={pending} onChange={e => update('name', e.target.value)} placeholder="Movie night at ours" /></label>
      <div className="event-when">
        <label>Date<input name="date" type="date" required value={form.planDate} disabled={pending} onChange={e => update('planDate', e.target.value)} /></label>
        <label>Time<input name="time" type="time" required value={form.time} disabled={pending} onChange={e => update('time', e.target.value)} /></label>
      </div>
      <label>Kind of gathering
        <select name="theme" value={form.theme} disabled={pending} onChange={e => update('theme', e.target.value)}>
          {THEMES.map(theme => <option key={theme}>{theme}</option>)}
        </select>
      </label>
      {form.theme === 'Other' && <label>Describe it<input name="customTheme" maxLength={80} required value={customTheme} disabled={pending} onChange={e => setCustomTheme(e.target.value)} placeholder="Holiday dinner, study group…" /></label>}
      <label>Notes<input name="notes" maxLength={300} value={form.notes} disabled={pending} onChange={e => update('notes', e.target.value)} placeholder="Finger food, no tomatoes…" /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button primary" disabled={pending}>{pending ? 'Finding meals…' : 'Find meals'}<Icon name="arrow" /></button>
    </form>
    {result?.kind === 'clarification' && <section className="event-result" aria-live="polite"><h2>One thing to check</h2><p>{result.question}</p></section>}
    {result?.kind === 'event_suggestions' && <section className="event-result" aria-live="polite">
      <h2>{result.eventSummary}</h2>
      <p className="small muted">{result.sampleNotice}</p>
      <ul className="event-options">
        {(result.options || []).map(option => <li key={option.title}>
          <h3>{option.title}</h3>
          <p className="small muted">About {option.prepMinutesApprox} min · {option.servings} servings</p>
          <p>{option.fitReason}</p>
          <p className="small">{option.ingredients.map(item => item.name).join(', ')}</p>
          {connected && <button type="button" className="button" disabled={pending} onClick={() => useMeal(option)}>Use this meal</button>}
        </li>)}
      </ul>
    </section>}
  </div>;
}
