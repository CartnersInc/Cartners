import { useState } from "react";
import { api } from "../lib/api.js";
import { copyText, formatCents, PAY_APP_NAMES, safeProfileLink } from "../lib/format.js";
import { useIdempotentWrite } from "../lib/useIdempotentWrite.js";

// Balances come straight from the server. This panel only displays them and lets
// someone record a payment they made, after they confirm it.
export default function BalancesPanel({ householdId, balances, members, currentMemberId, onPaymentRecorded }) {
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? "Someone";
  const mine = balances.filter((b) => b.from_member_id === currentMemberId || b.to_member_id === currentMemberId);
  const others = balances.filter((b) => !mine.includes(b));

  return (
    <section className="sp-card" aria-labelledby="balances-title">
      <h2 className="sp-h2" id="balances-title">Balances</h2>
      {balances.length === 0 && <p className="sp-meta">Everyone is square.</p>}
      {mine.map((b) =>
        b.from_member_id === currentMemberId ? (
          <SettleRow
            key={`${b.from_member_id}-${b.to_member_id}`}
            householdId={householdId}
            balance={b}
            recipient={members.find((m) => m.id === b.to_member_id)}
            currentMemberId={currentMemberId}
            onPaymentRecorded={onPaymentRecorded}
          />
        ) : (
          <div className="sp-balance" key={`${b.from_member_id}-${b.to_member_id}`}>
            <span><strong>{nameOf(b.from_member_id)}</strong> owes you</span>
            <span className="sp-price">{formatCents(b.amount_cents)}</span>
          </div>
        )
      )}
      {others.length > 0 && (
        <div className="sp-others">
          {others.map((b) => (
            <div className="sp-balance sp-muted" key={`${b.from_member_id}-${b.to_member_id}`}>
              <span>{nameOf(b.from_member_id)} owes {nameOf(b.to_member_id)}</span>
              <span>{formatCents(b.amount_cents)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SettleRow({ householdId, balance, recipient, currentMemberId, onPaymentRecorded }) {
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState("venmo");
  const [copied, setCopied] = useState("");
  const write = useIdempotentWrite();
  const amount = (balance.amount_cents / 100).toFixed(2);

  const links = Object.entries(recipient?.pay_links || {})
    .map(([kind, url]) => ({ kind, url: safeProfileLink(kind, url) }))
    .filter((l) => l.url);

  async function copy(label, text) {
    const ok = await copyText(text);
    setCopied(ok ? `${label} copied` : `Couldn't copy. Select it and copy it by hand.`);
    setTimeout(() => setCopied(""), 2500);
  }

  async function record() {
    const payload = {
      from_member_id: currentMemberId,
      to_member_id: recipient.id,
      amount_cents: balance.amount_cents,
      method,
    };
    const result = await write.submit((p, key) => api.recordPayment(householdId, p, key), payload);
    if (!result) return;
    setConfirming(false);
    onPaymentRecorded(
      result.replayed
        ? `That payment to ${recipient.name} was already recorded, so it wasn't added twice.`
        : `Recorded your ${formatCents(balance.amount_cents)} payment to ${recipient.name}.`
    );
  }

  return (
    <div className="sp-settle">
      <div className="sp-balance">
        <span>You owe <strong>{recipient?.name}</strong></span>
        <span className="sp-price">{formatCents(balance.amount_cents)}</span>
      </div>

      {links.length > 0 ? (
        <div className="sp-paylinks">
          {links.map((l) => (
            <div className="sp-paylink" key={l.kind}>
              <div>
                <strong>{PAY_APP_NAMES[l.kind]}</strong>
                <div className="sp-mono">{l.url}</div>
              </div>
              <div className="sp-paylink-actions">
                <a className="sp-btn sp-small" href={l.url} target="_blank" rel="noopener noreferrer">
                  Open {recipient.name}'s {PAY_APP_NAMES[l.kind]}
                </a>
                <button type="button" className="sp-btn sp-secondary sp-small" onClick={() => copy("Link", l.url)}>Copy link</button>
              </div>
            </div>
          ))}
          <div className="sp-copy-amount">
            <span>Send <strong>${amount}</strong> to {recipient.name}</span>
            <button type="button" className="sp-btn sp-secondary sp-small" onClick={() => copy("Amount", amount)}>Copy amount</button>
          </div>
          <p className="sp-help">Opening a link doesn't mark anything as paid. Record the payment below once you've sent it.</p>
        </div>
      ) : (
        <p className="sp-help">
          {recipient?.name} hasn't added a Venmo or PayPal link. Ask them for one, or pay another way and record it below.
        </p>
      )}
      <p className="sp-live" aria-live="polite">{copied}</p>

      {!confirming ? (
        <button type="button" className="sp-link" onClick={() => setConfirming(true)}>
          I've paid {recipient?.name}
        </button>
      ) : (
        <div className="sp-confirm">
          <label className="sp-field">
            <span>How did you pay?</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={write.locked}>
              <option value="venmo">Venmo</option>
              <option value="paypal">PayPal</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </label>
          <p>Record that you paid {recipient?.name} <strong>{formatCents(balance.amount_cents)}</strong>?</p>
          {write.state.phase === "error" && <p className="sp-errors" role="alert">{write.state.error}</p>}
          <div className="sp-actions">
            <button type="button" className="sp-btn" onClick={record} disabled={write.state.phase === "saving"}>
              {write.state.phase === "saving" ? "Recording…" : write.state.phase === "error" && write.state.retryable ? "Try again" : "Record payment"}
            </button>
            <button type="button" className="sp-btn sp-secondary" disabled={write.state.phase === "saving"} onClick={() => { setConfirming(false); write.reset(); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
