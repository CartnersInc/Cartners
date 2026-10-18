import { useState } from 'react';
import { useWrite } from '../shopping/lib/useWrite.js';

const list = value => [...new Set(value.split(',').map(v => v.trim()).filter(Boolean))];
export default function Preferences({ workspace, actorId, api, onWorkspaceChange, connected, notify }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const write = useWrite({ workspace, actorId, api, onWorkspaceChange });
  const prefs = workspace.preferences;
  function edit() { setValues({ servings: prefs.servings, restrictions: prefs.restrictions.join(', '), likes: (prefs.likes || []).join(', '), maxPrepMinutes: prefs.maxPrepMinutes || 30 }); setEditing(true); }
  async function save(event) {
    event.preventDefault();
    const result = await write.send('/api/preferences', 'PATCH', { servings: Number(values.servings), restrictions: list(values.restrictions), likes: list(values.likes), maxPrepMinutes: Number(values.maxPrepMinutes) });
    if (result) { setEditing(false); write.reset(); notify('Household preferences saved.'); }
  }
  return <section className="rm-card preferences"><div className="section-heading"><h2>Your food preferences</h2>{!editing && <button className="text-button" onClick={edit}>Edit preferences</button>}</div><p className="small muted">Used for new suggestions. You can still ask for something different for one meal.</p>{editing ? <form className="preferences-form" onSubmit={save}><fieldset disabled={write.locked || !connected}><label>Servings<input type="number" min="1" max="12" required value={values.servings} onChange={e => setValues({ ...values, servings: e.target.value })} /></label><label>Dietary needs & foods to avoid<input maxLength={300} value={values.restrictions} onChange={e => setValues({ ...values, restrictions: e.target.value })} /></label><label>Foods you enjoy<input maxLength={300} value={values.likes} onChange={e => setValues({ ...values, likes: e.target.value })} /></label><label>Cooking time (minutes)<input type="number" min="1" max="240" required value={values.maxPrepMinutes} onChange={e => setValues({ ...values, maxPrepMinutes: e.target.value })} /></label></fieldset><p className="small muted">Separate foods with commas. Check ingredient labels for allergies.</p>{write.state.error && <p className="notice error" role="alert">{write.state.error}</p>}<div className="preference-actions"><button className="button" type="button" disabled={write.saving} onClick={() => { setEditing(false); write.reset(); }}>Cancel</button><button className="button primary" disabled={write.saving || !connected}>{write.saving ? 'Saving…' : write.state.retryable ? 'Retry save' : 'Save preferences'}</button></div></form> : <dl className="preference-summary"><div><dt>Cooking for</dt><dd>{prefs.servings} people</dd></div><div><dt>Dietary needs</dt><dd>{prefs.restrictions.join(', ') || 'None saved'}</dd></div><div><dt>Foods you enjoy</dt><dd>{prefs.likes?.join(', ') || 'Open to ideas'}</dd></div><div><dt>Time to cook</dt><dd>{prefs.maxPrepMinutes || 30} minutes</dd></div></dl>}</section>;
}
