import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { isDraft } from '../../api/client.js';
import { fallbackRecipes, loadRandomRecipes } from '../../api/discovery.js';
import { sampleDrafts, starterPrompts } from '../../samples.js';

function featuredItem(value) {
  if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.thumbnailUrl !== 'string' || typeof value.sourceUrl !== 'string') return false;
  try { return new URL(value.thumbnailUrl).protocol === 'https:' && new URL(value.sourceUrl).protocol === 'https:'; }
  catch { return false; }
}

export default function Home({ workspace, actorId, api, onWorkspaceChange, navigate, notify, active, connected, entry, onEntryChange, planDate, onPlanDateChange }) {
  const message = entry?.message || '';
  const setMessage = value => onEntryChange({ ...entry, message: value });
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [excluded, setExcluded] = useState(entry?.confirmAttempt?.excludedIngredientIds || entry?.excluded || []);
  const saved = entry?.saved || null;
  const attempt = useRef(entry?.confirmAttempt || null);
  const undoAttempt = useRef(entry?.undoAttempt || null);
  const suggestionAttempt = useRef(null);
  const busy = useRef(false);
  const [featuredItems, setFeaturedItems] = useState(fallbackRecipes);
  const [featuredStatus, setFeaturedStatus] = useState('loading');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [featuredPaused, setFeaturedPaused] = useState(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [featuredInteracting, setFeaturedInteracting] = useState(false);
  const [featuredImageFailed, setFeaturedImageFailed] = useState(false);
  const [featuredRetry, setFeaturedRetry] = useState(0);
  const draft = entry?.draft;
  const meal = draft?.recommendation;
  const featured = featuredItems[featuredIndex];
  const rows = meal?.ingredients || draft?.items || [];
  const previews = meal?.listPreview || draft?.listPreview || [];
  const recoveringSave = !!attempt.current;
  const locked = !!pending || recoveringSave;
  const staleDraft = draft && !entry.localOnly && !recoveringSave && draft.listRevision !== workspace.listRevision;

  useEffect(() => {
    if (!active || draft) return;
    const controller = new AbortController();
    setFeaturedStatus('loading');
    loadRandomRecipes({ signal: controller.signal })
      .then(items => {
        const validItems = items.filter(featuredItem).slice(0, 8);
        if (!validItems.length) throw new Error('No recipe picks came back.');
        setFeaturedItems(validItems);
        setFeaturedIndex(0);
        setFeaturedImageFailed(false);
        setFeaturedStatus('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setFeaturedStatus('fallback'); });
    return () => controller.abort();
  }, [active, draft, featuredRetry]);

  useEffect(() => {
    if (!active || !featured || featuredPaused || featuredInteracting || featuredItems.length < 2) return;
    const timer = setInterval(() => {
      setFeaturedIndex(index => (index + 1) % featuredItems.length);
      setFeaturedImageFailed(false);
    }, 12000);
    return () => clearInterval(timer);
  }, [active, featured, featuredIndex, featuredInteracting, featuredItems.length, featuredPaused]);

  useEffect(() => {
    if (!featured || featuredItems.length < 2) return;
    const next = featuredItems[(featuredIndex + 1) % featuredItems.length];
    const image = new Image();
    image.src = next.thumbnailUrl;
  }, [featured, featuredIndex, featuredItems]);

  function moveFeatured(direction) {
    setFeaturedIndex(index => (index + direction + featuredItems.length) % featuredItems.length);
    setFeaturedImageFailed(false);
  }

  function planFeatured() {
    const prompt = featured?.prompt || `Help us make ${featured?.title || 'this recipe'} for our group, using our saved preferences.`;
    setMessage(prompt);
    requestSuggestion(prompt);
  }

  function showDraft(nextDraft, localOnly, aiPreviewOnly = false) {
    onEntryChange({ draft: nextDraft, localOnly, aiPreviewOnly, message: '', previous: entry?.draft ? { ...entry, previous: null } : null });
    setExcluded([]); setError(''); attempt.current = null; undoAttempt.current = null;
  }
  function showSample(key) {
    if (busy.current) return;
    const sample = structuredClone(sampleDrafts[key]);
    // shortcut: fixtures preview one fictional family; never reinterpret them as another group's preferences.
    showDraft(sample, true);
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
      const next = await api.request(previewOnly ? '/api/ai/suggestions' : '/api/suggestions', { method: 'POST', body });
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

  const cartChanges = rows.filter(item => !excluded.includes(item.id) && previews.find(row => row.ingredientId === item.id)?.action !== 'keep');
  const cartSummary = cartChanges.map(item => {
    const preview = previews.find(row => row.ingredientId === item.id);
    const amount = preview?.deltaQuantity ?? item.quantity;
    const unit = item.unit === 'count' ? '' : ` ${item.unit}${['can', 'pack'].includes(item.unit) && amount !== 1 ? 's' : ''}`;
    return `${item.name}${preview?.action === 'review' ? ' (check variant)' : ` (${preview?.action === 'increase' ? '+' : ''}${amount}${unit})`}${item.note ? ` · ${item.note}` : ''}`;
  }).join(', ');
  const selectedDate = new Date(`${planDate}T12:00:00`);
  const dateLabel = Number.isNaN(selectedDate.getTime()) ? 'Choose a date' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(selectedDate);
  const options = <details className="request-options">
    <summary>{dateLabel} · {workspace.preferences.servings} servings{workspace.preferences.restrictions.length ? ` · ${workspace.preferences.restrictions.join(', ')}` : ''}</summary>
    <div className="request-options-body">
      <label className="date-control">Meal date<input aria-label="Meal date" type="date" value={planDate} onChange={e => { const value = e.target.value; if (value && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())) onPlanDateChange(value); }} disabled={locked} required /></label>
      <button className="text-button" onClick={() => navigate('plans')}>Edit preferences</button>
    </div>
  </details>;
  const composer = <form className={`composer ${draft ? 'followup-composer' : ''}`} onSubmit={event => { event.preventDefault(); requestSuggestion(message); }} aria-busy={pending === 'suggestion'}>
    <label className="sr-only" htmlFor="meal-request">{draft ? 'Change this idea' : 'What do you want to eat today?'}</label>
    <textarea id="meal-request" value={message} maxLength={500} rows={2}
      onChange={e => setMessage(e.target.value)} disabled={locked}
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); requestSuggestion(message); } }}
      placeholder={draft ? 'Make it quicker, swap an ingredient…' : 'Pasta tonight? Something quick? Groceries for the weekend?'} />
    <div className="composer-bottom"><span className="small muted">{draft ? 'Tell us what to change.' : 'Or pick an idea below.'}</span>
      <button className="button primary" disabled={!message.trim() || locked}>
        {pending === 'suggestion' ? 'Thinking…' : draft ? 'Update idea' : 'Find an idea'}<Icon name="arrow" />
      </button>
    </div>
  </form>;
  const starters = <div className="suggestion-starters" aria-label={connected ? 'Ideas to get started' : 'Sample ideas'}>
    {starterPrompts.map(prompt => <button key={prompt.key} className="chip" disabled={locked}
      onClick={() => connected ? requestSuggestion(prompt.message) : showSample(prompt.key)}>{prompt.label}</button>)}
  </div>;

  return <div className="home-page">
    {!draft ? <div className="discovery">
      <div className="discovery-main">
        <h1>What do you want<br className="desktop-break" /> to eat today?</h1>
        <p className="intro">Tell us what sounds good. We’ll help with the meal and the grocery list.</p>
        {composer}{starters}{options}
      </div>
      <section className="featured-recipes" aria-label="Featured recipes" aria-roledescription="carousel"
        onMouseEnter={() => setFeaturedInteracting(true)} onMouseLeave={() => setFeaturedInteracting(false)}
        onFocusCapture={() => setFeaturedInteracting(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFeaturedInteracting(false); }}>
        <div className="featured-heading"><div><span className="eyebrow">A little inspiration</span><h2>Something new to try</h2></div><span>{featuredIndex + 1} of {featuredItems.length}</span></div>
        {featured ? <article key={featured.id} className="featured-slide" aria-roledescription="slide" aria-label={(featuredIndex + 1) + ' of ' + featuredItems.length + ': ' + featured.title}>
          <div className="featured-media">{!featuredImageFailed ? <img src={featured.thumbnailUrl} alt={'Recipe for ' + featured.title} loading="eager" referrerPolicy="no-referrer" onError={() => setFeaturedImageFailed(true)} /> : <div className="featured-image-fallback"><Icon name="leaf" /><span>{featured.title}</span></div>}<span className="featured-badge">{featured.sourceType === 'article' ? 'Recipe find' : 'Video find'}</span></div>
          <div className="featured-copy"><p className="featured-source">{[featured.cuisine, featured.sourceName].filter(Boolean).join(' · ') || 'A recipe to discover'}</p><h3>{featured.title}</h3>
            <div className="featured-actions"><button className="button primary" disabled={!!pending} onClick={planFeatured}>Make this tonight<Icon name="arrow" /></button>
              <a className="featured-link" href={featured.sourceUrl} target="_blank" rel="noopener noreferrer">{featured.sourceType === 'article' ? 'Open recipe' : 'Watch video'}<Icon name="arrow" /></a>
            </div>
          </div>
        </article> : <div className="featured-empty" aria-live="polite" aria-busy={featuredStatus === 'loading'}>
          <h3>Finding a fresh idea…</h3><p>Recipes and cooking videos from around the table.</p>
        </div>}
        {featuredItems.length > 1 && <div className="featured-controls">
          <button className="text-button" onClick={() => moveFeatured(-1)} aria-label="Previous recipe">Previous</button>
          <button className="text-button" onClick={() => setFeaturedPaused(value => !value)} aria-pressed={featuredPaused}>{featuredPaused ? 'Play slideshow' : 'Pause slideshow'}</button>
          <button className="text-button" onClick={() => moveFeatured(1)} aria-label="Next recipe">Next</button>
        </div>}
        <div className="featured-refresh"><span>{featuredStatus === 'loading' ? 'Finding fresh picks…' : featuredStatus === 'fallback' ? 'Showing saved picks while discovery reconnects.' : 'Recipe data by TheMealDB'}</span><button className="text-button" disabled={featuredStatus === 'loading'} onClick={() => setFeaturedRetry(value => value + 1)}>Surprise us<Icon name="arrow" /></button></div>
      </section>
    </div> : <div className="idea-page-heading"><h1>{meal ? 'Your dinner idea' : draft.kind === 'grocery_list' ? 'Your grocery list' : 'One thing to check'}</h1>{options}</div>}

    {error && <div className="notice error" role="alert"><p>{error}</p>{!recoveringSave && !saved && !undoAttempt.current && <button className="text-button" onClick={() => showSample('meal')}>Explore a sample meal<Icon name="arrow" /></button>}</div>}
    {entry?.undoMessage && <p className="notice" role="status">{entry.undoMessage}</p>}
    {pending === 'suggestion' && <p className="notice" role="status">Finding something that fits your group…</p>}

    {draft && <section className="draft" aria-labelledby="draft-title" aria-busy={!!pending}>
      <div className="draft-heading"><span className="source-label">{entry.aiPreviewOnly ? 'AI idea · preview only' : draft.sourceMode === 'sample' ? 'Sample idea' : 'AI suggestion'}</span>
        {entry.previous && !saved && <button className="text-button" disabled={locked} onClick={() => { onEntryChange({ ...entry.previous, previous: null }); setExcluded(entry.previous.excluded || []); setError(''); attempt.current = null; undoAttempt.current = null; }}>Previous idea</button>}
      </div>
      {meal && draft.planDate && draft.planDate !== planDate && <p className="notice">This idea is for {draft.planDate}. A new request will use {planDate}; adding this idea keeps its original date.</p>}
      {draft.kind === 'clarification' ? <><h2 id="draft-title">{draft.question}</h2><p className="muted clarification-hint">Reply below. Nothing has been added yet.</p></> : <>
        <div className="recipe-copy"><h2 id="draft-title">{meal?.title || 'Here’s what you asked for'}</h2>
          {meal ? <><p className="recipe-meta"><Icon name="clock" />About {meal.prepMinutesApprox} min<span>{meal.servings} servings</span><span>For {draft.planDate || planDate}</span></p><p>{meal.fitReason}</p>
            {draft.changesSummary && <p className="change-note">{draft.changesSummary}</p>}
            <div className="refinement-actions"><button className="chip" disabled={locked} onClick={() => entry.localOnly ? showSample('refinement') : requestSuggestion('Make it quicker')}>Make it quicker</button></div>
            <details><summary>How to make it</summary><ol className="recipe-steps">{meal.steps.map((step, i) => <li key={i}>{step}</li>)}</ol></details>
            {meal.uncertainties?.map((warning, i) => <p className="small muted" key={i}>{warning}</p>)}
          </> : <p>{draft.inputSummary?.summary || 'These requests are ready to review.'}</p>}
        </div>
        <div className="cart-preview compact-cart"><h3>{entry.aiPreviewOnly ? 'Ingredient preview' : 'Ready for the cart'}</h3>{entry.aiPreviewOnly && <p className="small muted">AI generated this idea; cart matching and saving need the shared backend.</p>}<p className="cart-summary">{cartSummary || (excluded.length === rows.length ? 'No new items selected.' : 'These items are already on your list.')}</p>
          <details><summary>Review {rows.length} ingredients and requests</summary><p className="small muted">Uncheck anything you already have.</p><ul className="ingredient-list">{rows.map(item => {
            const preview = previews.find(row => row.ingredientId === item.id);
            const owner = item.requestFor && item.requestFor !== 'household' ? workspace.actors.find(actor => actor.id === item.requestFor)?.name || item.requestFor : 'Shared';
            return <li key={item.id}><label><input type="checkbox" checked={!excluded.includes(item.id)} disabled={!!pending || !!saved || !!attempt.current}
              onChange={e => { const next = e.target.checked ? excluded.filter(id => id !== item.id) : [...excluded, item.id]; setExcluded(next); onEntryChange({ ...entry, excluded: next }); }} />
              <span><strong>{item.name}</strong><small>{item.quantity} {item.unit} · {owner}{item.note ? ` · ${item.note}` : ''}</small>
                <small>{preview?.action === 'keep' ? 'Already on the list' : preview?.action === 'increase' ? `Add ${preview.deltaQuantity}; ${preview.existingQuantity} already requested` : preview?.action === 'review' ? 'Check this variant' : `Add ${preview?.deltaQuantity ?? item.quantity}`}</small>
              </span></label></li>;
          })}</ul></details>
        </div>
        {saved ? <div className="save-result" role="status"><div><strong>{saved.message}</strong><p className="small">{meal ? 'Your meal plan was saved too.' : 'Your shared cart is up to date.'}</p></div>
          <button className="button" disabled={!!pending || !connected} onClick={undo}>{pending === 'undo' ? 'Undoing…' : 'Undo'}</button><button className="button primary" onClick={() => navigate('shopping')}>View cart<Icon name="arrow" /></button>
        </div> : <div className="draft-actions"><div>{entry.localOnly ? <p className="small muted">Fixed sample. Ask AI for your own idea when connected.</p> : entry.aiPreviewOnly ? <p className="small muted">Connect the shared backend to match and save these ingredients.</p> : staleDraft ? <><p className="small muted">The cart changed. Check the updated ingredients first.</p><button className="text-button" disabled={locked} onClick={refreshDraft}>Refresh cart preview</button></> : <p className="small muted">{recoveringSave ? 'Check the previous save. It won’t add anything twice.' : meal ? `Adds the reviewed items and saves dinner for ${draft.planDate || planDate}.` : 'Adds the reviewed requests to your cart.'}</p>}</div>
          <button className="button primary" onClick={confirm} disabled={!!pending || entry.localOnly || !connected || staleDraft}>{pending === 'confirm' ? 'Adding…' : recoveringSave ? 'Retry save' : entry.aiPreviewOnly ? 'Cart connection needed' : 'Add to cart'}<Icon name="arrow" /></button>
        </div>}
      </>}
    </section>}

    {draft && <section className="followup" aria-label="Refine your idea"><h2>{draft.kind === 'clarification' ? 'Your reply' : 'Want to change anything?'}</h2>{composer}
      {!connected && <details className="sample-examples"><summary>Try another sample</summary>{starters}<button className="text-button" disabled={locked} onClick={() => showSample('clarification')}>See a dietary clarification</button></details>}
    </section>}
    {workspace.activity?.length > 0 && <section className="recent-section" aria-labelledby="recent-heading"><div className="section-heading"><h2 id="recent-heading">Around your table</h2><button className="text-button" onClick={() => navigate('shopping')}>Open cart<Icon name="arrow" /></button></div><ul className="activity-list">{workspace.activity.slice(-5).reverse().map((event, index) => <li key={event.id || index}><Icon name="leaf" /><span>{event.message || event.summary || 'Group activity recorded'}</span></li>)}</ul></section>}
  </div>;
}
