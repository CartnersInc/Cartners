import { useId, useState } from 'react';
import { useWrite } from '../lib/useWrite.js';
import { clock, people, UNITS } from '../lib/format.js';
import { acceptingRequests, activeTrip, liveItems } from '../lib/trip.js';

// Add a request. Only the name is required; Shared is the default and Just me sits beside it.
// Quantity, unit and note expand only when needed.
export default function AddItemForm({ workspace, actorId, api, onWorkspaceChange, connected, serverNowMs, notify, nameRef }) {
  const [name, setName] = useState('');
  const [mine, setMine] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('count');
  const [note, setNote] = useState('');
  const [details, setDetails] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const write = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const bump = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const ids = { name: useId(), qty: useId(), unit: useId(), note: useId(), details: useId(), err: useId() };
  const { possessive } = people(workspace, actorId);
  const trip = activeTrip(workspace);
  const open = acceptingRequests(trip, serverNowMs);

  const qty = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : NaN;
  const nameError = !name.trim() ? 'Give the request a name.' : null;
  const qtyError = !(qty >= 1 && qty <= 99) ? 'Quantity must be a whole number from 1 to 99.' : null;
  const errors = submitted ? [nameError, qtyError].filter(Boolean) : [];

  async function submit(event) {
    event.preventDefault();
    setSubmitted(true); setMessage(''); setDuplicate(null);
    if (nameError || qtyError || !connected) { if (nameError) nameRef?.current?.focus(); return; }
    const result = await write.send('/api/items', 'POST', { name: name.trim(), quantity: qty, unit, note: note.trim(), requestFor: mine ? actorId : 'household' });
    if (!result) return;
    if (result.duplicate && result.itemId) {
      const existing = liveItems(result.workspace || workspace).find(item => item.id === result.itemId);
      setDuplicate(existing ? { item: existing, add: qty } : null);
      setMessage(result.changeSummary || `${name.trim()} is already on the list, so it wasn't added twice.`);
      write.reset();
      return;
    }
    const saved = liveItems(result.workspace || workspace).find(item => item.id === result.itemId);
    const text = result.changeSummary || (saved?.runId && trip ? `Added ${name.trim()} to ${possessive(trip.claimedBy)} run.` : trip ? `Added ${name.trim()}. It waits for the next run.` : `Added ${name.trim()}.`);
    clear(); setMessage(text); notify?.(text);
    setTimeout(() => nameRef?.current?.focus(), 0);
  }

  async function increase() {
    const { item, add } = duplicate;
    const result = await bump.send(`/api/items/${encodeURIComponent(item.id)}`, 'PATCH', { expectedItemVersion: item.version, quantity: item.quantity + add });
    if (result) { setMessage(`${item.name} is now ${item.quantity + add}.`); setDuplicate(null); clear(); }
  }

  function clear() {
    setName(''); setQuantity('1'); setUnit('count'); setNote(''); setDetails(false); setSubmitted(false); write.reset();
  }

  function discard() {
    clear();
    setMessage('Discarded. Check the list to see whether it saved before adding it again.');
  }

  const retrying = write.state.phase === 'error' && write.state.retryable;
  return (
    <form className="rm-card rm-add" onSubmit={submit} noValidate aria-label="Add an item">
      <fieldset disabled={write.locked || !connected} className="rm-fieldset">
        <div className="rm-add-row">
          <div className="rm-field rm-grow">
            <label htmlFor={ids.name}>Add an item</label>
            <input id={ids.name} ref={nameRef} value={name} maxLength={80} autoComplete="off" enterKeyHint="done" placeholder="Oat milk"
              aria-invalid={submitted && !!nameError} aria-describedby={errors.length ? ids.err : undefined}
              onChange={e => { setName(e.target.value); setMessage(''); setDuplicate(null); }} />
          </div>
          <div className="rm-field">
            <span className="rm-label" id={`${ids.name}-for`}>For</span>
            <div className="rm-seg" role="radiogroup" aria-labelledby={`${ids.name}-for`}>
              <label><input type="radio" name={`${ids.name}-scope`} checked={!mine} onChange={() => setMine(false)} /><span>Shared</span></label>
              <label><input type="radio" name={`${ids.name}-scope`} checked={mine} onChange={() => setMine(true)} /><span>Just me</span></label>
            </div>
          </div>
        </div>
        <button type="button" className="rm-link" aria-expanded={details} aria-controls={ids.details} onClick={() => setDetails(v => !v)}>
          {details ? 'Hide details' : 'Quantity, unit, note'}
        </button>
        {details && (
          <div id={ids.details} className="rm-add-row rm-details">
            <div className="rm-field rm-qty">
              <label htmlFor={ids.qty}>Quantity</label>
              <input id={ids.qty} inputMode="numeric" value={quantity} aria-invalid={submitted && !!qtyError} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="rm-field">
              <label htmlFor={ids.unit}>Unit</label>
              <select id={ids.unit} value={unit} onChange={e => setUnit(e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div className="rm-field rm-grow">
              <label htmlFor={ids.note}>Note <span className="rm-optional">optional</span></label>
              <input id={ids.note} value={note} maxLength={140} placeholder="Brand, size, substitutions" onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        )}
      </fieldset>

      {errors.length > 0 && <ul id={ids.err} className="rm-error" role="alert">{errors.map(text => <li key={text}>{text}</li>)}</ul>}
      {write.state.phase === 'error' && (
        <div className="rm-error" role="alert">
          <p>{write.state.error}</p>
          {retrying && <p className="rm-help">What you typed is kept and locked, so this request can't be added twice.</p>}
        </div>
      )}

      <div className="rm-actions">
        {retrying ? (
          <>
            <button type="submit" className="rm-btn">Try again</button>
            <button type="button" className="rm-btn rm-secondary" onClick={discard}>Discard</button>
          </>
        ) : (
          <button type="submit" className="rm-btn" disabled={write.saving || !connected}>{write.saving ? 'Adding…' : 'Add to cart'}</button>
        )}
      </div>

      {!connected && <p className="rm-help">Preview only. Connect the backend to add requests.</p>}
      {connected && trip && (
        <p className="rm-help">{open
          ? `New requests join ${possessive(trip.claimedBy)} run for ${clock(Date.parse(trip.requestDeadlineAt) - serverNowMs)} more.`
          : `${possessive(trip.claimedBy).replace(/^./, c => c.toUpperCase())} run isn't taking requests. Anything you add waits for the next run.`}</p>
      )}
      <p className="rm-ok" aria-live="polite">{message}</p>
      {duplicate && (
        <div className="rm-notice rm-notice-ok">
          <span>{duplicate.item.name} already asks for {duplicate.item.quantity}. Change it to {duplicate.item.quantity + duplicate.add}?</span>
          <span className="rm-row-actions">
            <button type="button" className="rm-link" disabled={bump.saving} onClick={increase}>{bump.saving ? 'Saving…' : `Make it ${duplicate.item.quantity + duplicate.add}`}</button>
            <button type="button" className="rm-link" onClick={() => { setDuplicate(null); bump.reset(); }}>Keep {duplicate.item.quantity}</button>
          </span>
          {bump.state.phase === 'error' && <span className="rm-error" role="alert">{bump.state.error}</span>}
        </div>
      )}
    </form>
  );
}
