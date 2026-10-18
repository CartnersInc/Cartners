import { useState } from 'react';
import ReceiptForm, { runsOf } from './parts/ReceiptForm.jsx';
import ExpenseCard from './parts/ExpenseCard.jsx';
import Balances from './parts/Balances.jsx';
import { formatCents, people, spendingModeOf } from '../shopping/lib/format.js';
import { isFamilyTable } from '../../household.js';
import { clearPurchasePrompt, pendingPurchasePrompt } from '../groups/parts/TripPanel.jsx';
import '../shopping/roomie.css';

export default function Spending(props) { return <Receipts {...props} />; }

function Receipts({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected, membership }) {
  const [promptRunId] = useState(pendingPurchasePrompt);
  const [recording, setRecording] = useState(promptRunId != null);
  const [editingId, setEditingId] = useState(null);
  const { name } = people(workspace, actorId);
  const mode = spendingModeOf(workspace);
  const expenses = workspace.expenses || [];
  const balances = workspace.balances || [];
  const runs = runsOf(workspace);
  const paidBy = {};
  for (const expense of expenses) if (expense.status !== 'needs_review') paidBy[expense.payerId] = (paidBy[expense.payerId] || 0) + expense.totalCents;
  const reviewCount = expenses.filter(expense => expense.status === 'needs_review').length;
  const editing = expenses.find(expense => expense.id === editingId && expense.status === 'needs_review') || null;
  const closeForm = () => { clearPurchasePrompt(); setRecording(false); setEditingId(null); };

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Spending</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Offline</span>}
      </div>
      <p className="rm-intro">
        {isFamilyTable(workspace, membership)
          ? <>This is a <strong>family grocery budget</strong>. Receipts show who paid for the household. Nobody owes anyone.{mode === 'split' ? ' This group was switched to split — debts appear below.' : ''}</>
          : <>This household <strong>{mode === 'pooled' ? 'tracks who paid' : 'splits the receipt'}</strong>. {mode === 'pooled' ? 'Nobody owes anyone until you switch to split in Household settings.' : 'Confirmed receipts decide who owes whom. Settle with Venmo, Zelle, Cash App, or PayPal — opening a link never marks a debt paid.'}</>}{' '}
        <button type="button" className="rm-link" onClick={() => navigate('groups')}>Household settings</button>
      </p>

      <div className="rm-columns">
        <div className="rm-main">
          {recording || editing
            ? <ReceiptForm key={editing ? editing.id : `${workspace.workspaceId}-${actorId}-${promptRunId || 'new'}`} workspace={workspace} actorId={actorId} api={api} onWorkspaceChange={onWorkspaceChange} connected={connected} notify={notify} mode={mode} initialRunId={promptRunId} expense={editing} onDone={closeForm} />
            : <div className="rm-actions"><button type="button" className="rm-btn" disabled={!connected} onClick={() => setRecording(true)}>Record a purchase</button>{!connected && <span className="rm-help">Needs the backend.</span>}</div>}

          <h2 className="rm-h2 rm-section">Receipts</h2>
          {expenses.length === 0 && <p className="rm-empty">No receipts yet. Record one after a store run; it's optional.</p>}
          {[...expenses].reverse().map(expense => <ExpenseCard key={expense.id} expense={expense} name={name} run={runs.find(run => run.id === expense.runId)} onResolve={expense.status === 'needs_review' && connected ? () => { setRecording(false); setEditingId(expense.id); } : null} />)}
        </div>

        <div className="rm-side">
          <section className="rm-card" aria-labelledby="rm-paid">
            <h2 id="rm-paid" className="rm-h2">Who paid</h2>
            {Object.keys(paidBy).length
              ? <ul className="rm-plain">{Object.entries(paidBy).map(([id, cents]) => <li key={id} className="rm-balance"><span>{name(id)}</span><span className="rm-price">{formatCents(cents)}</span></li>)}</ul>
              : <p className="rm-help">No confirmed receipts yet.</p>}
            {reviewCount > 0 && <p className="rm-help">{reviewCount} receipt{reviewCount === 1 ? '' : 's'} need review and aren't counted.</p>}
          </section>
          {mode === 'split' || balances.length ? <Balances balances={balances} workspace={workspace} actorId={actorId} name={name} /> : null}
        </div>
      </div>
    </div>
  );
}
