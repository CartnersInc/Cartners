import { useState } from 'react';
import sampleExpense from '../../../../docs/fixtures/expense.json';
import ReceiptForm, { runsOf } from './parts/ReceiptForm.jsx';
import ExpenseCard from './parts/ExpenseCard.jsx';
import Balances from './parts/Balances.jsx';
import Payments from './proposal/Payments.jsx';
import PayProfile from './proposal/PayProfile.jsx';
import { PAYMENTS_PROPOSAL } from './proposal/payLinks.js';
import { formatCents, people, spendingModeOf } from '../shopping/lib/format.js';
import { clearPurchasePrompt, pendingPurchasePrompt } from '../groups/parts/TripPanel.jsx';
import '../shopping/roomie.css';

// Spending (#8): record the actual purchase after a run, then show who paid and who owes whom.
// Allocations and balances come only from the server; this page never calculates them.
const TABS = [['receipts', 'Receipts'], ['payments', 'Payments'], ['profile', 'Your profile']];
const TAB_KEY = 'roomie:spendingTab';
const readTab = () => {
  if (pendingPurchasePrompt()) return 'receipts';
  try {
    const saved = sessionStorage.getItem(TAB_KEY);
    return TABS.some(([id]) => id === saved) ? saved : 'receipts';
  } catch {
    return 'receipts';
  }
};

// The shell has five fixed pages, so the proposed Payments and Your profile views are tabs inside
// Spending for now. If they get their own shell tab later, these components move unchanged.
export default function Spending(props) {
  const [tab, setTab] = useState(() => (PAYMENTS_PROPOSAL ? readTab() : 'receipts'));
  if (!PAYMENTS_PROPOSAL) return <Receipts {...props} />;
  function choose(next) {
    setTab(next);
    try { sessionStorage.setItem(TAB_KEY, next); } catch { /* Remembering the tab is only a convenience. */ }
  }
  function onKey(event) {
    const index = TABS.findIndex(([id]) => id === tab);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length][0];
    choose(next);
    document.getElementById(`rm-tab-${next}`)?.focus();
  }
  return (
    <div className="rm-page">
      <div className="rm-tabs" role="tablist" aria-label="Spending views" onKeyDown={onKey}>
        {TABS.map(([id, label]) => (
          <button key={id} id={`rm-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`rm-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => choose(id)}>
            {label}{id !== 'receipts' && <span className="rm-tab-tag">proposal</span>}
          </button>
        ))}
      </div>
      <div id={`rm-panel-${tab}`} role="tabpanel" aria-labelledby={`rm-tab-${tab}`}>
        {tab === 'payments' && <TabPage title="Payments"><Payments key={props.actorId} workspace={props.workspace} actorId={props.actorId} onEditProfile={() => choose('profile')} /></TabPage>}
        {tab === 'profile' && <TabPage title="Your profile"><PayProfile key={props.actorId} workspace={props.workspace} actorId={props.actorId} /></TabPage>}
        {tab === 'receipts' && <Receipts {...props} />}
      </div>
    </div>
  );
}

function TabPage({ title, children }) {
  return (
    <div className="rm-page">
      <div className="rm-title-row"><h1 className="rm-h1">{title}</h1></div>
      {children}
    </div>
  );
}

function Receipts({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected }) {
  const [promptRunId] = useState(pendingPurchasePrompt);
  const [recording, setRecording] = useState(promptRunId != null);
  const { name } = people(workspace, actorId);
  const mode = spendingModeOf(workspace);
  const expenses = workspace.expenses || [];
  const balances = workspace.balances || [];
  const runs = runsOf(workspace);
  const paidBy = {};
  for (const expense of expenses) if (expense.status !== 'needs_review') paidBy[expense.payerId] = (paidBy[expense.payerId] || 0) + expense.totalCents;
  const reviewCount = expenses.filter(expense => expense.status === 'needs_review').length;
  const showSample = !connected && expenses.length === 0;

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Spending</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Sample preview</span>}
      </div>
      <p className="rm-intro">
        This group's spending is <strong>{mode === 'pooled' ? 'pooled' : 'split'}</strong>. {mode === 'pooled' ? 'Receipts show who paid; nobody owes anyone.' : 'Confirmed receipts decide who owes whom.'}{' '}
        <button type="button" className="rm-link" onClick={() => navigate('groups')}>Change in Groups</button>
      </p>

      <div className="rm-columns">
        <div className="rm-main">
          {recording
            ? <ReceiptForm key={`${workspace.workspaceId}-${actorId}-${promptRunId || 'new'}`} workspace={workspace} actorId={actorId} api={api} onWorkspaceChange={onWorkspaceChange} connected={connected} notify={notify} mode={mode} initialRunId={promptRunId} onDone={() => { clearPurchasePrompt(); setRecording(false); }} />
            : <div className="rm-actions"><button type="button" className="rm-btn" disabled={!connected} onClick={() => setRecording(true)}>Record a purchase</button>{!connected && <span className="rm-help">Needs the backend.</span>}</div>}

          <h2 className="rm-h2 rm-section">Receipts</h2>
          {expenses.length === 0 && !showSample && <p className="rm-empty">No receipts yet. Record one after a store run; it's optional.</p>}
          {[...expenses].reverse().map(expense => <ExpenseCard key={expense.id} expense={expense} name={name} run={runs.find(run => run.id === expense.runId)} />)}

          {showSample && (
            <section className="rm-sample" aria-labelledby="rm-sample-title">
              <h3 id="rm-sample-title" className="rm-h3"><span className="rm-pill rm-pill-sample">Sample</span> How a split receipt reads</h3>
              <p className="rm-help">{sampleExpense.sampleNotice} Not saved, and not part of this group's balances.</p>
              <ExpenseCard expense={sampleExpense.expense} name={name} sample />
              <Balances balances={sampleExpense.balances} workspace={workspace} actorId={actorId} name={name} />
            </section>
          )}
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
