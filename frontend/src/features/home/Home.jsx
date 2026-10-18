import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { isDraft } from '../../api/client.js';
import { starterPrompts } from '../../samples.js';
import { activeTrip, liveItems } from '../shopping/lib/trip.js';
import RecipeCarousel from './RecipeCarousel.jsx';
import KitchenArt from '../../components/KitchenArt.jsx';
import { useSurfaceMotion } from '../../components/useMotion.js';
import { isFamilyTable } from '../../household.js';

const IMESSAGE_LINE = String(import.meta.env.VITE_CARTNERS_IMESSAGE_LINE || '+14156055508').replace(/\s/g, '');
function prettyPhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value;
}

export default function Home({ workspace, actorId, api, onWorkspaceChange, navigate, notify, active, connected, entry, onEntryChange, planDate, onPlanDateChange, membership }) {
  const message = entry?.message || '';
  const setMessage = value => onEntryChange({ ...entry, message: value });
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [excluded, setExcluded] = useState(entry?.confirmAttempt?.excludedIngredientIds || entry?.excluded || []);
  // Shared or Just me for every ingredient of a recipe, like a single request in Shopping.
  const scope = (entry?.confirmAttempt?.requestFor || entry?.scope || 'household') === 'household' ? 'household' : actorId;
  const setScope = next => onEntryChange({ ...entry, scope: next });
  const saved = entry?.saved || null;
  const attempt = useRef(entry?.confirmAttempt || null);
  const undoAttempt = useRef(entry?.undoAttempt || null);
  const suggestionAttempt = useRef(null);
  const busy = useRef(false);
  const draft = entry?.draft;
  const draftMotion = useSurfaceMotion(draft?.draftId);
  const week = draft?.kind === 'weekly_plan';
  const meal = week ? null : draft?.recommendation;
  const weekDays = week ? draft.days || [] : [];
  const rows = meal?.ingredients || draft?.items || [];
  const previews = meal?.listPreview || draft?.listPreview || [];
  const recoveringSave = !!attempt.current;
  const locked = !!pending || recoveringSave;
  const staleDraft = draft && !entry.localOnly && !recoveringSave && draft.listRevision !== workspace.listRevision;

  useEffect(() => {
    if (!active || !draft?.draftId) return;
    const section = draftMotion.current;
    section?.querySelector('h2')?.focus({ preventScroll: true });
    section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, [draft?.draftId, active]);

  function showDraft(nextDraft, localOnly, aiPreviewOnly = false) {
    onEntryChange({ draft: nextDraft, localOnly, aiPreviewOnly, message: '', previous: entry?.draft ? { ...entry, previous: null } : null });
    setExcluded([]); setError(''); attempt.current = null; undoAttempt.current = null;
  }
  async function requestSuggestion(text) {
    if (busy.current || recoveringSave || !text.trim()) return;
    setMessage(text);
    if (!planDate || Number.isNaN(new Date(`${planDate}T12:00:00`).getTime())) { setError('Choose a meal date before asking for an idea.'); return; }
    busy.current = true; setPending('suggestion'); setError('');
    const input = { workspaceId: workspace.workspaceId, actorId, message: text.trim(), planDate, ...(draft && !entry.localOnly ? { previousDraftId: draft.draftId } : {}) };
    const key = JSON.stringify(input);
    const previewOnly = !connected;
    if (suggestionAttempt.current?.key !== key) suggestionAttempt.current = { key, body: { ...input, requestId: crypto.randomUUID() } };
    try {
      const body = previewOnly ? {
        ...suggestionAttempt.current.body,
        listRevision: workspace.listRevision,
        preferences: workspace.preferences,
        ...(draft && !entry.localOnly ? { previousDraft: draft } : {}),
      } : suggestionAttempt.current.body;
      const next = await api.request(previewOnly ? '/api/ai/suggestions' : '/api/suggestions', { method: 'POST', body, timeoutMs: /week/i.test(text) ? 45000 : 25000 });
      if (!isDraft(next, workspace.workspaceId)) throw new Error('The backend returned an unsupported draft. Your previous idea is still here.');
      showDraft(next, false, previewOnly); suggestionAttempt.current = null;
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setPending(''); }
  }
  async function confirm() {
    if (busy.current || saved || entry.localOnly || !connected || staleDraft) return;
    busy.current = true; setPending('confirm'); setError('');
    if (!attempt.current) attempt.current = {
      workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(), draftId: draft.draftId,
      expectedListRevision: draft.listRevision, excludedIngredientIds: excluded, target: week ? 'plans' : 'cart',
      ...(meal ? { requestFor: scope } : {}),
    };
    onEntryChange({ ...entry, confirmAttempt: attempt.current });
    try {
      const result = await api.request('/api/drafts/confirm', { method: 'POST', body: attempt.current });
      if (!result.workspace || !result.actionId) throw new Error('The save response was incomplete. Retry to check the same action.');
      onWorkspaceChange(result.workspace);
      const savedMessage = typeof result.changeSummary === 'string' ? result.changeSummary : (week ? 'Saved this week’s meals. No groceries were added.' : 'Saved to your cart.');
      onEntryChange({ ...entry, confirmAttempt: null, saved: { actionId: result.actionId, actorId, message: savedMessage } });
      notify(savedMessage); attempt.current = null; navigate(week ? 'plans' : 'shopping');
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
    if (busy.current || !connected) return;
    busy.current = true; setPending('undo'); setError('');
    if (!undoAttempt.current) undoAttempt.current = { workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID() };
    onEntryChange({ ...entry, undoAttempt: undoAttempt.current });
    try {
      const result = await api.request(`/api/actions/${encodeURIComponent(saved.actionId)}/undo`, { method: 'POST', body: undoAttempt.current });
      if (!result.workspace) throw new Error('The Undo response was incomplete. Retry the same action.');
      onWorkspaceChange(result.workspace);
      const feedback = typeof result.changeSummary === 'string' ? result.changeSummary : 'Undo processed. Changes already edited or bought may have been kept.';
      onEntryChange({ ...entry, saved: null, confirmAttempt: null, undoAttempt: null, undoMessage: feedback }); undoAttempt.current = null; attempt.current = null;
      setError('');
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setPending(''); }
  }
  async function refreshDraft(requestFor = scope, pendingState = 'refresh') {
    if (busy.current) return;
    busy.current = true; setPending(pendingState); setError('');
    try {
      const next = await api.request(`/api/suggestions/${encodeURIComponent(draft.draftId)}?workspaceId=${encodeURIComponent(workspace.workspaceId)}&requestFor=${encodeURIComponent(requestFor)}`);
      if (!isDraft(next, workspace.workspaceId) || next.listRevision !== workspace.listRevision) throw new Error('The cart preview is still out of date. The backend needs to refresh it before you can save.');
      onEntryChange({ ...entry, draft: next, scope: requestFor });
    } catch (err) {
      if (pendingState === 'scope') onEntryChange({ ...entry, scope });
      setError(err.message);
    }
    finally { busy.current = false; setPending(''); }
  }

  const refreshedRevision = useRef('');
  useEffect(() => {
    if (!staleDraft || saved || !connected || pending || recoveringSave) return;
    const key = `${draft.draftId}:${workspace.listRevision}:${scope}`;
    if (refreshedRevision.current === key) return;
    refreshedRevision.current = key;
    refreshDraft(scope);
  }, [staleDraft, saved, connected, pending, recoveringSave, draft?.draftId, workspace.listRevision, scope]);

  function changeScope(next) {
    if (next === scope) return;
    if (!connected || entry.localOnly || entry.aiPreviewOnly) { setScope(next); return; }
    onEntryChange({ ...entry, scope: next });
    refreshDraft(next, 'scope');
  }

  const neededItems = liveItems(workspace).filter(item => !item.bought);
  const trip = activeTrip(workspace);
  const shopper = trip && workspace.actors.find(person => person.id === trip.claimedBy);
  const selectedDate = new Date(`${planDate}T12:00:00`);
  const dateLabel = Number.isNaN(selectedDate.getTime()) ? 'Choose a date' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(selectedDate);
  const options = <details className="request-options">
    <summary>{dateLabel} · {workspace.preferences.servings} servings{workspace.preferences.restrictions.length ? ` · ${workspace.preferences.restrictions.join(', ')}` : ''}</summary>
    <div className="request-options-body">
      <label className="date-control">Meal date<input aria-label="Meal date" type="date" value={planDate} onChange={e => { const value = e.target.value; if (value && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())) onPlanDateChange(value); }} disabled={locked} required /></label>
      <button className="text-button" onClick={() => navigate('groups')}>Edit preferences</button>
    </div>
  </details>;
  const composer = <form className={`composer ${draft ? 'followup-composer' : ''}`} data-pending={pending === 'suggestion'} data-has-input={Boolean(message.trim())} onSubmit={event => { event.preventDefault(); requestSuggestion(message); }} aria-busy={pending === 'suggestion'}>
    <label className="sr-only" htmlFor="meal-request">{draft ? 'Change this idea' : 'What do you want to cook or buy?'}</label>
    <textarea id="meal-request" value={message} maxLength={500} rows={2}
      onChange={e => setMessage(e.target.value)} disabled={locked}
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); requestSuggestion(message); } }}
      placeholder={draft ? 'Make it quicker or swap an ingredient…' : 'A craving, ingredient, or grocery request…'} />
    <div className="composer-bottom">
      <span className="small muted composer-hint">{pending === 'suggestion' ? 'Putting your idea together…' : draft ? 'Tell us what to change.' : message.trim() ? 'Enter to ask · Shift + Enter for a new line' : 'A meal, a few groceries, or “surprise me.”'}</span>
      <button className="button primary" disabled={!message.trim() || locked}>
        {pending === 'suggestion' ? 'Finding an idea…' : draft ? 'Update idea' : 'Find an idea'}<Icon name="arrow" />
      </button>
    </div>
    {pending === 'suggestion' && <div className="composer-progress" role="progressbar" aria-label="Waiting for your meal or grocery idea"><span /></div>}
  </form>;
  const starters = <div className="suggestion-starters" aria-label={connected ? 'Ideas to get started' : 'Sample ideas'}>
    {starterPrompts.map(prompt => <button key={prompt.key} className="chip" disabled={locked}
      onClick={() => requestSuggestion(prompt.message)}>{prompt.label}</button>)}
  </div>;

  return <div className="home-page">
    {!draft ? <div className="discovery discovery-focused">
      <div className="home-request">
        <div className="home-hero"><h1>What sounds<br />good <span>today?</span></h1>
        <p className="intro">{isFamilyTable(workspace, membership) ? <>One family dinner. One shared grocery run.<br />Mom or dad can pick it up for the table.</> : <>One shared list. Split the receipt after.<br />Venmo, Zelle, or Cash App — not a family budget.</>}</p><KitchenArt /></div>
        {composer}{starters}{options}
      </div>
      <aside className="home-list" aria-labelledby="home-list-title">
        <div className="home-list-heading"><div><h2 id="home-list-title">Already on your list</h2><p>{neededItems.length ? `${neededItems.length} ${neededItems.length === 1 ? 'thing' : 'things'} to pick up` : 'Nothing to pick up yet'}</p></div><Icon name="shopping" /></div>
        {neededItems.length ? <ul>{neededItems.slice(0, 4).map(item => <li key={item.id}><span>{item.name}</span><small>{item.quantity} {item.unit}</small></li>)}</ul> : <p className="home-list-empty">Your list will appear here. Cartners checks it before adding new ingredients.</p>}
        {neededItems.length > 4 && <p className="home-list-more">and {neededItems.length - 4} more</p>}
        <p className="home-run-status">{trip ? <><strong>{shopper?.name || 'Someone'} is at {trip.storeName}.</strong> New requests {trip.requestDeadlineAt && Date.parse(trip.requestDeadlineAt) > Date.now() ? 'can still join this run.' : 'will wait for the next run.'}</> : 'No one is shopping right now.'}</p>
        <button className="text-button" onClick={() => navigate('shopping')}>Open shared list<Icon name="arrow" /></button>
        <div className="home-text-line">
          {isFamilyTable(workspace, membership)
            ? <><p><strong>Mom or dad heading to the store?</strong> Text Cartners from the car. The rest of the family can reply “need milk” and it lands on this list.</p>
              <a className="text-button" href={`sms:${IMESSAGE_LINE}?body=${encodeURIComponent('Going to the store — what does everyone need?')}`}>Text {prettyPhone(IMESSAGE_LINE)}<Icon name="arrow" /></a></>
            : <><p><strong>Who’s grabbing groceries?</strong> Text “going to QFC — what do you guys need?” Roommates add “need milk.” Split later with Venmo, Zelle, or Cash App — not a family budget.</p>
              <a className="text-button" href={`sms:${IMESSAGE_LINE}?body=${encodeURIComponent('Going to QFC — what do you guys need?')}`}>Text {prettyPhone(IMESSAGE_LINE)}<Icon name="arrow" /></a></>}
        </div>
      </aside>
    </div> : <div className="idea-page-heading"><h1>{week ? 'Your week' : meal ? 'Your dinner idea' : draft.kind === 'grocery_list' ? 'Your grocery list' : 'One thing to check'}</h1>{options}<button className="text-button" disabled={locked} onClick={() => navigate('home-new')}>Start a new idea</button></div>}

    {!draft && <RecipeCarousel active={active} pending={!!pending} onTry={requestSuggestion} />}

    {error && <div className="notice error" role="alert"><p>{error}</p></div>}
    {entry?.undoMessage && <p className="notice" role="status">{entry.undoMessage}</p>}
    {pending === 'suggestion' && <p className="sr-only" role="status">Finding something that fits your group…</p>}

    {draft && <section ref={draftMotion} className="draft" aria-labelledby="draft-title" aria-busy={!!pending}>
      <div className="draft-heading"><span className="source-label">{entry.aiPreviewOnly ? 'AI idea · preview only' : draft.sourceMode === 'sample' ? 'Sample idea' : 'AI suggestion'}</span>
        {entry.previous && !saved && <button className="text-button" disabled={locked} onClick={() => { onEntryChange({ ...entry.previous, previous: null }); setExcluded(entry.previous.excluded || []); setError(''); attempt.current = null; undoAttempt.current = null; }}>Previous idea</button>}
      </div>
      {meal && draft.planDate && draft.planDate !== planDate && <p className="notice">This idea is for {draft.planDate}. A new request will use {planDate}; adding this idea keeps its original date.</p>}
      {draft.kind === 'clarification' ? <><h2 id="draft-title" tabIndex={-1}>{draft.question}</h2><p className="muted clarification-hint">Reply below. Nothing has been added yet.</p></> : week ? <>
        <div className="recipe-copy"><h2 id="draft-title" tabIndex={-1}>Seven dinners, one ask</h2>
          <p>{draft.inputSummary?.summary || 'A week of meals using your household defaults.'}</p>
          {draft.changesSummary && <p className="change-note">{draft.changesSummary}</p>}
        </div>
        <ol className="week-plan-days">{weekDays.map(day => {
          const recipe = day.recommendation || {};
          const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${day.planDate}T12:00:00`));
          return <li key={day.planDate}><p className="small muted">{label} · about {recipe.prepMinutesApprox} min · {recipe.servings} servings</p><h3>{recipe.title}</h3><p>{recipe.fitReason}</p></li>;
        })}</ol>
        {saved ? <div className="save-result" role="status"><div><strong>{saved.message}</strong><p className="small">These meals are on This week. Groceries were not added.</p></div>
          <button className="button" disabled={!!pending || !connected} onClick={undo}>{pending === 'undo' ? 'Undoing…' : 'Undo'}</button><button className="button primary" onClick={() => navigate('plans')}>View this week<Icon name="arrow" /></button>
        </div> : <div className="draft-actions"><div>{entry.localOnly ? <p className="small muted">Fixed sample. Ask AI for your own week when connected.</p> : entry.aiPreviewOnly ? <p className="small muted">Connect the shared backend to save this week on the household calendar.</p> : staleDraft ? <><p className="small muted">Checking the latest household list before you save this week.</p><button className="text-button" disabled={locked} onClick={refreshDraft}>Refresh</button></> : <p className="small muted">{recoveringSave ? 'Check the previous save. It won’t add groceries or duplicate meals.' : 'Saves these seven meals on This week. Does not add groceries — pick a night and add that dinner when you are ready to shop.'}</p>}</div>
          <button className="button primary" onClick={confirm} disabled={!!pending || entry.localOnly || !connected || staleDraft}>{pending === 'confirm' ? 'Saving…' : recoveringSave ? 'Retry save' : entry.aiPreviewOnly ? 'Cart connection needed' : 'Save this week'}<Icon name="arrow" /></button>
        </div>}
      </> : <>
        <div className="recipe-copy"><h2 id="draft-title" tabIndex={-1}>{meal?.title || 'Here’s what you asked for'}</h2>
          {meal ? <><p className="recipe-meta"><Icon name="clock" />About {meal.prepMinutesApprox} min<span className="recipe-servings"><Icon name="salad" />{meal.servings} servings</span><span className="recipe-date"><Icon name="plans" /><span className="sr-only">For </span>{draft.planDate || planDate}</span></p><p>{meal.fitReason}</p>
            {draft.changesSummary && <p className="change-note">{draft.changesSummary}</p>}
            <div className="refinement-actions"><button className="chip" disabled={locked} onClick={() => requestSuggestion('Make it quicker')}>Make it quicker</button></div>
            <details><summary>How to make it</summary><ol className="recipe-steps">{meal.steps.map((step, i) => <li key={i}>{step}</li>)}</ol></details>
            {meal.uncertainties?.map((warning, i) => <p className="small muted" key={i}>{warning}</p>)}
          </> : <p>{draft.inputSummary?.summary || 'These requests are ready to review.'}</p>}
        </div>
        <div className="cart-preview compact-cart"><div className="cart-heading"><h3>{entry.aiPreviewOnly ? 'Ingredient preview' : 'Review your shopping list'}</h3>
            {meal && <div className="scope-switch" role="radiogroup" aria-label="Who these ingredients are for">
              {[['household', 'Shared'], ['mine', 'Just me']].map(([id, label]) => <label key={id}><input type="radio" name="recipe-scope" checked={(scope === 'household') === (id === 'household')} disabled={!!pending || !!saved || recoveringSave} onChange={() => changeScope(id === 'household' ? 'household' : actorId)} /><span>{label}</span></label>)}
            </div>}</div>
          <p className="small muted">Uncheck ingredients you already have or don’t need for this meal. Existing household requests stay on the list.</p><ul className="ingredient-list">{rows.map(item => {
            const preview = previews.find(row => row.ingredientId === item.id);
            const itemScope = meal ? scope : item.requestFor;
            const owner = itemScope && itemScope !== 'household' ? (itemScope === actorId ? 'Just you' : workspace.actors.find(actor => actor.id === itemScope)?.name || itemScope) : 'Shared';
            return <li key={item.id}><label><input type="checkbox" checked={!excluded.includes(item.id)} disabled={!!pending || !!saved || !!attempt.current}
              onChange={e => { const next = e.target.checked ? excluded.filter(id => id !== item.id) : [...excluded, item.id]; setExcluded(next); onEntryChange({ ...entry, excluded: next }); }} />
              <span><strong>{item.name}</strong><small>{item.quantity} {item.unit} · {owner}{item.note ? ` · ${item.note}` : ''}</small>
                <small>{pending === 'scope' ? 'Updating match…' : preview?.action === 'keep' ? 'Already on the list' : preview?.action === 'increase' ? `Add ${preview.deltaQuantity}; ${preview.existingQuantity} already requested` : preview?.action === 'review' ? 'Check this variant' : `Add ${preview?.deltaQuantity ?? item.quantity}`}</small>
              </span></label></li>;
          })}</ul>
        </div>
        {saved ? <div className="save-result" role="status"><div><strong>{saved.message}</strong><p className="small">{meal ? 'Your meal plan was saved too.' : 'Your shared cart is up to date.'}</p></div>
          <button className="button" disabled={!!pending || !connected} onClick={undo}>{pending === 'undo' ? 'Undoing…' : 'Undo'}</button><button className="button primary" onClick={() => navigate('shopping')}>View cart<Icon name="arrow" /></button>
        </div> : <div className="draft-actions"><div>{entry.localOnly ? <p className="small muted">Fixed sample. Ask AI for your own idea when connected.</p> : entry.aiPreviewOnly ? <p className="small muted">Connect the shared backend to match and save these ingredients.</p> : staleDraft ? <><p className="small muted">Checking the latest household list before you add these groceries.</p><button className="text-button" disabled={locked} onClick={refreshDraft}>Refresh cart preview</button></> : <p className="small muted">{recoveringSave ? 'Check the previous save. It won’t add anything twice.' : meal ? `Adds these groceries and saves your meal in This week for ${draft.planDate || planDate}.` : 'Adds the reviewed requests to your cart.'}</p>}</div>
          <button className="button primary" onClick={confirm} disabled={!!pending || entry.localOnly || !connected || staleDraft}>{pending === 'confirm' ? 'Adding…' : recoveringSave ? 'Retry save' : entry.aiPreviewOnly ? 'Cart connection needed' : 'Add to cart'}<Icon name="arrow" /></button>
        </div>}
      </>}
    </section>}

    {draft && <section className="followup" aria-label="Refine your idea"><h2>{draft.kind === 'clarification' ? 'Your reply' : 'Want to change anything?'}</h2>{composer}</section>}
    {workspace.activity?.length > 0 && <section className="recent-section" aria-labelledby="recent-heading"><div className="section-heading"><h2 id="recent-heading">Around your table</h2><button className="text-button" onClick={() => navigate('shopping')}>Open cart<Icon name="arrow" /></button></div><ul className="activity-list">{workspace.activity.slice(-5).reverse().map((event, index) => <li key={event.id || index}><Icon name="leaf" /><span>{event.message || event.summary || 'Group activity recorded'}</span></li>)}</ul></section>}
  </div>;
}
