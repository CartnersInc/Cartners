import { useEffect, useId, useState } from 'react';
import { useWrite } from '../../shopping/lib/useWrite.js';
import { clock, people, timeOf, WINDOW_MINUTES } from '../../shopping/lib/format.js';
import { acceptingRequests, activeTrip, lastStore, liveItems } from '../../shopping/lib/trip.js';

// The one store-run action for the group. With no run it starts one; during a run it shows
// the shopper and countdown, and the shopper can Release or Finish. An active shopper is never replaced.
export const RECORD_PURCHASE_KEY = 'roomie:recordPurchase';
let pendingPurchaseRunId = null;
export function queuePurchasePrompt(runId) {
  pendingPurchaseRunId = runId;
  try { sessionStorage.setItem(RECORD_PURCHASE_KEY, runId); } catch { /* The in-memory prompt still opens the receipt form. */ }
}
export function pendingPurchasePrompt() {
  if (pendingPurchaseRunId) return pendingPurchaseRunId;
  try { return sessionStorage.getItem(RECORD_PURCHASE_KEY); } catch { return null; }
}
export function clearPurchasePrompt() {
  pendingPurchaseRunId = null;
  try { sessionStorage.removeItem(RECORD_PURCHASE_KEY); } catch { /* Leaving the key only reopens the form once. */ }
}

