import { formatCents, whenOf } from '../../shopping/lib/format.js';
import PersonName from '../proposal/PayHandleMarks.jsx';

// One purchase exactly as the server returned it. Allocations are displayed, never recalculated.
export default function ExpenseCard({ expense, name, run, sample, onResolve, workspace }) {
  const needsReview = expense.status === 'needs_review';
  const pooled = expense.mode === 'pooled';
  const currency = expense.currency || 'USD';
  const allocations = Object.entries(expense.allocations || {});
  const personal = Object.entries(expense.personalAllocations || {});
  return (
    <article className={`rm-card rm-expense ${needsReview ? 'rm-review' : ''}`} aria-label={`Receipt for ${formatCents(expense.totalCents, currency)}`}>
      <header className="rm-expense-head">
        <div>
          <h3 className="rm-h3">{run ? <><PersonName workspace={workspace} actorId={run.claimedBy}>{name(run.claimedBy)}</PersonName>'s run to {run.storeName}</> : expense.storeName || (sample ? 'Sample receipt' : 'Receipt')}</h3>
          <p className="rm-help"><PersonName workspace={workspace} actorId={expense.payerId}>{name(expense.payerId)}</PersonName> paid{expense.createdAt ? `, ${whenOf(expense.createdAt)}` : ''}</p>
        </div>
        <div className="rm-expense-side">
          <span className="rm-price">{formatCents(expense.totalCents, currency)}</span>
          <span className={`rm-pill ${needsReview ? 'rm-pill-review' : pooled ? 'rm-pill-pooled' : ''}`}>{needsReview ? 'Needs review' : pooled ? 'Pooled' : 'Split'}</span>
        </div>
      </header>
      {pooled && <p className="rm-help">Pooled group spending. Nobody owes anyone for this receipt.</p>}
      {needsReview && (
        <p className="rm-notice">
          <span><strong>Needs review.</strong> A personal amount is missing, so this receipt doesn't affect balances.</span>
          {onResolve && <button type="button" className="rm-btn rm-small" onClick={onResolve}>Fill in the missing amount</button>}
        </p>
      )}
      {!pooled && expense.sharedMemberIds?.length > 0 && <p className="rm-help">Shared by {expense.sharedMemberIds.map((id, index) => <span key={id}>{index ? ', ' : ''}<PersonName workspace={workspace} actorId={id}>{name(id)}</PersonName></span>)}{personal.length ? '; personal: ' : ''}{personal.map(([id, cents], index) => <span key={id}>{index ? ', ' : ''}<PersonName workspace={workspace} actorId={id}>{name(id)}</PersonName> {Number.isInteger(cents) ? formatCents(cents, currency) : 'unknown'}</span>)}{expense.sharedMemberIds?.length || personal.length ? '.' : ''}</p>}
      {!pooled && !needsReview && allocations.length > 0 && (
        <table className="rm-alloc">
          <caption className="sr-only">Each person's share</caption>
          <tbody>
            {allocations.map(([id, cents]) => (
              <tr key={id}><th scope="row"><PersonName workspace={workspace} actorId={id}>{name(id)}</PersonName></th><td>{id === expense.payerId ? 'paid the store' : <>owes <PersonName workspace={workspace} actorId={expense.payerId}>{name(expense.payerId)}</PersonName></>}</td><td className="rm-num">{formatCents(cents, currency)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
