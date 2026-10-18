import { useMemo, useRef, useState } from 'react';
import samplePricing from '../../../../docs/fixtures/pricing.json';
import AddItemForm from './parts/AddItemForm.jsx';
import ItemRow from './parts/ItemRow.jsx';
import BasketCompare from './parts/BasketCompare.jsx';
import TripPanel from '../groups/parts/TripPanel.jsx';
import RunBanner from '../groups/parts/RunBanner.jsx';
import { people, useServerNow } from './lib/format.js';
import { activeTrip, itemBadge, liveItems } from './lib/trip.js';
import { PUNT_PROPOSAL } from './lib/proposal.js';
import { recipeLookup } from './lib/recipes.js';
import './roomie.css';

const byCreated = (a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);

function pricesFromCompare(result) {
  if (!result?.baskets?.length) return {};
  const best = result.baskets.find(basket => basket.id === result.cheapestCompleteBasketId)
    || result.baskets.find(basket => basket.complete)
    || result.baskets[0];
  const currency = result.currency || 'USD';
  const next = {};
  for (const line of best.items || []) {
    if (line?.itemId && Number.isInteger(line.lineTotalCents)) {
      next[line.itemId] = { cents: line.lineTotalCents, currency };
    }
  }
  return next;
}

// Shopping (#4): the shared cart, the one store-run action, and nearby basket comparison.
// Bought stays in the list (green + price) instead of moving into a separate Bought section.
export default function Shopping({ workspace, actorId, api, onWorkspaceChange, notify, connected }) {
  const nameRef = useRef(null), startRef = useRef(null), finishRef = useRef(null);
  const serverNowMs = useServerNow(workspace.serverNow);
  const { possessive } = people(workspace, actorId);
  const trip = activeTrip(workspace);
  const items = liveItems(workspace);
  const isShopper = trip?.claimedBy === actorId;
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, notify };
  const [itemPrices, setItemPrices] = useState(() => pricesFromCompare(samplePricing));
  const recipesFor = useMemo(() => recipeLookup(workspace), [workspace]);

  const onRun = useMemo(
    () => (trip ? items.filter(item => item.runId === trip.id).sort(byCreated) : []),
    [items, trip],
  );
  const offRun = useMemo(
    () => items.filter(item => !trip || item.runId !== trip.id).sort(byCreated),
    [items, trip],
  );
  const runBoughtCount = onRun.filter(item => item.bought).length;
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
              {onRun.length
                ? <ul className="rm-items">{onRun.map(row)}</ul>
                : <p className="rm-empty">Nothing on this run yet.</p>}
            </section>
          )}

          <section aria-labelledby="rm-waiting">
            <h2 id="rm-waiting" className="rm-h2 rm-section">{trip ? 'Next run' : 'Needed'}</h2>
            {offRun.length
              ? <ul className="rm-items">{offRun.map(row)}</ul>
              : <p className="rm-empty">{trip ? 'Nothing is waiting for the next run.' : 'The cart is empty. Add what the group needs.'}</p>}
          </section>
        </div>

        <div className="rm-side">
          <TripPanel {...shared} serverNowMs={serverNowMs} startRef={startRef} finishRef={finishRef} />
          <BasketCompare
            workspace={workspace}
            actorId={actorId}
            api={api}
            connected={connected}
            items={items.filter(item => !item.bought)}
            onPrices={prices => setItemPrices(current => ({ ...current, ...prices }))}
          />
          {PUNT_PROPOSAL && <p className="rm-help rm-proposal">Proposal build: "Not here" sends a <code>punted</code> field that API v2 doesn't define yet (see #4).</p>}
        </div>
      </div>

      {/* Phone dock: the run action stays reachable without scrolling back up. */}
      <div className="rm-dock">
        {!trip && <button type="button" className="rm-btn" onClick={() => { startRef.current?.scrollIntoView({ block: 'center' }); startRef.current?.focus(); }}>Start a store run</button>}
        {trip && isShopper && <button type="button" className="rm-btn" onClick={() => { finishRef.current?.scrollIntoView({ block: 'center' }); finishRef.current?.focus(); }}>Finish run ({runBoughtCount} of {onRun.length} bought)</button>}
        {trip && !isShopper && <button type="button" className="rm-btn rm-secondary" onClick={focusAdd}>Add a request</button>}
      </div>
    </div>
  );
}
