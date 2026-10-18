import { formatCents, whenOf } from '../../shopping/lib/format.js';

// One purchase exactly as the server returned it. Allocations are displayed, never recalculated.
export default function ExpenseCard({ expense, name, run, sample }) {
  const needsReview = expense.status === 'needs_review';
  const pooled = expense.mode === 'pooled';
  const currency = expense.currency || 'USD';
  const allocations = Object.entries(expense.allocations || {});
  const personal = Object.entries(expense.personalAllocations || {});
  return (
    <article className={`rm-card rm-expense ${needsReview ? 'rm-review' : ''}`} aria-label={`Receipt for ${formatCents(expense.totalCents, currency)}`}>
      <header className="rm-expense-head">
        <div>
          <h3 className="rm-h3">{run ? `${name(run.claimedBy)}'s run to ${run.storeName}` : expense.storeName || (sample ? 'Sample receipt' : 'Receipt')}</h3>
          <p className="rm-help">{name(expense.payerId)} paid{expense.createdAt ? `, ${whenOf(expense.createdAt)}` : ''}</p>
        </div>
        <div className="rm-expense-side">
          <span className="rm-price">{formatCents(expense.totalCents, currency)}</span>
          <span className={`rm-pill ${needsReview ? 'rm-pill-review' : pooled ? 'rm-pill-pooled' : ''}`}>{needsReview ? 'Needs review' : pooled ? 'Pooled' : 'Split'}</span>
        </div>
      </header>
      {pooled && <p className="rm-help">Pooled group spending. Nobody owes anyone for this receipt.</p>}
      {needsReview && <p className="rm-notice"><strong>Needs review.</strong> A personal amount is missing, so this receipt doesn't affect balances.</p>}
      {!pooled && expense.sharedMemberIds?.length > 0 && <p className="rm-help">Shared by {expense.sharedMemberIds.map(name).join(', ')}{personal.length ? `; personal: ${personal.map(([id, cents]) => `${name(id)} ${Number.isInteger(cents) ? formatCents(cents, currency) : 'unknown'}`).join(', ')}` : ''}.</p>}
      {!pooled && !needsReview && allocations.length > 0 && (
        <table className="rm-alloc">
          <caption className="sr-only">Each person's share</caption>
          <tbody>
            {allocations.map(([id, cents]) => (
              <tr key={id}><th scope="row">{name(id)}</th><td>{id === expense.payerId ? 'paid the store' : `owes ${name(expense.payerId)}`}</td><td className="rm-num">{formatCents(cents, currency)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
