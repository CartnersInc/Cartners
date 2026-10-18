import { useId, useMemo, useState } from 'react';
import { useWrite } from '../../shopping/lib/useWrite.js';
import { formatCents, parseDollars, people, whenOf } from '../../shopping/lib/format.js';
import { activeTrip, liveItems } from '../../shopping/lib/trip.js';
import { allocateSplit, lastConfirmedSplit, rememberedPayer, rememberedSharers } from '../lib/remember.js';
import PersonName from '../proposal/PayHandleMarks.jsx';

function centsToText(cents) {
  return (cents / 100).toFixed(2);
}

function personalFromExpense(allocations) {
  const map = {};
  for (const [id, cents] of Object.entries(allocations || {})) {
    map[id] = Number.isInteger(cents)
      ? { text: centsToText(cents), unknown: false }
      : { text: '', unknown: true };
  }
  return map;
}

// Runs a receipt can belong to: finished runs in the snapshot, plus the current one.
export function runsOf(workspace) {
  const completed = Array.isArray(workspace.trip?.completedTrips) ? workspace.trip.completedTrips.filter(run => run?.id) : [];
  const current = activeTrip(workspace);
  return [...completed].reverse().concat(current && !completed.some(run => run.id === current.id) ? [current] : []);
}

// Record purchase (#8). Only the actual total is required for a shared receipt. In split mode,
// personal bought requests open a short exception section: each person's actual personal subtotal.
// The server allocates the shared remainder; this form only validates input.
export default function ReceiptForm({ workspace, actorId, api, onWorkspaceChange, connected, notify, mode: defaultMode, onDone, initialRunId, expense = null }) {
  const [mode, setMode] = useState(expense?.mode || defaultMode);
  const runs = runsOf(workspace);
  const { name, members } = people(workspace, actorId);
  const editing = Boolean(expense?.id);
  const [runId, setRunId] = useState(() => {
    if (editing) return expense.runId || '';
    return runs.some(run => run.id === initialRunId) ? initialRunId : (runs[0]?.id || '');
  });
  const selectedRun = runs.find(run => run.id === runId);
  const [totalText, setTotalText] = useState(() => (editing && Number.isInteger(expense.totalCents) ? centsToText(expense.totalCents) : ''));
  const [payerId, setPayerId] = useState(() => {
    if (editing) return expense.payerId;
    const fromRun = rememberedPayer(workspace, members.map(member => member.id), runs.find(run => run.id === (runs.some(item => item.id === initialRunId) ? initialRunId : runs[0]?.id)));
    return fromRun || actorId;
  });
  const [sharedIds, setSharedIds] = useState(() => (editing && Array.isArray(expense.sharedMemberIds) ? expense.sharedMemberIds : rememberedSharers(workspace, members.map(member => member.id))));
  const [personal, setPersonal] = useState(() => (editing ? personalFromExpense(expense.personalAllocations) : {})); // memberId → { text, unknown }
  const [extraIds, setExtraIds] = useState(() => (editing ? Object.keys(expense.personalAllocations || {}) : []));
  const [separate, setSeparate] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiFilled, setAiFilled] = useState(false);
  const write = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const ids = { run: useId(), total: useId(), payer: useId(), who: useId() };

  // People with personal requests bought on this run get a row automatically.
  const personalBought = useMemo(() => {
    const map = {};
    for (const item of liveItems(workspace)) {
      if (!runId || item.runId !== runId || !item.bought || !item.requestFor || item.requestFor === 'household') continue;
      (map[item.requestFor] ||= []).push(item.name);
    }
    return map;
  }, [workspace, runId]);
  const personalIds = [...new Set([...Object.keys(personalBought), ...extraIds])];
  const alreadyRecorded = runId && (workspace.expenses || []).some(item => item.runId === runId && item.id !== expense?.id);

  const { body, errors, needsReview } = useMemo(() => {
    const errs = [];
    const totalCents = parseDollars(totalText);
    if (!members.some(member => member.id === payerId)) errs.push('Choose who paid before saving.');
    if (totalCents == null || totalCents <= 0) errs.push('Enter the actual receipt total, including tax and fees, like 20.00.');
    const allocations = {};
    let known = 0, unknown = false;
    if (mode === 'split') {
      for (const id of personalIds) {
        const entry = personal[id] || { text: '', unknown: false };
        if (entry.unknown) { allocations[id] = null; unknown = true; continue; }
        const cents = parseDollars(entry.text);
        if (entry.text.trim() === '' && !entry.unknown) continue;
        if (cents == null) { errs.push(`Enter ${name(id) === 'You' ? 'your' : `${name(id)}'s`} personal subtotal, or choose "Don't know".`); continue; }
        if (cents > 0) { allocations[id] = cents; known += cents; }
      }
      if (totalCents != null && known > totalCents) errs.push('Personal subtotals add up to more than the receipt total.');
      if (totalCents != null && totalCents > known && !sharedIds.length) errs.push('Choose at least one person to share the rest of the receipt.');
    }
    if (alreadyRecorded && !separate) errs.push('This run already has a receipt. Confirm this is a separate receipt to record another.');
    return {
      errors: errs,
      needsReview: unknown,
      body: {
        runId: runId || null,
        totalCents,
        payerId,
        mode,
        sharedMemberIds: mode === 'split' ? members.map(m => m.id).filter(id => sharedIds.includes(id)) : [],
        personalAllocations: mode === 'split' ? allocations : {},
        status: unknown ? 'needs_review' : 'confirmed',
      },
    };
  }, [totalText, payerId, sharedIds, personal, personalIds.join(), mode, runId, alreadyRecorded, separate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(event) {
    event.preventDefault();
    if (errors.length || !connected) { setShowErrors(true); return; }
    const result = await write.send(editing ? `/api/expenses/${expense.id}` : '/api/expenses', editing ? 'PATCH' : 'POST', body);
    if (!result) return;
    notify?.(result.changeSummary || (needsReview ? 'Saved as Needs review. Nobody owes anything for it yet.' : 'Receipt saved.'));
    onDone();
  }

  async function fillFromNote() {
    if (!connected || !aiNote.trim() || aiPending) return;
    setAiPending(true); setAiError(''); setAiFilled(false);
    try {
      const result = await api.request('/api/ai/expense-draft', { method: 'POST', body: {
        workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(), message: aiNote.trim(), mode,
      } });
      setTotalText(Number.isInteger(result.totalCents) && result.totalCents > 0 ? (result.totalCents / 100).toFixed(2) : '');
      if (workspace.actors.some(actor => actor.id === result.payerId)) setPayerId(result.payerId);
      if (Array.isArray(result.sharedMemberIds) && result.sharedMemberIds.length) {
        setSharedIds(result.sharedMemberIds.filter(id => members.some(member => member.id === id)));
      }
      const parsed = result.personalAllocations && typeof result.personalAllocations === 'object' ? result.personalAllocations : {};
      const validIds = Object.keys(parsed).filter(id => members.some(member => member.id === id));
      {
        setExtraIds(validIds.filter(id => !personalBought[id]));
        setPersonal(map => {
          const next = {};
          for (const id of validIds) next[id] = parsed[id] == null
            ? { text: '', unknown: true }
            : { text: (parsed[id] / 100).toFixed(2), unknown: false };
          return next;
        });
      }
      const missing = Array.isArray(result.missing) ? result.missing : [];
      setAiFilled(true);
      if (missing.length || result.clarification) setAiError(result.clarification || `Please fill in ${missing.join(' and ')} below. AI only uses details you included.`);
    } catch (error) { setAiError(error.message || 'Could not read that purchase. Try again or fill the receipt in below.'); }
    finally { setAiPending(false); }
  }

  const toggleShared = id => setSharedIds(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  const setEntry = (id, patch) => setPersonal(map => ({ ...map, [id]: { text: '', unknown: false, ...map[id], ...patch } }));
  const addable = members.filter(m => !personalIds.includes(m.id));
  const retrying = write.state.phase === 'error' && write.state.retryable;
  const lastSplit = lastConfirmedSplit(workspace.expenses);
  const preview = mode === 'split' && Number.isInteger(body.totalCents) && body.totalCents > 0 && !needsReview
    ? allocateSplit(body.totalCents, sharedIds, body.personalAllocations)
    : null;

  return (
    <form className="rm-card rm-form" onSubmit={submit} noValidate aria-label={editing ? 'Resolve this receipt' : 'Record a purchase'}>
      <h2 className="rm-h2">{editing ? 'Resolve this receipt' : 'Record a purchase'}</h2>
      <div className="receipt-ai">
        <label htmlFor={`${ids.total}-note`}>Describe the receipt</label>
        <p className="rm-help">{mode === 'split'
          ? 'Say the receipt total. Cartners remembers who split last time and even-splits the rest. Mention a personal amount only if one person kept something.'
          : 'Say who paid and the receipt total. Family grocery runs stay pooled — nobody owes anyone.'}</p>
        <textarea id={`${ids.total}-note`} rows="2" maxLength="500" value={aiNote} onChange={event => setAiNote(event.target.value)} placeholder="Say who paid and the exact total…" disabled={!connected || aiPending || write.locked} />
        <div className="rm-actions"><button type="button" className="rm-btn rm-secondary" disabled={!connected || !aiNote.trim() || aiPending || write.locked} onClick={fillFromNote}>{aiPending ? 'Reading…' : 'Review purchase'}</button></div>
        {aiFilled && <p className="rm-notice" role="status">Check the amount and who paid below. Nothing is recorded until you confirm.</p>}
        {aiError && <p className="rm-help" role="status">{aiError}</p>}
      </div>
      <fieldset className="rm-fieldset" disabled={editing || aiPending || write.locked}>
        <legend>How should we record this?</legend>
        <div className="rm-checks"><label className="rm-check"><input type="radio" name="expense-mode" checked={mode === 'pooled'} onChange={() => setMode('pooled')} />Just track who paid</label><label className="rm-check"><input type="radio" name="expense-mode" checked={mode === 'split'} onChange={() => setMode('split')} />Split with people</label></div>
      </fieldset>
      <details className="receipt-review" open={mode === 'split' || aiFilled || editing || showErrors || Boolean(initialRunId) || undefined}>
        <summary>{aiFilled || editing || initialRunId ? 'Review purchase details' : 'Enter the total — we split it'}</summary>
      <fieldset disabled={write.locked || !connected} className="rm-fieldset">
        <div className="rm-field">
          <label htmlFor={ids.run}>Shopping trip (optional)</label>
          <select id={ids.run} value={runId} onChange={e => { setRunId(e.target.value); setSeparate(false); }}>
            <option value="">Not part of a store run</option>
            {runs.map(run => <option key={run.id} value={run.id}>{name(run.claimedBy)}'s run to {run.storeName || 'the store'}{run.claimedAt ? `, ${whenOf(run.claimedAt)}` : ''}</option>)}
          </select>
        </div>
        {alreadyRecorded && (
          <label className="rm-check rm-warn"><input type="checkbox" checked={separate} onChange={e => setSeparate(e.target.checked)} /><span>This run already has a receipt. This is a separate receipt.</span></label>
        )}
        <div className="rm-add-row">
          <div className="rm-field rm-grow">
            <label htmlFor={ids.total}>Actual total</label>
            <input id={ids.total} inputMode="decimal" placeholder="0.00" value={totalText} onChange={e => setTotalText(e.target.value)} aria-describedby={`${ids.total}-help`} />
            <span id={`${ids.total}-help`} className="rm-help">Include tax and fees. Never an estimate.</span>
          </div>
          <div className="rm-field rm-grow">
            <label htmlFor={ids.payer}>Paid by</label>
            <select id={ids.payer} value={payerId} onChange={e => setPayerId(e.target.value)}>
              <option value="">Choose who paid</option>{workspace.actors.map(actor => <option key={actor.id} value={actor.id}>{actor.id === actorId ? `${actor.name} (you)` : actor.name}</option>)}
            </select>
          </div>
        </div>

        {mode === 'pooled' ? (
          <p className="rm-help">This group pools spending, so this records who paid. Nobody will owe anyone.</p>
        ) : (
          <>
            <div className="rm-field">
              <span className="rm-label" id={ids.who}>Who shares the rest?</span>
              <div className="rm-checks" role="group" aria-labelledby={ids.who}>
                {members.map(m => <label key={m.id} className="rm-check"><input type="checkbox" checked={sharedIds.includes(m.id)} onChange={() => toggleShared(m.id)} /><PersonName workspace={workspace} actorId={m.id}>{m.name}</PersonName></label>)}
              </div>
              <span className="rm-help">{lastSplit
                ? `Same people as the last confirmed receipt${selectedRun ? `, unless you change it for ${selectedRun.storeName || 'this run'}` : ''}.`
                : 'Everyone in the household is included until you uncheck someone.'}</span>
            </div>
            {preview && (
              <div className="rm-split-preview" role="status">
                <p className="rm-label">Each person’s share</p>
                <ul className="rm-plain">
                  {Object.entries(preview).sort(([a], [b]) => a.localeCompare(b)).map(([id, cents]) => (
                    <li key={id} className="rm-balance"><span><PersonName workspace={workspace} actorId={id}>{name(id)}</PersonName>{id === payerId ? ' (paid the store)' : ''}</span><span className="rm-price">{formatCents(cents)}</span></li>
                  ))}
                </ul>
                <p className="rm-help">Even split of what’s left after any personal amounts. Saving still needs your confirmation — this is not a payment.</p>
              </div>
            )}
            <div className="rm-field">
              <span className="rm-label">Personal items (optional)</span>
              <p className="rm-help">Leave amounts blank to split the whole receipt evenly. Fill a row only if something was just for one person.</p>
              {personalIds.map(id => {
                const entry = personal[id] || { text: '', unknown: false };
                return (
                  <div key={id} className="rm-exception">
                    <span className="rm-exception-who"><strong><PersonName workspace={workspace} actorId={id}>{name(id)}</PersonName></strong>{personalBought[id] ? <span className="rm-help"> {personalBought[id].join(', ')}</span> : null}</span>
                    <input aria-label={`${name(id)} personal subtotal`} inputMode="decimal" placeholder="0.00" className="rm-amount" disabled={entry.unknown} value={entry.unknown ? '' : entry.text} onChange={e => setEntry(id, { text: e.target.value })} />
                    <label className="rm-check rm-small-text"><input type="checkbox" checked={entry.unknown} onChange={e => setEntry(id, { unknown: e.target.checked })} /><span>Don't know</span></label>
                    {!personalBought[id] && <button type="button" className="rm-icon-btn" aria-label={`Remove ${name(id)}'s personal amount`} onClick={() => { setExtraIds(list => list.filter(x => x !== id)); setPersonal(map => { const next = { ...map }; delete next[id]; return next; }); }}>×</button>}
                  </div>
                );
              })}
              {addable.length > 0 && (
                <select className="rm-add-personal" aria-label="Add a personal amount" value="" onChange={e => e.target.value && setExtraIds(list => [...list, e.target.value])}>
                  <option value="">+ Add a personal amount…</option>
                  {addable.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              {needsReview && <p className="rm-notice">{editing ? 'This receipt stays' : 'This receipt will save as'} <strong>Needs review</strong>. It won't affect balances until the missing amount is filled in.</p>}
            </div>
          </>
        )}
      </fieldset>

      {showErrors && errors.length > 0 && <ul className="rm-error" role="alert">{errors.map(text => <li key={text}>{text}</li>)}</ul>}
      {write.state.phase === 'error' && (
        <div className="rm-error" role="alert"><p>{write.state.error}</p>{retrying && <p className="rm-help">The form is locked so this receipt can't be recorded twice.</p>}</div>
      )}
      <div className="rm-actions">
        {retrying ? (
          <>
            <button type="submit" className="rm-btn">Try again</button>
            <button type="button" className="rm-btn rm-secondary" onClick={() => { write.reset(); onDone(); }}>Discard</button>
          </>
        ) : (
          <>
            <button type="submit" className="rm-btn" disabled={write.saving || !connected}>{write.saving ? 'Saving…' : editing ? (needsReview ? 'Save, still needs review' : (body.totalCents ? `Confirm ${formatCents(body.totalCents)} receipt` : 'Confirm receipt')) : (body.totalCents ? `Save ${formatCents(body.totalCents)} receipt` : 'Save receipt')}</button>
            <button type="button" className="rm-btn rm-secondary" disabled={write.saving} onClick={onDone}>Cancel</button>
          </>
        )}
      </div>
      </details>
      {!connected && <p className="rm-help">Preview only. Connect the backend to record purchases.</p>}
    </form>
  );
}
