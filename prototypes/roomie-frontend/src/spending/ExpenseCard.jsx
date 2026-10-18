import { formatCents, formatWhen } from "../lib/format.js";

// Shows one purchase exactly as the server returned it.
// Allocations are displayed, never recalculated here.
export default function ExpenseCard({ expense, members, runs, currentMemberId }) {
  const nameOf = (id) => {
    const m = members.find((x) => x.id === id);
    if (!m) return "Someone";
    return id === currentMemberId ? "You" : m.name;
  };
  const possessive = (id) => (id === currentMemberId ? "Your" : `${nameOf(id)}'s`);
  const run = expense.run_id ? runs.find((r) => r.id === expense.run_id) : null;
  const needsReview = expense.status === "needs_review";
  const pooled = expense.mode === "pooled";

  return (
    <article className={`sp-card sp-expense ${needsReview ? "sp-review" : ""}`}>
      <header className="sp-expense-head">
        <div>
          <h3 className="sp-h3">{expense.store}</h3>
          <p className="sp-meta">
            {nameOf(expense.payer_id)} paid, {formatWhen(expense.created_at)}
          </p>
          <p className="sp-meta">
            {run ? `From ${possessive(run.started_by)} ${run.store} run, started ${formatWhen(run.started_at)}` : "Not part of a store run"}
          </p>
        </div>
        <div className="sp-expense-side">
          <span className="sp-price">{formatCents(expense.total_cents)}</span>
          <span className={`sp-pill ${pooled ? "sp-pill-pooled" : ""} ${needsReview ? "sp-pill-review" : ""}`}>
            {needsReview ? "Needs review" : pooled ? "Pooled" : "Split"}
          </span>
        </div>
      </header>

      <p className="sp-meta">
        For {expense.participant_ids.map((id) => nameOf(id)).join(", ")}
      </p>

      {pooled && (
        <p className="sp-explain">Pooled household spending. Nobody owes anyone for this receipt.</p>
      )}

      {needsReview && (
        <div className="sp-notice">
          <strong>Needs review.</strong> {expense.review_reason || "Some amounts are missing."} Nobody owes anything for this receipt until it's fixed.
        </div>
      )}

      {expense.exceptions?.length > 0 && (
        <ul className="sp-exceptions">
          {expense.exceptions.map((ex, i) => (
            <li key={i}>
              {nameOf(ex.member_id)}: {ex.description || "personal item"}, {ex.amount_cents == null ? "amount unknown" : formatCents(ex.amount_cents)}
            </li>
          ))}
        </ul>
      )}

      {!pooled && !needsReview && expense.allocations && (
        <table className="sp-alloc">
          <caption className="sp-visually-hidden">Each person's share of {expense.store}</caption>
          <tbody>
            {expense.allocations.map((a) => (
              <tr key={a.member_id}>
                <th scope="row">{nameOf(a.member_id)}</th>
                <td>{a.member_id === expense.payer_id ? "paid the store" : `owes ${nameOf(expense.payer_id)}`}</td>
                <td className="sp-num">{formatCents(a.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
