import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { isDraft } from '../../api/client.js';
import { sampleDrafts, samplePrompts } from '../../samples.js';

export default function Home({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected, entry, onEntryChange, planDate, onPlanDateChange }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [excluded, setExcluded] = useState([]);
  const [previewSamples, setPreviewSamples] = useState(false);
  const saved = entry?.saved || null;
  const attempt = useRef(entry?.confirmAttempt || null);
  const undoAttempt = useRef(entry?.undoAttempt || null);
  const suggestionAttempt = useRef(null);
  const busy = useRef(false);
  const draft = entry?.draft;
  const meal = draft?.recommendation;
  const samples = previewSamples || !connected;
  const rows = meal?.ingredients || draft?.items || [];
  const previews = meal?.listPreview || draft?.listPreview || [];
  const staleDraft = draft && !entry.localOnly && draft.listRevision !== workspace.listRevision;

  function showDraft(nextDraft, localOnly) {
    onEntryChange({ draft: nextDraft, localOnly, previous: entry?.draft ? { draft: entry.draft, localOnly: entry.localOnly } : null });
    setExcluded([]); setError(''); attempt.current = null;
  }
  function showSample(key) {
    if (busy.current) return;
    const sample = structuredClone(sampleDrafts[key]);
    // shortcut: fixtures preview one fictional family; never reinterpret them as another group's preferences.
    showDraft(sample, true);
    setMessage('');
  }
  async function suggest(event) {
    event.preventDefault();
    if (busy.current || !message.trim()) return;
    if (samples) {
      setError('This preview has fixed sample responses. Choose one below, or connect the backend to use your own request.');
      return;
    }
    busy.current = true; setPending('suggestion'); setError('');
    const input = { workspaceId: workspace.workspaceId, actorId, message: message.trim(), planDate, ...(draft && !entry.localOnly ? { previousDraftId: draft.draftId } : {}) };
    const key = JSON.stringify(input);
    if (suggestionAttempt.current?.key !== key) suggestionAttempt.current = { key, body: { ...input, requestId: crypto.randomUUID() } };
    try {
      const next = await api.request('/api/suggestions', { method: 'POST', body: suggestionAttempt.current.body });
      if (!isDraft(next, workspace.workspaceId)) throw new Error('The backend returned an unsupported draft. Your previous idea is still here.');
      showDraft(next, false); setMessage(''); suggestionAttempt.current = null;
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setPending(''); }
  }
  async function confirm() {
    if (busy.current || saved || entry.localOnly || !connected || staleDraft) return;
    busy.current = true; setPending('confirm'); setError('');
    if (!attempt.current) attempt.current = {
      workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(), draftId: draft.draftId,
      expectedListRevision: draft.listRevision, excludedIngredientIds: excluded, target: 'cart',
    };
    onEntryChange({ ...entry, confirmAttempt: attempt.current });
    try {
      const result = await api.request('/api/drafts/confirm', { method: 'POST', body: attempt.current });
      if (!result.workspace || !result.actionId) throw new Error('The save response was incomplete. Retry to check the same action.');
      onWorkspaceChange(result.workspace);
      onEntryChange({ ...entry, confirmAttempt: null, saved: { actionId: result.actionId, message: typeof result.changeSummary === 'string' ? result.changeSummary : 'Saved to your cart.' } });
      notify('Saved to your cart.'); attempt.current = null;
    } catch (err) {
      if (err.status === 409) {
        attempt.current = null;
        onEntryChange({ ...entry, confirmAttempt: null });
        if (err.payload?.workspace) onWorkspaceChange(err.payload.workspace);
      }
      setError(err.message);
    } finally { busy.current = false; setPending(''); }
  }
  async function undo() {
    if (busy.current) return;
    busy.current = true; setPending('undo'); setError('');
    if (!undoAttempt.current) undoAttempt.current = { workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID() };
    onEntryChange({ ...entry, undoAttempt: undoAttempt.current });
    try {
      const result = await api.request(`/api/actions/${encodeURIComponent(saved.actionId)}/undo`, { method: 'POST', body: undoAttempt.current });
      if (!result.workspace) throw new Error('The Undo response was incomplete. Retry the same action.');
      onWorkspaceChange(result.workspace);
      const feedback = typeof result.changeSummary === 'string' ? result.changeSummary : 'Undo processed. Changes already edited or bought may have been kept.';
      notify(feedback); onEntryChange({ ...entry, saved: null, confirmAttempt: null, undoAttempt: null }); undoAttempt.current = null; attempt.current = null;
      setError(feedback);
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setPending(''); }
  }
  async function refreshDraft() {
    if (busy.current) return;
    busy.current = true; setPending('refresh'); setError('');
    try {
      const next = await api.request(`/api/suggestions/${encodeURIComponent(draft.draftId)}?workspaceId=${encodeURIComponent(workspace.workspaceId)}`);
      if (!isDraft(next, workspace.workspaceId) || next.listRevision !== workspace.listRevision) throw new Error('The cart preview is still out of date. The backend needs to refresh it before you can save.');
      showDraft(next, false);
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setPending(''); }
  }

  return <div className="home-page">
    <div className={`discovery ${draft ? 'has-draft' : ''}`}>
      <div className="discovery-main">
        <h1><label htmlFor="meal-request">What do you want<br className="desktop-break" /> to eat today?</label></h1>
        <p className="intro">A dinner idea, a craving, or just the groceries you need.</p>
        <div className="context-line"><span>{workspace.preferences.servings} servings</span><span>{workspace.preferences.restrictions.join(', ') || 'No saved restrictions'}</span><button className="text-button" onClick={() => navigate('plans')}>Edit preferences</button></div>
        <form className="composer" onSubmit={suggest} aria-busy={pending === 'suggestion'}>
          <textarea id="meal-request" value={message} maxLength={500} rows={2} onChange={e => setMessage(e.target.value)} placeholder={draft ? 'Make it quicker, swap an ingredient…' : 'Something fun for dinner, ready in 30 minutes…'} disabled={!!pending} />
          <div className="composer-bottom"><label className="date-control">For <input aria-label="Meal date" type="date" value={planDate} onChange={e => onPlanDateChange(e.target.value)} disabled={!!pending} required /></label><button className="button primary" disabled={!message.trim() || !!pending}>{pending === 'suggestion' ? 'Finding an idea…' : 'Find an idea'}<Icon name="arrow" /></button></div>
        </form>
        <div className="suggestion-starters"><span>{samples ? 'Try a sample' : 'Start with an idea'}</span>{samplePrompts.map(prompt => <button key={prompt.key} className="chip" disabled={!!pending} onClick={() => samples ? showSample(prompt.key) : setMessage(sampleDrafts[prompt.key].inputSummary.message)}>{prompt.label}</button>)}</div>
        {connected && <button className="text-button mode-switch" onClick={() => setPreviewSamples(!previewSamples)} disabled={!!pending}>{previewSamples ? 'Use connected AI' : 'Preview sample responses'}</button>}
      </div>
      {!draft && <figure className="table-photo"><img src="/assets/tacos.jpg" alt="Tacos and toppings on a shared table" /><figcaption>Taco night, anyone?<span>Sample inspiration · illustrative photo</span></figcaption></figure>}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {pending === 'suggestion' && <p className="notice" role="status">Preparing a draft. Your current idea stays here while you wait.</p>}
    {draft && <section className="draft" aria-labelledby="draft-title" aria-busy={!!pending}>
      <div className="draft-heading"><span className="source-label">{draft.sourceMode === 'sample' ? 'Sample response' : 'AI suggestion · review before saving'}</span>{entry.localOnly && <span className="muted small">Fixed example: Family dinner · four vegetarian servings</span>}{entry.previous && !saved && <button className="text-button" disabled={!!pending} onClick={() => { onEntryChange({ ...entry.previous, previous: null }); setExcluded([]); setError(''); attempt.current = null; }}>Previous idea</button>}</div>
      {draft.kind === 'clarification' ? <><h2 id="draft-title">One thing to check</h2><p className="clarification">{draft.question}</p><p className="muted">Reply in the same input above. No groceries have been added.</p></> : <>
        <div className="draft-layout"><div className="recipe-copy"><h2 id="draft-title">{meal?.title || 'Your grocery requests'}</h2>{meal ? <><p className="recipe-meta"><Icon name="clock" />About {meal.prepMinutesApprox} min<span>{meal.servings} servings</span></p><p>{meal.fitReason}</p>{draft.changesSummary && <p className="change-note">{draft.changesSummary}</p>}<details><summary>How to make it</summary><ol className="recipe-steps">{meal.steps.map((step, i) => <li key={i}>{step}</li>)}</ol></details>{meal.uncertainties?.map((warning, i) => <p className="small muted" key={i}>{warning}</p>)}<button className="text-button" disabled={!!pending} onClick={() => entry.localOnly ? showSample('refinement') : setMessage('Make it quicker')}>Make it quicker<Icon name="arrow" /></button></> : <p>{draft.inputSummary?.summary || 'Review these before adding them to your shared cart.'}</p>}</div>
        <div className="cart-preview"><h3>What goes in the cart</h3><p className="small muted">Already have something? Uncheck it here.</p><ul className="ingredient-list">{rows.map(item => {
          const preview = previews.find(row => row.ingredientId === item.id);
          const owner = item.requestFor && item.requestFor !== 'household' ? workspace.actors.find(actor => actor.id === item.requestFor)?.name || item.requestFor : 'Shared';
          return <li key={item.id}><label><input type="checkbox" checked={!excluded.includes(item.id)} disabled={!!pending || !!saved || !!attempt.current} onChange={e => setExcluded(e.target.checked ? excluded.filter(id => id !== item.id) : [...excluded, item.id])} /><span><strong>{item.name}</strong><small>{item.quantity} {item.unit} · {owner}{item.note ? ` · ${item.note}` : ''}</small><small>{preview?.action === 'keep' ? 'Already requested — kept as is' : preview?.action === 'increase' ? `Add ${preview.deltaQuantity}; ${preview.existingQuantity} already requested` : preview?.action === 'review' ? 'Check this variant before saving' : `Add ${preview?.deltaQuantity ?? item.quantity}`}</small></span></label></li>;
        })}</ul>
        </div></div>
        {saved ? <div className="save-result" role="status"><div><strong>{saved.message}</strong><p className="small">{meal ? 'Your dated meal plan was saved too.' : 'Your shared cart is up to date.'}</p></div><button className="button" disabled={!!pending} onClick={undo}>{pending === 'undo' ? 'Undoing…' : 'Undo'}</button><button className="button primary" onClick={() => navigate('shopping')}>View cart<Icon name="arrow" /></button></div> : <div className="draft-actions"><div>{entry.localOnly ? <p className="small muted">Preview only. Connect the backend to save a real draft.</p> : staleDraft ? <><p className="small muted">The cart changed. Review an updated preview before adding.</p><button className="text-button" disabled={!!pending} onClick={refreshDraft}>Refresh cart preview</button></> : <p className="small muted">{meal ? `Adds reviewed items and saves your ${draft.planDate || planDate} meal.` : 'Adds reviewed requests. No meal plan or payment.'}</p>}</div><button className="button primary" onClick={confirm} disabled={!!pending || entry.localOnly || !connected || staleDraft}>{pending === 'confirm' ? 'Adding…' : 'Add to cart'}<Icon name="arrow" /></button></div>}
      </>}
    </section>}
    <section className="recent-section" aria-labelledby="recent-heading"><div className="section-heading"><h2 id="recent-heading">Around your table</h2><button className="text-button" onClick={() => navigate('shopping')}>Open cart<Icon name="arrow" /></button></div>{workspace.activity?.length ? <ul className="activity-list">{workspace.activity.slice(-5).reverse().map((event, index) => <li key={event.id || index}><Icon name="leaf" /><span>{event.message || event.summary || 'Group activity recorded'}</span></li>)}</ul> : <p className="muted">No recent activity. Saved plans and shopping updates will appear here.</p>}</section>
  </div>;
}
