import { useState } from 'react';
import ReceiptForm, { runsOf } from './parts/ReceiptForm.jsx';
import ExpenseCard from './parts/ExpenseCard.jsx';
import Balances from './parts/Balances.jsx';
import { formatCents, people, spendingModeOf } from '../shopping/lib/format.js';
import { isFamilyTable } from '../../household.js';
import PersonName from './proposal/PayHandleMarks.jsx';
import { lastConfirmedSplit, unrecordedRuns } from './lib/remember.js';
import { clearPurchasePrompt, pendingPurchasePrompt, queuePurchasePrompt } from '../groups/parts/TripPanel.jsx';
import '../shopping/roomie.css';

export default function Spending(props) { return <Receipts {...props} />; }

function Receipts({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected, membership }) {
  const [promptRunId, setPromptRunId] = useState(pendingPurchasePrompt);
  const [formNonce, setFormNonce] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const { name } = people(workspace, actorId);
  const mode = spendingModeOf(workspace);
  const expenses = workspace.expenses || [];
  const balances = workspace.balances || [];
  const runs = runsOf(workspace);
  const waiting = unrecordedRuns(runs, expenses);
  const lastSplit = lastConfirmedSplit(expenses);
  const paidBy = {};
  for (const expense of expenses) if (expense.status !== 'needs_review') paidBy[expense.payerId] = (paidBy[expense.payerId] || 0) + expense.totalCents;
  const reviewCount = expenses.filter(expense => expense.status === 'needs_review').length;
  const editing = expenses.find(expense => expense.id === editingId && expense.status === 'needs_review') || null;
  const closeForm = () => {
    clearPurchasePrompt();
    setPromptRunId(null);
    setEditingId(null);
    setFormNonce(value => value + 1);
  };

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Spending</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Offline</span>}
      </div>
      <p className="rm-intro">
        {isFamilyTable(workspace, membership)
          ? <>This is a <strong>family grocery budget</strong>. Describe the store total — we remember who paid. Nobody owes anyone.{mode === 'split' ? ' This group was switched to split — debts appear below.' : ''}</>
          : <>{mode === 'pooled'
            ? <>This household <strong>tracks who paid</strong>. Describe the receipt; nothing is saved until you confirm.</>
            : <>Type the store total. Cartners <strong>fills who paid and the split</strong>. Opening a pay link never marks a debt paid.{lastSplit ? ` Last split: ${(lastSplit.sharedMemberIds || []).map(name).join(', ')}.` : ''}</>}</>}{' '}
        <button type="button" className="rm-link" onClick={() => navigate('groups')}>Household settings</button>
      </p>

      <div className="rm-columns">
        <div className="rm-main">
          {!editing && waiting.length > 0 && (
            <section className="rm-card" aria-labelledby="rm-open-runs">
              <h2 id="rm-open-runs" className="rm-h2">Runs waiting for a receipt</h2>
                    <p className="rm-help">{mode === 'split' ? 'Describe the store total. We reuse the last split and do the cents.' : 'Describe the store total. This records who paid, not a debt.'}</p>
              <ul className="rm-plain">
                {waiting.map(run => (
                  <li key={run.id} className="rm-balance">
                    <span><PersonName workspace={workspace} actorId={run.claimedBy}>{name(run.claimedBy)}</PersonName>’s run{run.storeName ? ` to ${run.storeName}` : ''}</span>
                    <button type="button" className="rm-btn rm-small" disabled={!connected} onClick={() => { queuePurchasePrompt(run.id); setPromptRunId(run.id); setFormNonce(value => value + 1); }}>{mode === 'split' ? 'Split this run' : 'Record this run'}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ReceiptForm
            key={editing ? editing.id : `${workspace.workspaceId}-${actorId}-${promptRunId || 'new'}-${formNonce}`}
            workspace={workspace}
            actorId={actorId}
            api={api}
            onWorkspaceChange={onWorkspaceChange}
            connected={connected}
            notify={notify}
            mode={mode}
            initialRunId={promptRunId}
            expense={editing}
            onDone={closeForm}
          />

          <h2 className="rm-h2 rm-section">Receipts</h2>
          {expenses.length === 0 && <p className="rm-empty">No receipts yet. Describe one after a store run; it's optional.</p>}
          {[...expenses].reverse().map(expense => <ExpenseCard key={expense.id} expense={expense} name={name} workspace={workspace} run={runs.find(run => run.id === expense.runId)} onResolve={expense.status === 'needs_review' && connected ? () => { setEditingId(expense.id); } : null} />)}
        </div>

        <div className="rm-side">
          <section className="rm-card" aria-labelledby="rm-paid">
            <h2 id="rm-paid" className="rm-h2">Who paid</h2>
            {Object.keys(paidBy).length
              ? <ul className="rm-plain">{Object.entries(paidBy).map(([id, cents]) => <li key={id} className="rm-balance"><span><PersonName workspace={workspace} actorId={id}>{name(id)}</PersonName></span><span className="rm-price">{formatCents(cents)}</span></li>)}</ul>
              : <p className="rm-help">No confirmed receipts yet.</p>}
            {reviewCount > 0 && <p className="rm-help">{reviewCount} receipt{reviewCount === 1 ? '' : 's'} need review and aren't counted.</p>}
          </section>
          {mode === 'split' || balances.length ? <Balances balances={balances} workspace={workspace} actorId={actorId} name={name} /> : null}
        </div>
      </div>
    </div>
  );
}
