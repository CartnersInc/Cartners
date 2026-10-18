import { useRef } from 'react';
import AddItemForm from './parts/AddItemForm.jsx';
import ItemRow from './parts/ItemRow.jsx';
import BasketCompare from './parts/BasketCompare.jsx';
import TripPanel from '../groups/parts/TripPanel.jsx';
import RunBanner from '../groups/parts/RunBanner.jsx';
import { people, useServerNow } from './lib/format.js';
import { activeTrip, itemBadge, liveItems } from './lib/trip.js';
import { PUNT_PROPOSAL } from './lib/proposal.js';
import './roomie.css';

const byCreated = (a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);

// Shopping (#4): the shared cart, the one store-run action, and nearby basket comparison.
// Everything renders from the shell's snapshot; writes return a fresh snapshot to the shell.
export default function Shopping({ workspace, actorId, api, onWorkspaceChange, notify, navigate, connected }) {
  const nameRef = useRef(null), startRef = useRef(null), finishRef = useRef(null);
  const serverNowMs = useServerNow(workspace.serverNow);
  const { possessive } = people(workspace, actorId);
  const trip = activeTrip(workspace);
  const items = liveItems(workspace);
  const isShopper = trip?.claimedBy === actorId;
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, notify, navigate };

  const onRun = trip ? items.filter(item => item.runId === trip.id) : [];
  const runOpen = onRun.filter(item => !item.bought).sort(byCreated);
  const runBought = onRun.filter(item => item.bought).sort(byCreated);
  const waiting = items.filter(item => !item.bought && (!trip || item.runId !== trip.id)).sort(byCreated);
  const bought = items.filter(item => item.bought && (!trip || item.runId !== trip.id)).sort(byCreated).reverse();
  const newCount = runOpen.filter(item => itemBadge(item, trip, actorId)?.kind === 'new').length;
  const row = item => <ItemRow key={item.id} item={item} {...shared} trip={trip} badge={itemBadge(item, trip, actorId)} />;
  const focusAdd = () => { nameRef.current?.scrollIntoView({ block: 'center' }); nameRef.current?.focus(); };

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Shopping</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Sample preview</span>}
      </div>
      <p className="rm-intro">One shared cart. Add what you need, and say when you're heading out.</p>
      {!connected && <p className="rm-help">These requests come from the checked-in sample. Connect the backend to add, check off, or start a run.</p>}

      <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={focusAdd} />

      <div className="rm-columns">
        <div className="rm-main">
          <AddItemForm {...shared} serverNowMs={serverNowMs} nameRef={nameRef} />

          {trip && (
            <section aria-labelledby="rm-on-run">
              <h2 id="rm-on-run" className="rm-h2 rm-section">
                On {possessive(trip.claimedBy)} run to {trip.storeName}
                {isShopper && newCount > 0 && <span className="rm-badge rm-badge-new">{newCount} new</span>}
              </h2>
              {runOpen.length ? <ul className="rm-items">{runOpen.map(row)}</ul> : <p className="rm-empty">{onRun.length ? 'Everything on this run is checked off.' : 'Nothing on this run yet.'}</p>}
              {runBought.length > 0 && (
                <details className="rm-collapsed">
                  <summary>Bought on this run ({runBought.length})</summary>
                  <ul className="rm-items">{runBought.map(row)}</ul>
                </details>
              )}
            </section>
          )}

          <section aria-labelledby="rm-waiting">
            <h2 id="rm-waiting" className="rm-h2 rm-section">{trip ? 'Next run' : 'Needed'}</h2>
            {waiting.length ? <ul className="rm-items">{waiting.map(row)}</ul> : <p className="rm-empty">{trip ? 'Nothing is waiting for the next run.' : 'The cart is empty. Add what the group needs.'}</p>}
          </section>

          {bought.length > 0 && (
            <details className="rm-collapsed">
              <summary>Bought ({bought.length})</summary>
              <ul className="rm-items">{bought.map(row)}</ul>
            </details>
          )}
        </div>

        <div className="rm-side">
          <TripPanel {...shared} serverNowMs={serverNowMs} startRef={startRef} finishRef={finishRef} />
          <BasketCompare workspace={workspace} actorId={actorId} api={api} connected={connected} items={items.filter(item => !item.bought)} />
          {PUNT_PROPOSAL && <p className="rm-help rm-proposal">Proposal build: "Not here" sends a <code>punted</code> field that API v2 doesn't define yet (see #4).</p>}
        </div>
      </div>

      {/* Phone dock: the run action stays reachable without scrolling back up. */}
      <div className="rm-dock">
        {!trip && <button type="button" className="rm-btn" onClick={() => { startRef.current?.scrollIntoView({ block: 'center' }); startRef.current?.focus(); }}>Start a store run</button>}
        {trip && isShopper && <button type="button" className="rm-btn" onClick={() => { finishRef.current?.scrollIntoView({ block: 'center' }); finishRef.current?.focus(); }}>Finish run ({runBought.length} of {onRun.length} bought)</button>}
        {trip && !isShopper && <button type="button" className="rm-btn rm-secondary" onClick={focusAdd}>Add a request</button>}
      </div>
    </div>
  );
}
