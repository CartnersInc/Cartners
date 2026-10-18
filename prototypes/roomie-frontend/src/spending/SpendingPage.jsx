import { useCallback, useEffect, useRef, useState } from "react";
import { api, dataSource } from "../lib/api.js";
import BalancesPanel from "./BalancesPanel.jsx";
import ExpenseCard from "./ExpenseCard.jsx";
import RecordReceiptForm from "./RecordReceiptForm.jsx";
import { formatCents, formatWhen } from "../lib/format.js";
import "./spending.css";

// The Spending page. Everything shown comes from the server (or the sample fixture
// before the server is connected). After every write, the page reloads from the
// server instead of patching numbers locally.
// Render it with key={groupId} so switching groups starts from an empty page.
export default function SpendingPage({ groupId, currentMemberId }) {
  const householdId = groupId;
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const fresh = await api.getSpending(householdId);
      if (ticket !== latest.current) return; // a newer load or a group switch won
      setData(fresh);
      setLoadError(null);
    } catch (err) {
      if (ticket !== latest.current) return;
      setLoadError(err?.message || "Couldn't load spending.");
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    setData(null); // never show another group's receipts or balances
    load();
    return () => { latest.current++; };
  }, [load]);

  const afterWrite = (message) => { setNotice(message); load(); };

  if (!data) {
    return (
      <div className="sp-page">
        <h1 className="sp-h1">Spending</h1>
        {loadError ? (
          <div className="sp-errors" role="alert">
            <p>{loadError}</p>
            <button type="button" className="sp-btn" onClick={load}>Try again</button>
          </div>
        ) : (
          <p className="sp-meta">Loading spending…</p>
        )}
      </div>
    );
  }

  const { members, runs, expenses, payments, balances, summary } = data;
  const nameOf = (id) => (id === currentMemberId ? "You" : members.find((m) => m.id === id)?.name ?? "Someone");

  return (
    <div className="sp-page">
      <div className="sp-title-row">
        <h1 className="sp-h1">Spending</h1>
        <span className={`sp-source ${dataSource === "api" ? "sp-source-live" : ""}`}>
          {dataSource === "api" ? "Live server" : "Sample data"}
        </span>
      </div>

      {loadError && (
        <div className="sp-errors" role="alert">
          <p>{loadError} Showing the last data that loaded.</p>
          <button type="button" className="sp-btn sp-small" onClick={load}>Reload</button>
        </div>
      )}
      <p className="sp-live sp-notice-ok" aria-live="polite">{notice}</p>

      {summary && (
        <div className="sp-summary">
          <div><span className="sp-meta">Split receipts</span><strong>{formatCents(summary.split_total_cents)}</strong></div>
          <div><span className="sp-meta">Pooled household</span><strong>{formatCents(summary.pooled_total_cents)}</strong></div>
          <div><span className="sp-meta">Needs review</span><strong>{summary.needs_review_count}</strong></div>
        </div>
      )}

      <BalancesPanel
        householdId={householdId}
        balances={balances}
        members={members}
        currentMemberId={currentMemberId}
        onPaymentRecorded={afterWrite}
      />

      <RecordReceiptForm
        key={currentMemberId}
        householdId={householdId}
        members={members}
        runs={runs}
        currentMemberId={currentMemberId}
        onSaved={afterWrite}
      />

      <h2 className="sp-h2 sp-section">Receipts {loading && <span className="sp-meta">Refreshing…</span>}</h2>
      {expenses.length === 0 && <p className="sp-meta">No receipts yet. Record one after a store run.</p>}
      {expenses.map((e) => (
        <ExpenseCard key={e.id} expense={e} members={members} runs={runs} currentMemberId={currentMemberId} />
      ))}

      <h2 className="sp-h2 sp-section">Payments recorded</h2>
      {payments.length === 0 ? (
        <p className="sp-meta">No payments recorded yet.</p>
      ) : (
        <ul className="sp-card sp-payments">
          {payments.map((p) => (
            <li key={p.id}>
              <span>{nameOf(p.from_member_id)} paid {nameOf(p.to_member_id) === "You" ? "you" : nameOf(p.to_member_id)} with {p.method === "paypal" ? "PayPal" : p.method[0].toUpperCase() + p.method.slice(1)}</span>
              <span className="sp-meta">{formatWhen(p.recorded_at)}</span>
              <strong>{formatCents(p.amount_cents)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
