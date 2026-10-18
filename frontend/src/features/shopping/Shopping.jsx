import { useMemo, useRef, useState } from 'react';
import AddItemForm from './parts/AddItemForm.jsx';
import ItemRow from './parts/ItemRow.jsx';
import BasketCompare from './parts/BasketCompare.jsx';
import TripPanel from '../groups/parts/TripPanel.jsx';
import RunBanner from '../groups/parts/RunBanner.jsx';
import { useServerNow } from './lib/format.js';
import { activeTrip, itemBadge, liveItems } from './lib/trip.js';
import { recipeLookup } from './lib/recipes.js';
import './roomie.css';
import { useListMotion } from '../../components/useMotion.js';
import { isFamilyTable, splitsCosts } from '../../household.js';

export default function Shopping({ workspace, actorId, api, onWorkspaceChange, notify, navigate, connected, membership }) {
  const nameRef = useRef(null), startRef = useRef(null);
  const [matchedStore, setMatchedStore] = useState('');
  const [itemPrices, setItemPrices] = useState({});
  const [clearState, setClearState] = useState({ phase: 'idle', message: '' });
  const serverNowMs = useServerNow(workspace.serverNow);
  const trip = activeTrip(workspace);
  const items = liveItems(workspace), needed = items.filter(item => !item.bought), bought = items.filter(item => item.bought);
  // Each person sees their own items first. Only the person who added an item can change or remove
  // it; only the active shopper can check items off.
  const mine = needed.filter(item => item.addedBy === actorId);
  const others = needed.filter(item => item.addedBy !== actorId);
  const mineMotion = useListMotion(mine);
  const othersMotion = useListMotion(others);
  const isShopper = trip?.claimedBy === actorId;
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, notify, navigate };
  const recipesFor = useMemo(() => recipeLookup(workspace), [workspace]);
  // Quotes only describe the exact revision checked; edits invalidate their displayed prices.
  const prices = itemPrices.revision === workspace.listRevision ? itemPrices.values : {};
  const row = item => <ItemRow key={item.id} item={item} {...shared} trip={trip} badge={itemBadge(item, trip, actorId)} price={prices?.[item.id]} recipes={recipesFor(item)} />;
  async function clearList(undo = false) {
    if (!undo && clearState.phase !== 'confirm') { setClearState({ phase: 'confirm', message: '' }); return; }
    const targets = undo ? (clearState.removed || []).map(old => workspace.items.find(item => item.id === old.id && item.version === old.version && item.removed)).filter(Boolean) : mine;
    if (!connected || !targets.length) return;
    setClearState(current => ({ ...current, phase: 'saving' }));
    const results = [];
    for (const item of targets) {
      try { results.push(await api.request(`/api/items/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(), expectedItemVersion: item.version, removed: !undo } })); }
      catch (error) { if (error.payload?.workspace) onWorkspaceChange(error.payload.workspace); }
    }
    if (results.length) onWorkspaceChange(results.at(-1).workspace);
    const last = results.at(-1)?.workspace;
    const removed = undo ? [] : (last?.items || []).filter(item => item.removed && targets.some(target => target.id === item.id));
    const failed = targets.length - results.length;
    setClearState({ phase: 'done', removed, message: `${undo ? 'Restored' : 'Removed'} ${results.length} items.${failed ? ` ${failed} changed or couldn’t be updated; check the list and retry.` : ''}` });
  }
  return <div className="rm-page">
    <div className="rm-title-row"><h1 className="rm-h1">Shopping</h1><span className="rm-cart-summary">{needed.length} to pick up</span><button className="rm-btn rm-secondary" onClick={() => navigate('home-new')}>Ask Cartners</button>{mine.length > 0 && <button className="rm-link" disabled={!connected || clearState.phase === 'saving'} onClick={() => clearList()}>{clearState.phase === 'saving' ? 'Updating…' : clearState.phase === 'confirm' ? `Confirm remove ${mine.length}` : 'Clear my items'}</button>}</div>
    <p className="rm-intro">{isFamilyTable(workspace, membership) ? 'Mom, dad, or whoever is out can pick this up for the table. Price it at the nearest Kroger-family store, then check items as they go in the cart.' : splitsCosts(workspace) ? 'Anyone can run to the store. Afterward, split the receipt and settle with Venmo, Zelle, Cash App, or PayPal. Cartners never moves the money.' : 'Price the list against nearby Kroger-family stores, then pick it up together. Check an item when you’ve purchased it.'}</p>
    {clearState.phase === 'confirm' && <p className="rm-notice">Remove the {mine.length} unpurchased {mine.length === 1 ? 'item' : 'items'} you added? Items others added and purchased history stay. <button className="rm-link" onClick={() => setClearState({ phase: 'idle' })}>Cancel</button></p>}
    {clearState.message && <p className="rm-notice" role="status">{clearState.message} {!!clearState.removed?.length && <button className="rm-link" disabled={clearState.phase === 'saving' || !connected} onClick={() => clearList(true)}>Undo</button>}</p>}
    <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={() => nameRef.current?.focus()} />
    <BasketCompare key={workspace.listRevision} {...shared} items={needed} onPrices={values => setItemPrices({ revision: workspace.listRevision, values })} onStoreFound={setMatchedStore} />
    <div className="shopping-flow"><section className="shopping-list" aria-label="Shared shopping list">
      <AddItemForm {...shared} serverNowMs={serverNowMs} nameRef={nameRef} />
      <div className="grocery-notepad">
        <header className="notepad-heading"><h2>Our grocery list</h2><p>{needed.length} to pick up · {bought.length} purchased</p></header>
        {needed.length ? <>
          {mine.length > 0 && <section aria-label="My items"><h3 className="notepad-section-title">My items · {mine.length}</h3><ul ref={mineMotion} className="rm-items">{mine.map(row)}</ul></section>}
          {others.length > 0 && <section aria-label="Everyone else"><h3 className="notepad-section-title">Everyone else · {others.length}</h3><ul ref={othersMotion} className="rm-items">{others.map(row)}</ul></section>}
        </> : <div className="rm-empty-state"><h3>{bought.length ? 'Everything is picked up.' : 'Your list starts here.'}</h3><p>{bought.length ? 'Add more groceries whenever you need them.' : 'Type an item above, or let Cartners build a list from your dinner idea.'}</p><button className="rm-btn" onClick={() => navigate('home-new')}>Find a meal or groceries</button></div>}
        {bought.length > 0 && <section className="purchased-list" aria-label="Purchased groceries"><h3 className="notepad-section-title">Purchased · {bought.length}</h3>{isShopper && <p className="rm-help">Uncheck an item to put it back on the list.</p>}<ul className="rm-items">{bought.map(row)}</ul></section>}
      </div>
    </section>
    {(needed.length > 0 || trip) && <aside className="shopping-next"><h2 className="rm-h2">Ready to shop?</h2><p className="rm-help">Start a store run once you’ve picked a nearby trip. Live prices only appear when Kroger returns them.</p><TripPanel {...shared} serverNowMs={serverNowMs} startRef={startRef} preferredStoreName={matchedStore} /></aside>}
    </div>
  </div>;
}
