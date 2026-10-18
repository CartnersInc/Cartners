import { useEffect, useId, useState } from "react";
import { api } from "../lib/api.js";
import { useIdempotentWrite } from "../lib/useIdempotentWrite.js";
import { dateOf, memberName, STORE_SUGGESTIONS } from "./helpers.js";

const draftFrom = (item) => ({
  quantity: String(item.quantity),
  note: item.note || "",
  store: item.store || "",
  needed_by: item.needed_by || "",
});

// One item: a large Bought checkbox, quantity and note, and a Details panel for edits.
export default function ItemRow({ item, groupId, members, me, run, badge, onChanged }) {
  const toggle = useIdempotentWrite();
  const edit = useIdempotentWrite();
  const punt = useIdempotentWrite();
  const [wantBought, setWantBought] = useState(null); // what the person clicked, until the server confirms
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [baseVersion, setBaseVersion] = useState(null);
  const panelId = useId();
  const checkId = useId();

  // Once fresh data arrives, stop showing the optimistic value.
  useEffect(() => {
    if (toggle.state.phase !== "saving" && !(toggle.state.phase === "error" && toggle.state.retryable)) setWantBought(null);
    if (toggle.state.conflict) toggle.reset();
  }, [item.version, item.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBought = item.status === "bought";
  const shownBought = toggle.state.conflict ? isBought : wantBought ?? isBought;

  async function setBought(next) {
    setWantBought(next);
    await toggle.submit((p, key) => api.updateItem(groupId, item.id, p, key), { version: item.version, changes: { bought: next } });
    onChanged();
  }

  // The shopper can punt an item the store doesn't have to the next trip, and undo
  // that while the same trip is still going.
  const isShopper = run?.shopper_id === me;
  const canPunt = isShopper && item.status === "open" && item.run_id === run.id;
  const canUnpunt = isShopper && item.status === "open" && item.punted?.run_id === run.id;

  async function setPunted(next) {
    await punt.submit((p, key) => api.updateItem(groupId, item.id, p, key), { version: item.version, changes: { punted: next } });
    onChanged();
  }

  // A conflict means the item changed underneath us; fresh data shows what happened.
  useEffect(() => { if (punt.state.conflict) punt.reset(); }, [item.version]); // eslint-disable-line react-hooks/exhaustive-deps

  function openDetails() {
    setDraft(draftFrom(item));
    setBaseVersion(item.version);
    edit.reset();
    setOpen(true);
  }

  async function saveDetails(e, versionOverride) {
    e?.preventDefault();
    const q = /^\d+$/.test(draft.quantity.trim()) ? Number(draft.quantity.trim()) : NaN;
    if (!(q >= 1 && q <= 99)) return;
    const version = versionOverride ?? baseVersion;
    if (versionOverride != null) setBaseVersion(versionOverride);
    const payload = {
      version,
      changes: { quantity: q, note: draft.note.trim(), store: draft.store.trim() || null, needed_by: draft.needed_by || null },
    };
    const result = await edit.submit((p, key) => api.updateItem(groupId, item.id, p, key), payload);
    if (result) { setOpen(false); onChanged(); }
  }

  const theirs = edit.state.conflict?.item;
  const qtyInvalid = !!draft && !(/^\d+$/.test(draft.quantity.trim()) && Number(draft.quantity) >= 1 && Number(draft.quantity) <= 99);
  const meta = [
    `Added by ${memberName(members, item.requested_by, me).replace(/^You$/, "you")}`,
    item.store && `at ${item.store}`,
    item.needed_by && `needed by ${dateOf(item.needed_by)}`,
  ].filter(Boolean).join(", ");

  return (
    <li className={`ap-item ${shownBought ? "ap-item-bought" : ""}`}>
      <div className="ap-item-main">
        <input
          id={checkId}
          type="checkbox"
          className="ap-bought"
          checked={shownBought}
          disabled={toggle.locked}
          aria-busy={toggle.state.phase === "saving"}
          onChange={(e) => setBought(e.target.checked)}
        />
        <label htmlFor={checkId} className="ap-item-text">
          <span className="ap-item-name">
            {item.name}
            {item.quantity > 1 && <span className="ap-qty-badge" aria-label={`quantity ${item.quantity}`}> ×{item.quantity}</span>}
          </span>
          {item.note && <span className="ap-item-note">{item.note}</span>}
          <span className="ap-item-meta">{meta}</span>
          {badge && <span className={`ap-badge ap-badge-${badge.kind}`}>{badge.text}</span>}
          <span className="ap-visually-hidden">{shownBought ? ", bought" : ", not bought yet"}</span>
        </label>
        <div className="ap-item-btns">
          {(canPunt || canUnpunt) && (
            <button
              type="button"
              className="ap-details-btn"
              disabled={punt.locked}
              aria-label={canPunt ? `${item.name} isn't here. Move it to the next trip` : `Put ${item.name} back on this trip`}
              onClick={() => setPunted(canPunt)}
            >
              {punt.state.phase === "saving" ? "Moving…" : canPunt ? "Not here" : "Put back"}
            </button>
          )}
          <button type="button" className="ap-details-btn" aria-expanded={open} aria-controls={panelId} onClick={() => (open ? setOpen(false) : openDetails())}>
            Details
          </button>
        </div>
      </div>

      {punt.state.phase === "error" && (
        <div className="ap-row-error" role="alert">
          {punt.state.conflict ? (
            <span>Someone updated {item.name} first. This shows the latest.</span>
          ) : (
            <>
              <span>{punt.state.error}</span>
              <span className="ap-row-actions">
                {punt.state.retryable && <button type="button" className="ap-link" onClick={() => setPunted(!!canPunt)}>Try again</button>}
                <button type="button" className="ap-link" onClick={() => punt.reset()}>Dismiss</button>
              </span>
            </>
          )}
        </div>
      )}

      {toggle.state.phase === "saving" && <p className="ap-row-status">Saving…</p>}
      {toggle.state.phase === "error" && (
        <div className="ap-row-error" role="alert">
          {toggle.state.conflict ? (
            <span>Someone updated {item.name} first. This shows the latest.</span>
          ) : (
            <>
              <span>{toggle.state.error}</span>
              {toggle.state.retryable && (
                <span className="ap-row-actions">
                  <button type="button" className="ap-link" onClick={() => setBought(wantBought)}>Try again</button>
                  <button type="button" className="ap-link" onClick={() => { toggle.reset(); setWantBought(null); }}>Undo</button>
                </span>
              )}
            </>
          )}
        </div>
      )}

      {open && draft && (
        <form id={panelId} className="ap-edit" onSubmit={saveDetails} noValidate aria-label={`Details for ${item.name}`}>
          <fieldset disabled={edit.locked} className="ap-fieldset">
            <div className="ap-add-row">
              <div className="ap-field ap-qty-sm">
                <label htmlFor={`${panelId}-q`}>Quantity</label>
                <input id={`${panelId}-q`} inputMode="numeric" value={draft.quantity} aria-invalid={qtyInvalid} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
              </div>
              <div className="ap-field ap-grow">
                <label htmlFor={`${panelId}-s`}>Store</label>
                <input id={`${panelId}-s`} list="ap-store-options-edit" value={draft.store} maxLength={40} onChange={(e) => setDraft({ ...draft, store: e.target.value })} />
              </div>
            </div>
            <div className="ap-add-row">
              <div className="ap-field ap-grow">
                <label htmlFor={`${panelId}-n`}>Note</label>
                <input id={`${panelId}-n`} value={draft.note} maxLength={140} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </div>
              <div className="ap-field">
                <label htmlFor={`${panelId}-d`}>Needed by</label>
                <input id={`${panelId}-d`} type="date" value={draft.needed_by} onChange={(e) => setDraft({ ...draft, needed_by: e.target.value })} />
              </div>
            </div>
            <datalist id="ap-store-options-edit">{STORE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          </fieldset>

          {qtyInvalid && <p className="ap-error" role="alert">Quantity must be a whole number from 1 to 99.</p>}
          {item.version !== baseVersion && !theirs && (
            <p className="ap-help">Someone updated this item since you opened it. Saving will ask which version to keep.</p>
          )}

          {theirs && (
            <div className="ap-conflict" role="alert">
              <p><strong>Someone changed {item.name} while you were editing.</strong> Their version:</p>
              <p className="ap-help">
                Quantity {theirs.quantity}{theirs.note ? `, note "${theirs.note}"` : ""}{theirs.store ? `, at ${theirs.store}` : ""}{theirs.needed_by ? `, needed by ${dateOf(theirs.needed_by)}` : ""}
                {theirs.status === "bought" ? ", already bought" : ""}
              </p>
              <div className="ap-actions">
                <button type="button" className="ap-btn ap-small" onClick={(e) => saveDetails(e, theirs.version)}>Save mine instead</button>
                <button type="button" className="ap-btn ap-secondary ap-small" onClick={() => { setDraft(draftFrom(theirs)); setBaseVersion(theirs.version); edit.reset(); }}>Use theirs</button>
              </div>
            </div>
          )}
          {edit.state.phase === "error" && !theirs && (
            <div className="ap-error" role="alert"><p>{edit.state.error}</p>{edit.state.retryable && <p className="ap-help">Your edits are kept.</p>}</div>
          )}

          {!theirs && (
            <div className="ap-actions">
              <button type="submit" className="ap-btn ap-small" disabled={edit.state.phase === "saving" || qtyInvalid}>
                {edit.state.phase === "saving" ? "Saving…" : edit.state.retryable ? "Try again" : "Save"}
              </button>
              <button type="button" className="ap-btn ap-secondary ap-small" disabled={edit.state.phase === "saving"} onClick={() => { setOpen(false); edit.reset(); }}>
                {edit.state.retryable ? "Discard edits" : "Cancel"}
              </button>
            </div>
          )}
        </form>
      )}
    </li>
  );
}
