import { useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { formatWhen, parseDollarsToCents } from "../lib/format.js";
import { useIdempotentWrite } from "../lib/useIdempotentWrite.js";

let rowCounter = 0;

function emptyForm(currentMemberId, members) {
  return {
    store: "",
    totalText: "",
    payerId: currentMemberId,
    runId: "",
    mode: "split",
    participantIds: members.map((m) => m.id),
    exceptions: [],
  };
}

export default function RecordReceiptForm({ householdId, members, runs, currentMemberId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(currentMemberId, members));
  const [showErrors, setShowErrors] = useState(false);
  const write = useIdempotentWrite();
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? "Someone";

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function chooseRun(runId) {
    const run = runs.find((r) => r.id === runId);
    // Linking a run fills in its store and makes the person who did the run the default payer.
    set(run ? { runId, store: form.store || run.store, payerId: run.started_by } : { runId: "" });
  }

  function toggleParticipant(id) {
    const has = form.participantIds.includes(id);
    set({
      participantIds: has ? form.participantIds.filter((x) => x !== id) : [...form.participantIds, id],
      exceptions: has ? form.exceptions.filter((e) => e.memberId !== id) : form.exceptions,
    });
  }

  function addException() {
    const memberId = form.participantIds.find((id) => id !== form.payerId) ?? form.participantIds[0];
    set({ exceptions: [...form.exceptions, { rowId: ++rowCounter, memberId, description: "", amountText: "", unknown: false }] });
  }
  const updateException = (rowId, patch) =>
    set({ exceptions: form.exceptions.map((e) => (e.rowId === rowId ? { ...e, ...patch } : e)) });
  const removeException = (rowId) => set({ exceptions: form.exceptions.filter((e) => e.rowId !== rowId) });

  // Input checks only. Who owes what is decided by the server.
  const { payload, errors, hasUnknown } = useMemo(() => {
    const errs = [];
    const totalCents = parseDollarsToCents(form.totalText);
    if (!form.store.trim()) errs.push("Add the store name.");
    if (totalCents == null || totalCents <= 0) errs.push("Enter the receipt total, like 51.03.");
    if (!form.participantIds.length) errs.push("Choose at least one person this receipt is for.");

    const exceptions = form.mode === "split"
      ? form.exceptions.map((e) => {
          const cents = e.unknown ? null : parseDollarsToCents(e.amountText);
          if (!e.unknown && cents == null) errs.push(`Enter an amount for ${nameOf(e.memberId)}'s item, or check "I don't know".`);
          return { member_id: e.memberId, description: e.description.trim(), amount_cents: cents };
        })
      : [];
    const known = exceptions.reduce((a, e) => a + (e.amount_cents || 0), 0);
    if (totalCents != null && known > totalCents) errs.push("Personal items add up to more than the receipt total.");

    return {
      errors: errs,
      hasUnknown: form.mode === "split" && form.exceptions.some((e) => e.unknown),
      payload: {
        store: form.store.trim(),
        run_id: form.runId || null,
        total_cents: totalCents,
        payer_id: form.payerId,
        mode: form.mode,
        participant_ids: members.map((m) => m.id).filter((id) => form.participantIds.includes(id)),
        exceptions,
      },
    };
  }, [form, members]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    if (errors.length) { setShowErrors(true); return; }
    const result = await write.submit((p, key) => api.createExpense(householdId, p, key), payload);
    if (!result) return;
    const expense = result.data.expense;
    const message = result.replayed
      ? `This ${expense.store} receipt was already saved, so it wasn't added twice.`
      : expense.status === "needs_review"
        ? `Saved the ${expense.store} receipt as Needs review. Nobody owes anything for it yet.`
        : `Saved the ${expense.store} receipt.`;
    closeAndReset();
    onSaved(message);
  }

  function closeAndReset() {
    setForm(emptyForm(currentMemberId, members));
    setShowErrors(false);
    write.reset();
    setOpen(false);
  }

  function discardAfterFailure() {
    closeAndReset();
    onSaved("Discarded. Check the receipts list to see whether it saved before adding it again.");
  }

  if (!open) {
    return (
      <button type="button" className="sp-btn" onClick={() => setOpen(true)}>
        Record a receipt
      </button>
    );
  }

  const locked = write.locked;

  return (
    <form className="sp-card sp-form" onSubmit={handleSubmit} noValidate>
      <h2 className="sp-h2">Record a receipt</h2>
      <fieldset disabled={locked} className="sp-fieldset">
        <label className="sp-field">
          <span>Store run</span>
          <select value={form.runId} onChange={(e) => chooseRun(e.target.value)}>
            <option value="">Not part of a store run</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {nameOf(r.started_by)}'s {r.store} run, {formatWhen(r.started_at)}
              </option>
            ))}
          </select>
        </label>

        <div className="sp-row">
          <label className="sp-field">
            <span>Store</span>
            <input value={form.store} onChange={(e) => set({ store: e.target.value })} placeholder="QFC" />
          </label>
          <label className="sp-field sp-narrow">
            <span>Receipt total</span>
            <input inputMode="decimal" value={form.totalText} onChange={(e) => set({ totalText: e.target.value })} placeholder="0.00" />
          </label>
        </div>

        <label className="sp-field">
          <span>Paid by</span>
          <select value={form.payerId} onChange={(e) => set({ payerId: e.target.value })}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.id === currentMemberId ? `${m.name} (you)` : m.name}</option>
            ))}
          </select>
        </label>

        <div className="sp-field">
          <span id="mode-label">How should this count?</span>
          <div className="sp-seg" role="radiogroup" aria-labelledby="mode-label">
            <label><input type="radio" name="mode" checked={form.mode === "split"} onChange={() => set({ mode: "split" })} /><span>Split between people</span></label>
            <label><input type="radio" name="mode" checked={form.mode === "pooled"} onChange={() => set({ mode: "pooled" })} /><span>Pooled household</span></label>
          </div>
          <p className="sp-help">
            {form.mode === "split"
              ? "Everyone below splits it. The server works out each person's share."
              : "Counts as household spending. Nobody will owe anyone for it."}
          </p>
        </div>

        <div className="sp-field">
          <span id="who-label">Who is this receipt for?</span>
          <div className="sp-checks" role="group" aria-labelledby="who-label">
            {members.map((m) => (
              <label key={m.id} className="sp-check">
                <input type="checkbox" checked={form.participantIds.includes(m.id)} onChange={() => toggleParticipant(m.id)} />
                <span>{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        {form.mode === "split" && (
          <div className="sp-field">
            <span>Personal items</span>
            {form.exceptions.length === 0 && (
              <p className="sp-help">Only needed when something on the receipt is for one person, like Sam's oat milk.</p>
            )}
            {form.exceptions.map((ex) => (
              <div key={ex.rowId} className="sp-exception">
                <select aria-label="Whose item" value={ex.memberId} onChange={(e) => updateException(ex.rowId, { memberId: e.target.value })}>
                  {form.participantIds.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
                <input aria-label="What it was" placeholder="What it was" value={ex.description} onChange={(e) => updateException(ex.rowId, { description: e.target.value })} />
                <input aria-label="Amount" inputMode="decimal" placeholder="0.00" className="sp-amount" disabled={ex.unknown} value={ex.unknown ? "" : ex.amountText} onChange={(e) => updateException(ex.rowId, { amountText: e.target.value })} />
                <label className="sp-check sp-small">
                  <input type="checkbox" checked={ex.unknown} onChange={(e) => updateException(ex.rowId, { unknown: e.target.checked })} />
                  <span>I don't know</span>
                </label>
                <button type="button" className="sp-icon-btn" aria-label={`Remove ${nameOf(ex.memberId)}'s item`} onClick={() => removeException(ex.rowId)}>×</button>
              </div>
            ))}
            {form.participantIds.length > 0 && (
              <button type="button" className="sp-link" onClick={addException}>+ Add a personal item</button>
            )}
            {hasUnknown && (
              <p className="sp-notice">This receipt will save as <strong>Needs review</strong>. Nobody owes anything for it until the missing amount is filled in.</p>
            )}
          </div>
        )}
      </fieldset>

      {showErrors && errors.length > 0 && (
        <ul className="sp-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      {write.state.phase === "error" && (
        <div className="sp-errors" role="alert">
          <p>{write.state.error}</p>
          {write.state.retryable && <p className="sp-help">The form is locked so this receipt can't be recorded twice.</p>}
        </div>
      )}

      <div className="sp-actions">
        {write.state.phase === "error" && write.state.retryable ? (
          <>
            <button type="submit" className="sp-btn">Try again</button>
            <button type="button" className="sp-btn sp-secondary" onClick={discardAfterFailure}>Discard</button>
          </>
        ) : (
          <>
            <button type="submit" className="sp-btn" disabled={write.state.phase === "saving"}>
              {write.state.phase === "saving" ? "Saving…" : "Save receipt"}
            </button>
            <button type="button" className="sp-btn sp-secondary" onClick={closeAndReset} disabled={write.state.phase === "saving"}>Cancel</button>
          </>
        )}
      </div>
    </form>
  );
}
