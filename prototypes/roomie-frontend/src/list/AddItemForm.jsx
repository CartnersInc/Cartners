import { useId, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useIdempotentWrite } from "../lib/useIdempotentWrite.js";
import { clock, possessive, runIsOpen, STORE_SUGGESTIONS } from "./helpers.js";

// Add an item. Only the name is required; quantity starts at 1.
// Store, date, and note are optional and live under "Details".
export default function AddItemForm({ groupId, snapshot, me, serverNowMs, onSaved, nameRef }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [showDetails, setShowDetails] = useState(false);
  const [note, setNote] = useState("");
  const [store, setStore] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const write = useIdempotentWrite();
  const qtyRef = useRef(null);
  const ids = { name: useId(), qty: useId(), details: useId(), note: useId(), store: useId(), date: useId(), err: useId() };

  const { members } = snapshot;
  const run = snapshot.run;
  const open = runIsOpen(run, serverNowMs);
  const qtyNum = /^\d+$/.test(qty.trim()) ? Number(qty.trim()) : NaN;
  const nameError = !name.trim() ? "Give the item a name." : null;
  const qtyError = !(qtyNum >= 1 && qtyNum <= 99) ? "Quantity must be a whole number from 1 to 99." : null;

  function stepQty(delta) {
    const base = Number.isNaN(qtyNum) ? 1 : qtyNum;
    setQty(String(Math.min(99, Math.max(1, base + delta))));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setMessage("");
    if (nameError) { nameRef.current?.focus(); return; }
    if (qtyError) { qtyRef.current?.focus(); return; }
    const payload = {
      name: name.trim(),
      quantity: qtyNum,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(store.trim() ? { store: store.trim() } : {}),
      ...(neededBy ? { needed_by: neededBy } : {}),
    };
    const result = await write.submit((p, key) => api.addItem(groupId, p, key), payload);
    if (!result) return; // inputs stay as typed; the error explains what happened
    const item = result.data.item;
    clearForm();
    setMessage(
      result.replayed ? `${item.name} was already on the list, so it wasn't added twice.`
        : item.run_id ? `Added ${item.name} to ${possessive(members, run?.shopper_id, me)} trip.`
          : run ? `Added ${item.name}. It'll wait for the next trip.`
            : `Added ${item.name}.`
    );
    onSaved();
    setTimeout(() => nameRef.current?.focus(), 0); // after the fieldset re-enables
  }

  function clearForm() {
    setName(""); setQty("1"); setNote(""); setStore(""); setNeededBy("");
    setShowDetails(false); setSubmitted(false); write.reset();
  }

  function discard() {
    clearForm();
    setMessage("Discarded. Check the list to see whether it saved before adding it again.");
    onSaved();
  }

  const errors = submitted ? [nameError, qtyError].filter(Boolean) : [];
  const retrying = write.state.phase === "error" && write.state.retryable;

  return (
    <form className="ap-card ap-add" onSubmit={handleSubmit} noValidate aria-label="Add an item">
      <fieldset disabled={write.locked} className="ap-fieldset">
        <div className="ap-add-row">
          <div className="ap-field ap-grow">
            <label htmlFor={ids.name}>Item</label>
            <input
              id={ids.name}
              ref={nameRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setMessage(""); }}
              placeholder="Olive oil"
              maxLength={60}
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={submitted && !!nameError}
              aria-describedby={errors.length ? ids.err : undefined}
            />
          </div>
          <div className="ap-field ap-qty">
            <label htmlFor={ids.qty}>Qty</label>
            <div className="ap-stepper">
              <button type="button" onClick={() => stepQty(-1)} aria-label="Fewer">−</button>
              <input
                id={ids.qty}
                ref={qtyRef}
                value={qty}
                inputMode="numeric"
                onChange={(e) => setQty(e.target.value)}
                aria-invalid={submitted && !!qtyError}
              />
              <button type="button" onClick={() => stepQty(1)} aria-label="More">+</button>
            </div>
          </div>
        </div>

        <button type="button" className="ap-link" aria-expanded={showDetails} aria-controls={ids.details} onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? "Hide details" : "Details: note, store, date"}
        </button>
        {showDetails && (
          <div id={ids.details} className="ap-details">
            <div className="ap-field">
              <label htmlFor={ids.note}>Note <span className="ap-optional">optional</span></label>
              <input id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Brand, size, anything helpful" maxLength={140} />
            </div>
            <div className="ap-add-row">
              <div className="ap-field ap-grow">
                <label htmlFor={ids.store}>Store <span className="ap-optional">optional</span></label>
                <input id={ids.store} value={store} onChange={(e) => setStore(e.target.value)} list="ap-store-options" maxLength={40} />
              </div>
              <div className="ap-field ap-grow">
                <label htmlFor={ids.date}>Needed by <span className="ap-optional">optional</span></label>
                <input id={ids.date} type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </fieldset>

      {errors.length > 0 && <ul id={ids.err} className="ap-error" role="alert">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
      {write.state.phase === "error" && (
        <div className="ap-error" role="alert">
          <p>{write.state.error}</p>
          {retrying && <p className="ap-help">What you typed is kept. It's locked so this item can't be added twice.</p>}
        </div>
      )}

      <div className="ap-actions">
        {retrying ? (
          <>
            <button type="submit" className="ap-btn">Try again</button>
            <button type="button" className="ap-btn ap-secondary" onClick={discard}>Discard</button>
          </>
        ) : (
          <button type="submit" className="ap-btn" disabled={write.state.phase === "saving"}>
            {write.state.phase === "saving" ? "Adding…" : "Add to list"}
          </button>
        )}
      </div>

      <p className="ap-help">
        {run && open && `New items join ${possessive(members, run.shopper_id, me)} trip for ${clock(Date.parse(run.closes_at) - serverNowMs)} more.`}
        {run && !open && `${possessive(members, run.shopper_id, me).replace(/^./, (c) => c.toUpperCase())} trip isn't taking new items. Anything you add waits for the next trip.`}
      </p>
      <p className="ap-ok" aria-live="polite">{message}</p>

      <datalist id="ap-store-options">
        {STORE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>
    </form>
  );
}
