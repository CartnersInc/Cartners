import { useMemo, useRef, useState } from 'react';
import AddItemForm from './parts/AddItemForm.jsx';
import ItemRow from './parts/ItemRow.jsx';
import BasketCompare from './parts/BasketCompare.jsx';
import TripPanel from '../groups/parts/TripPanel.jsx';
import RunBanner from '../groups/parts/RunBanner.jsx';
import { people, useServerNow } from './lib/format.js';
import { activeTrip, itemBadge, liveItems } from './lib/trip.js';
import { recipeLookup } from './lib/recipes.js';
import './roomie.css';

const byCreated = (a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);

// Shopping (#4): the shared cart, the one store-run action, and nearby basket comparison.
// Everything renders from the shell's snapshot; writes return a fresh snapshot to the shell.
// Bought stays in the list (green + price) instead of moving into a separate Bought section.
export default function Shopping({ workspace, actorId, api, onWorkspaceChange, notify, navigate, connected }) {
  const nameRef = useRef(null), startRef = useRef(null);
  const [matchedStore, setMatchedStore] = useState('');
  const [itemPrices, setItemPrices] = useState({});
  const [clearState, setClearState] = useState({ phase: 'idle', message: '' });
  const serverNowMs = useServerNow(workspace.serverNow);
  const { possessive } = people(workspace, actorId);
  const trip = activeTrip(workspace);
  const items = liveItems(workspace);
  const isShopper = trip?.claimedBy === actorId;
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, notify, navigate };
  const recipesFor = useMemo(() => recipeLookup(workspace), [workspace]);
  const onRun = useMemo(
    () => (trip ? items.filter(item => item.runId === trip.id).sort(byCreated) : []),
    [items, trip],
  );
  const offRun = useMemo(
    () => items.filter(item => !trip || item.runId !== trip.id).sort(byCreated),
    [items, trip],
  );
  const needed = items.filter(item => !item.bought);
  const waiting = offRun.filter(item => !item.bought);
  const boughtWaiting = offRun.filter(item => item.bought);
  const newCount = onRun.filter(item => !item.bought && itemBadge(item, trip, actorId)?.kind === 'new').length;

  const row = item => (
    <ItemRow
      key={item.id}
      item={item}
      {...shared}
      trip={trip}
      badge={itemBadge(item, trip, actorId)}
      price={itemPrices[item.id] || null}
      recipes={recipesFor(item)}
    />
  );
  const focusAdd = () => { nameRef.current?.scrollIntoView({ block: 'center' }); nameRef.current?.focus(); };

  async function clearList() {
    if (clearState.phase === 'confirm') {
      const targets = needed;
      if (!connected || !targets.length) return;
      setClearState({ phase: 'saving', message: '' });
      const results = await Promise.allSettled(targets.map(item => api.request(`/api/items/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: { workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(), expectedItemVersion: item.version, removed: true },
      })));
      const snapshots = results.flatMap(result => result.status === 'fulfilled' ? [result.value?.workspace] : [result.reason?.payload?.workspace]).filter(Boolean);
      snapshots.sort((a, b) => b.listRevision - a.listRevision);
      if (snapshots[0]) onWorkspaceChange(snapshots[0]);
      const removed = results.filter(result => result.status === 'fulfilled').length;
      const failed = targets.length - removed;
      const message = failed ? `Removed ${removed}; ${failed} couldn't be removed. Refresh the list and try again.` : `Removed ${removed} ${removed === 1 ? 'item' : 'items'} from the list.`;
      setClearState({ phase: failed ? 'error' : 'done', message });
      notify?.(message);
      return;
    }
    setClearState({ phase: 'confirm', message: '' });
  }

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Shopping</h1>
        <span className="rm-cart-summary" aria-label={`${needed.length} items still needed`}>{needed.length} to buy</span>
        {needed.length > 0 && <button type="button" className="rm-btn rm-empty-cart" disabled={!connected || clearState.phase === 'saving'} onClick={clearList}>{clearState.phase === 'saving' ? 'Emptying…' : clearState.phase === 'confirm' ? `Remove all ${needed.length}` : 'Empty cart'}</button>}
      </div>
      {clearState.phase === 'confirm' && <div className="rm-clear-confirm"><p role="status">Remove all {needed.length} items that still need buying? Bought items stay in the list.</p><button type="button" className="rm-link" onClick={() => setClearState({ phase: 'idle', message: '' })}>Keep items</button></div>}
      {clearState.message && <p className={clearState.phase === 'error' ? 'rm-error' : 'rm-ok'} role={clearState.phase === 'error' ? 'alert' : 'status'}>{clearState.message}</p>}

      <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={focusAdd} />
      <BasketCompare workspace={workspace} actorId={actorId} api={api} connected={connected} items={needed}
        onPrices={setItemPrices} onStoreFound={setMatchedStore} />
      {!trip && <div className="rm-dock"><button type="button" className="rm-btn" onClick={() => { startRef.current?.scrollIntoView({ block: 'center' }); startRef.current?.focus(); }}>Start a store run</button></div>}

      <div className="rm-columns">
        <div className="rm-main">
          <AddItemForm {...shared} serverNowMs={serverNowMs} nameRef={nameRef} />

          {trip && <section aria-labelledby="rm-on-run">
            <div className="rm-list-heading"><h2 id="rm-on-run" className="rm-h2">On {possessive(trip.claimedBy)} run to {trip.storeName}{isShopper && newCount > 0 && <span className="rm-badge rm-badge-new">{newCount} new</span>}</h2></div>
            {onRun.length ? <ul className="rm-items">{onRun.map(row)}</ul> : <p className="rm-empty">Nothing is on this run yet.</p>}
          </section>}

          <section aria-labelledby="rm-waiting">
            <div className="rm-list-heading">
              <h2 id="rm-waiting" className="rm-h2">{trip ? 'Next run' : 'Needed'} <span className="rm-count">{waiting.length}</span></h2>
            </div>
            {waiting.length ? <ul className="rm-items">{waiting.map(row)}</ul> : <div className="rm-empty-state"><p>{boughtWaiting.length ? 'Nothing left to buy.' : 'Your cart is empty.'}</p><button type="button" className="rm-btn" onClick={() => navigate('home')}>Find dinner with Cartners</button></div>}
          </section>

          {boughtWaiting.length > 0 && <details className="rm-bought-group">
            <summary>Bought <span className="rm-count">{boughtWaiting.length}</span></summary>
            <ul className="rm-items">{boughtWaiting.map(row)}</ul>
          </details>}

        </div>

        <div className="rm-side">
          <TripPanel {...shared} serverNowMs={serverNowMs} startRef={startRef} preferredStoreName={matchedStore} />
        </div>
      </div>
    </div>
  );
}