export default function TripPanel({ workspace, actorId, api, onWorkspaceChange, connected, serverNowMs, notify, navigate, startRef, preferredStoreName }) {
  const [notice, setNotice] = useState(null);
  const trip = activeTrip(workspace);
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, serverNowMs, notify, setNotice };
  return (
    <section className="rm-card rm-run" aria-labelledby="rm-run-title">
      {notice && (
        <div className={`rm-notice rm-notice-${notice.kind}`} role={notice.kind === 'warn' ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          <button type="button" className="rm-link" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
      {trip ? <ActiveTrip {...shared} trip={trip} navigate={navigate} /> : <StartTrip {...shared} startRef={startRef} preferredStoreName={preferredStoreName} />}
    </section>
  );
}

function StartTrip({ workspace, actorId, api, onWorkspaceChange, connected, notify, setNotice, startRef, preferredStoreName }) {
  const [store, setStore] = useState(() => lastStore(workspace) || preferredStoreName || '');
  const [minutes, setMinutes] = useState(10);
  const [missing, setMissing] = useState(false);
  const write = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const storeId = useId(), windowId = useId();
  const { name } = people(workspace, actorId);
  const waiting = liveItems(workspace).filter(item => !item.bought).length;
  const recentStore = lastStore(workspace);

  useEffect(() => {
    if (preferredStoreName && (!store.trim() || store === recentStore)) setStore(preferredStoreName);
  }, [preferredStoreName, recentStore, store]);

  async function start(event) {
    event.preventDefault();
    if (!store.trim()) { setMissing(true); startRef?.current?.focus(); return; }
    setMissing(false);
    const result = await write.send('/api/trip', 'PATCH', { expectedTripVersion: workspace.trip?.version ?? 0, action: 'start', storeName: store.trim(), requestWindowMinutes: minutes });
    if (result) {
      notify?.(result.changeSummary || `Store run started. Others can add requests for ${minutes} minutes.`);
      write.reset();
      return;
    }
    // A losing start (409) brings back the fresh snapshot. Say who actually started.
    const err = write.getLastError();
    const winner = err?.status === 409 && err.payload?.workspace?.trip;
    if (winner?.claimedBy) {
      setNotice({ kind: 'warn', text: `${name(winner.claimedBy)} started a run to ${winner.storeName}${winner.claimedAt ? ` at ${timeOf(winner.claimedAt)}` : ''}, just before you. Your run wasn't started.` });
      write.reset();
    }
  }

  return (
    <form onSubmit={start} noValidate>
      <h2 id="rm-run-title" className="rm-h2">Heading to the store?</h2>
      <fieldset disabled={write.locked || !connected} className="rm-fieldset">
        <label className="rm-field rm-run-store" htmlFor={storeId}>Store<input id={storeId} ref={startRef} value={store} placeholder={preferredStoreName || 'Where are you going?'} maxLength={60} aria-invalid={missing} onChange={e => setStore(e.target.value)} /></label>
        <details className="rm-run-window"><summary>Request window · {minutes} minutes</summary><label className="rm-field" htmlFor={windowId}>Keep requests open for<select id={windowId} value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
          {WINDOW_MINUTES.map(value => <option key={value} value={value}>{value} minutes</option>)}
        </select></label></details>
      </fieldset>
      {missing && <p className="rm-error" role="alert">Where are you going? Type a store.</p>}
      {write.state.phase === 'error' && write.state.status !== 409 && <p className="rm-error" role="alert">{write.state.error}</p>}
      <p className="rm-help">{waiting ? `${waiting} ${waiting === 1 ? 'item' : 'items'} ready to go. The group can add anything else before you leave.` : 'Start a run when you’re ready to shop.'}</p>
      <div className="rm-actions">
        <button type="submit" className="rm-btn" disabled={write.saving || !connected}>
          {write.saving ? 'Starting…' : write.state.retryable ? 'Try again' : 'Start store run'}
        </button>
        {write.state.retryable && <button type="button" className="rm-btn rm-secondary" onClick={write.reset}>Discard</button>}
      </div>
    </form>
  );
}

function ActiveTrip({ workspace, actorId, api, onWorkspaceChange, connected, serverNowMs, notify, setNotice, trip, navigate }) {
  const [confirming, setConfirming] = useState(null); // 'finish' | 'release'
  const write = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const { name } = people(workspace, actorId);
  const isShopper = trip.claimedBy === actorId;
  const onRun = liveItems(workspace).filter(item => item.runId === trip.id);
  const bought = onRun.filter(item => item.bought).length;
  const unchecked = onRun.length - bought;
  const open = acceptingRequests(trip, serverNowMs);

  async function act(action) {
    const result = await write.send('/api/trip', 'PATCH', { expectedTripVersion: trip.version, action });
    if (result) {
      setConfirming(null);
      const text = result.changeSummary || (action === 'finish'
        ? `Run finished. ${unchecked ? `${unchecked} unchecked request${unchecked === 1 ? '' : 's'} stay for the next run.` : 'Everything was bought.'}`
        : 'Run released. Unbought requests stay on the list for whoever goes next.');
      setNotice({ kind: 'ok', text });
      notify?.(text);
      if (action === 'finish') {
        queuePurchasePrompt(trip.id);
        navigate?.('spending');
      }
    }
  }

  return (
    <div>
      <h2 id="rm-run-title" className="rm-h2">{isShopper ? `You're shopping at ${trip.storeName}` : `${name(trip.claimedBy)} is shopping at ${trip.storeName}`}</h2>
      <p className="rm-run-time" role="timer" aria-live="off">
        {open
          ? <>Requests close in <strong>{clock(Date.parse(trip.requestDeadlineAt) - serverNowMs)}</strong>, at {timeOf(trip.requestDeadlineAt)}.</>
          : `Requests closed${trip.requestDeadlineAt ? ` at ${timeOf(trip.requestDeadlineAt)}` : ''}. New requests wait for the next run.`}
      </p>
      <div className="rm-progress" aria-hidden="true"><div style={{ width: `${onRun.length ? (bought / onRun.length) * 100 : 0}%` }} /></div>
      <p className="rm-help">{bought} of {onRun.length} bought on this run.</p>

      {!isShopper && <p className="rm-help">Only {name(trip.claimedBy)} can finish or release this run. You can still add requests{open ? ' to it' : ' for the next run'}.</p>}

      {isShopper && !confirming && (
        <div className="rm-actions">
          <button type="button" className="rm-btn" disabled={!connected} onClick={() => { write.reset(); setConfirming('finish'); }}>Finish run</button>
          <button type="button" className="rm-btn rm-secondary" disabled={!connected} onClick={() => { write.reset(); setConfirming('release'); }}>Release run</button>
        </div>
      )}
      {isShopper && confirming && (
        <div className="rm-confirm" role="group" aria-label={confirming === 'finish' ? 'Confirm finishing the run' : 'Confirm releasing the run'}>
          <p>
            {confirming === 'finish'
              ? <>Finish this run? {unchecked ? `${unchecked} unchecked request${unchecked === 1 ? '' : 's'} will stay on the list for the next run.` : 'Everything is checked off.'} You'll record the receipt next. No prices are needed to finish.</>
              : <>Release this run? You stop being the shopper and nothing is marked bought. Others can start a new run.</>}
          </p>
          {write.state.phase === 'error' && <p className="rm-error" role="alert">{write.state.error}</p>}
          <div className="rm-actions">
            <button type="button" className="rm-btn" disabled={write.saving || !connected} onClick={() => act(confirming)}>
              {write.saving ? 'Saving…' : write.state.retryable ? 'Try again' : confirming === 'finish' ? 'Finish run' : 'Release run'}
            </button>
            <button type="button" className="rm-btn rm-secondary" disabled={write.saving} onClick={() => { setConfirming(null); write.reset(); }}>Keep shopping</button>
          </div>
        </div>
      )}
    </div>
  );
}
