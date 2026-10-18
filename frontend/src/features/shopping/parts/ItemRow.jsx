import { useEffect, useId, useState } from 'react';
import { useWrite } from '../lib/useWrite.js';
import { formatCents, people, quantityLabel, scopeLabel, UNITS } from '../lib/format.js';
import { PUNT_PROPOSAL } from '../lib/proposal.js';

const draftFrom = item => ({ quantity: String(item.quantity), unit: item.unit || 'count', note: item.note || '', mine: item.requestFor !== 'household' });

// One request stays readable in the cart: item, amount, estimated price, and instructions.
// Bought stays in place (green highlight) instead of moving to a separate Bought list.
// Every change sends expectedItemVersion; a 409 shows the other version and lets you choose.
export default function ItemRow({ item, workspace, actorId, api, onWorkspaceChange, connected, trip, badge, price }) {
  const props = { api, workspace, actorId, onWorkspaceChange };
  const toggle = useWrite(props);
  const edit = useWrite(props);
  const punt = useWrite(props);
  const [wantBought, setWantBought] = useState(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [baseVersion, setBaseVersion] = useState(null);
  const [theirs, setTheirs] = useState(null);
  const panelId = useId(), checkId = useId();
  const { name } = people(workspace, actorId);
  const path = `/api/items/${encodeURIComponent(item.id)}`;

  // Once fresh data arrives, stop showing the optimistic value (unless a retry is pending).
  useEffect(() => {
    if (!toggle.locked) setWantBought(null);
    if (toggle.state.status === 409) toggle.reset();
  }, [item.version, item.bought]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownBought = toggle.state.status === 409 ? item.bought : wantBought ?? item.bought;

  async function setBought(next) {
    setWantBought(next);
    await toggle.send(path, 'PATCH', { expectedItemVersion: item.version, bought: next });
  }

  function openDetails() {
    setDraft(draftFrom(item)); setBaseVersion(item.version); setTheirs(null); edit.reset(); setOpen(true);
  }

  async function save(event, overrideVersion, extra) {
    event?.preventDefault();
    const q = /^\d+$/.test(draft.quantity.trim()) ? Number(draft.quantity.trim()) : NaN;
    if (!extra && !(q >= 1 && q <= 99)) return;
    const version = overrideVersion ?? baseVersion;
    if (overrideVersion != null) setBaseVersion(overrideVersion);
    const fields = extra || { quantity: q, unit: draft.unit, note: draft.note.trim(), requestFor: draft.mine ? (item.requestFor !== 'household' ? item.requestFor : actorId) : 'household' };
    const result = await edit.send(path, 'PATCH', { expectedItemVersion: version, ...fields });
    if (result) { setOpen(false); setTheirs(null); return; }
    const err = edit.getLastError();
    if (err?.status === 409) {
      const fresh = err.payload?.item || err.payload?.workspace?.items?.find(other => other.id === item.id);
      setTheirs(fresh || item);
    }
  }

  // Proposal only (#4): the shopper marks a request the store doesn't have; it leaves this run.
  // While the same run is going, the shopper can put it back.
  const shopperHere = PUNT_PROPOSAL && trip?.claimedBy === actorId && !item.bought;
  const canPunt = shopperHere && item.runId === trip.id;
  const canUnpunt = shopperHere && item.punted?.runId === trip.id;
  async function setPunted(next) {
    await punt.send(path, 'PATCH', { expectedItemVersion: item.version, punted: next });
  }

  const qtyInvalid = !!draft && !(/^\d+$/.test(draft.quantity.trim()) && Number(draft.quantity) >= 1 && Number(draft.quantity) <= 99);
  const priceLabel = price && Number.isInteger(price.cents) ? formatCents(price.cents, price.currency || 'USD') : null;

  return (
    <li className={`rm-item ${shownBought ? 'rm-item-bought' : ''}`}>
      <div className="rm-item-main rm-cart-row">
        <input id={checkId} type="checkbox" className="rm-bought" checked={shownBought} disabled={toggle.locked || !connected}
          aria-busy={toggle.saving} onChange={e => setBought(e.target.checked)} />
        <label htmlFor={checkId} className="rm-item-text">
          <span className="rm-item-name">{item.name}</span>
          {shownBought && <span className="rm-bought-label">Bought</span>}
          {badge && <span className={`rm-badge rm-badge-${badge.kind}`}>{badge.text}</span>}
          <span className="sr-only">{shownBought ? ', bought' : ', not bought yet'}{priceLabel ? `, about ${priceLabel}` : ''}</span>
        </label>
        <span className="rm-cart-amount" aria-label={`Amount ${quantityLabel(item)}`}>{quantityLabel(item)}</span>
        <span className="rm-cart-price" aria-label={`Estimated price ${priceLabel || 'not available'}`}>{priceLabel || 'Not priced'}</span>
        <span className="rm-cart-instruction">{item.note || <span className="rm-help">No special instructions</span>}</span>
        <div className="rm-item-btns">
          {(canPunt || canUnpunt) && (
            <button type="button" className="rm-details-btn" disabled={punt.locked || !connected} title="Proposal: not in API v2 yet"
              aria-label={canPunt ? `Proposal: ${item.name} isn't at this store. Move it to the next run` : `Put ${item.name} back on this run`}
              onClick={() => setPunted(canPunt)}>
              {punt.saving ? 'Moving…' : canPunt ? 'Not here' : 'Put back'}
            </button>
          )}
          <button type="button" className="rm-details-btn" aria-expanded={open} aria-controls={panelId} aria-label={`Edit ${item.name}`} onClick={() => (open ? setOpen(false) : openDetails())}>Edit</button>
        </div>
      </div>

      {toggle.saving && <p className="rm-row-status">Saving…</p>}
      {toggle.state.phase === 'error' && (
        <div className="rm-row-error" role="alert">
          {toggle.state.status === 409 ? <span>Someone updated {item.name} first. This shows the latest.</span> : (
            <>
              <span>{toggle.state.error}</span>
              <span className="rm-row-actions">
                {toggle.state.retryable && <button type="button" className="rm-link" onClick={() => setBought(wantBought)}>Try again</button>}
                <button type="button" className="rm-link" onClick={() => { toggle.reset(); setWantBought(null); }}>Undo</button>
              </span>
            </>
          )}
        </div>
      )}
      {punt.state.phase === 'error' && (
        <div className="rm-row-error" role="alert"><span>{punt.state.error}</span><button type="button" className="rm-link" onClick={punt.reset}>Dismiss</button></div>
      )}

      {open && draft && (
        <form id={panelId} className="rm-edit" onSubmit={save} noValidate aria-label={`Details for ${item.name}`}>
          <fieldset disabled={edit.locked || !connected} className="rm-fieldset">
            <div className="rm-add-row">
              <div className="rm-field rm-qty">
                <label htmlFor={`${panelId}-q`}>Quantity</label>
                <input id={`${panelId}-q`} inputMode="numeric" value={draft.quantity} aria-invalid={qtyInvalid} onChange={e => setDraft({ ...draft, quantity: e.target.value })} />
              </div>
              <div className="rm-field">
                <label htmlFor={`${panelId}-u`}>Unit</label>
                <select id={`${panelId}-u`} value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              <div className="rm-field rm-grow">
                <label htmlFor={`${panelId}-n`}>Note</label>
                <input id={`${panelId}-n`} value={draft.note} maxLength={140} onChange={e => setDraft({ ...draft, note: e.target.value })} />
              </div>
            </div>
            <div className="rm-seg" role="radiogroup" aria-label="Who it's for">
              <label><input type="radio" name={`${panelId}-scope`} checked={!draft.mine} onChange={() => setDraft({ ...draft, mine: false })} /><span>Shared</span></label>
              <label><input type="radio" name={`${panelId}-scope`} checked={draft.mine} onChange={() => setDraft({ ...draft, mine: true })} /><span>{item.requestFor !== 'household' && item.requestFor !== actorId ? `Just ${name(item.requestFor)}` : 'Just me'}</span></label>
            </div>
          </fieldset>

          {qtyInvalid && <p className="rm-error" role="alert">Quantity must be a whole number from 1 to 99.</p>}
          {item.version !== baseVersion && !theirs && <p className="rm-help">Someone updated this request since you opened it. Saving will ask which version to keep.</p>}

          {theirs && (
            <div className="rm-conflict" role="alert">
              <p><strong>Someone changed {item.name} while you were editing.</strong> Their version:</p>
              <p className="rm-help">{quantityLabel(theirs)} · {scopeLabel(theirs, name)}{theirs.note ? ` · "${theirs.note}"` : ''}{theirs.bought ? ' · already bought' : ''}{theirs.removed ? ' · removed' : ''}</p>
              <div className="rm-actions">
                <button type="button" className="rm-btn rm-small" disabled={!connected || theirs.removed} onClick={e => save(e, theirs.version)}>Save mine instead</button>
                <button type="button" className="rm-btn rm-secondary rm-small" onClick={() => { setDraft(draftFrom(theirs)); setBaseVersion(theirs.version); setTheirs(null); edit.reset(); }}>Use theirs</button>
              </div>
            </div>
          )}
          {edit.state.phase === 'error' && !theirs && <div className="rm-error" role="alert"><p>{edit.state.error}</p>{edit.state.retryable && <p className="rm-help">Your edits are kept.</p>}</div>}

          {!theirs && (
            <div className="rm-actions">
              <button type="submit" className="rm-btn rm-small" disabled={edit.saving || qtyInvalid || !connected}>{edit.saving ? 'Saving…' : edit.state.retryable ? 'Try again' : 'Save'}</button>
              <button type="button" className="rm-btn rm-secondary rm-small" disabled={edit.saving} onClick={() => { setOpen(false); edit.reset(); }}>{edit.state.retryable ? 'Discard edits' : 'Cancel'}</button>
              <button type="button" className="rm-link rm-danger" disabled={edit.locked || !connected} onClick={e => save(e, null, { removed: true })}>Remove request</button>
            </div>
          )}
          {!connected && <p className="rm-help">Preview only. Connect the backend to change requests.</p>}
        </form>
      )}
    </li>
  );
}
