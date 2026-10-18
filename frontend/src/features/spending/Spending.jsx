import { useState } from 'react';
import ReceiptForm, { runsOf } from './parts/ReceiptForm.jsx';
import ExpenseCard from './parts/ExpenseCard.jsx';
import Balances from './parts/Balances.jsx';
import { formatCents, people, spendingModeOf } from '../shopping/lib/format.js';
import { isFamilyTable } from '../../household.js';
import { lastConfirmedSplit, unrecordedRuns } from './lib/remember.js';
import { clearPurchasePrompt, pendingPurchasePrompt, queuePurchasePrompt } from '../groups/parts/TripPanel.jsx';
import '../shopping/roomie.css';

export default function Spending(props) { return <Receipts {...props} />; }

function Receipts({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected, membership }) {
  const [promptRunId, setPromptRunId] = useState(pendingPurchasePrompt);
  const [recording, setRecording] = useState(promptRunId != null);
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
  const closeForm = () => { clearPurchasePrompt(); setRecording(false); setEditingId(null); };

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Spending</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Offline</span>}
      </div>
      <p className="rm-intro">
        {isFamilyTable(workspace, membership)
          ? <>This is a <strong>family grocery budget</strong>. Enter the store total after a run — we remember who paid. Nobody owes anyone.{mode === 'split' ? ' This group was switched to split — debts appear below.' : ''}</>
          : <>{mode === 'pooled'
            ? <>This household <strong>tracks who paid</strong>. Nobody owes anyone until you switch to split in Household settings.</>
            : <>Enter the receipt total. Cartners <strong>remembers who split last time</strong> and even-splits the rest — no spreadsheet. Settle with Venmo, Zelle, Cash App, or PayPal; opening a link never marks a debt paid.{lastSplit ? ` Last split: ${(lastSplit.sharedMemberIds || []).map(name).join(', ')}.` : ''}</>}</>}{' '}
        <button type="button" className="rm-link" onClick={() => navigate('groups')}>Household settings</button>
      </p>

      <div className="rm-columns">
        <div className="rm-main">
          {recording || editing
            ? <ReceiptForm key={editing ? editing.id : `${workspace.workspaceId}-${actorId}-${promptRunId || 'new'}`} workspace={workspace} actorId={actorId} api={api} onWorkspaceChange={onWorkspaceChange} connected={connected} notify={notify} mode={mode} initialRunId={promptRunId} expense={editing} onDone={closeForm} />
            : (
              <>
                {waiting.length > 0 && (
                  <section className="rm-card" aria-labelledby="rm-open-runs">
                    <h2 id="rm-open-runs" className="rm-h2">Runs waiting for a receipt</h2>
                    <p className="rm-help">{mode === 'split' ? 'Type the store total. We reuse the last split and do the cents.' : 'Type the store total. This records who paid, not a debt.'}</p>
                    <ul className="rm-plain">
                      {waiting.map(run => (
                        <li key={run.id} className="rm-balance">
                          <span>{name(run.claimedBy)}’s run{run.storeName ? ` to ${run.storeName}` : ''}</span>
                          <button type="button" className="rm-btn rm-small" disabled={!connected} onClick={() => { queuePurchasePrompt(run.id); setPromptRunId(run.id); setRecording(true); }}>{mode === 'split' ? 'Split this run' : 'Record this run'}</button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <div className="rm-actions"><button type="button" className="rm-btn" disabled={!connected} onClick={() => setRecording(true)}>{waiting.length ? 'Record a different purchase' : 'Record a purchase'}</button>{!connected && <span className="rm-help">Needs the backend.</span>}</div>
              </>
            )}

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
