import { useMemo, useRef, useState } from 'react';
import samplePricing from '../../../../docs/fixtures/pricing.json';
import AddItemForm from './parts/AddItemForm.jsx';
import ItemRow from './parts/ItemRow.jsx';
import BasketCompare from './parts/BasketCompare.jsx';
import TripPanel from '../groups/parts/TripPanel.jsx';
import RunBanner from '../groups/parts/RunBanner.jsx';
import { formatCents, people, useServerNow } from './lib/format.js';
import { activeTrip, itemBadge, liveItems } from './lib/trip.js';
import { recipeLookup } from './lib/recipes.js';
import { buildCheckout, priceForItem, saveCheckout } from './lib/checkout.js';
import './roomie.css';

const byCreated = (a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);

function pricesFromResult(result) {
  if (!result?.baskets?.length) return {};
  const best = result.baskets.find(basket => basket.id === result.cheapestCompleteBasketId)
    || result.baskets.find(basket => basket.complete)
    || result.baskets[0];
  const currency = result.currency || 'USD';
  const next = {};
  for (const line of best.items || []) {
    if (line?.itemId && Number.isInteger(line.lineTotalCents)) {
      next[line.itemId] = { cents: line.lineTotalCents, currency, estimated: false };
    }
  }
  return next;
}

// Shopping: cart rows start checked/green. Uncheck removes. Buy opens Venmo/Zelle checkout.
export default function Shopping({ workspace, actorId, api, onWorkspaceChange, notify, navigate, connected }) {
  const nameRef = useRef(null), startRef = useRef(null);
  const [matchedStore, setMatchedStore] = useState('');
  const [itemPrices, setItemPrices] = useState(() => pricesFromResult(samplePricing));
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
  const cartItems = useMemo(() => items.filter(item => item.bought && !item.removed), [items]);
  const newCount = onRun.filter(item => itemBadge(item, trip, actorId)?.kind === 'new').length;

  const pricedRows = useMemo(
    () => cartItems.map(item => ({ item, price: priceForItem(item, itemPrices) })),
    [cartItems, itemPrices],
  );
  const cartTotalCents = pricedRows.reduce((sum, row) => sum + row.price.cents, 0);
  const cartCurrency = pricedRows[0]?.price.currency || 'USD';

  const row = item => (
    <ItemRow
      key={item.id}
      item={item}
      {...shared}
      trip={trip}
      badge={itemBadge(item, trip, actorId)}
      price={priceForItem(item, itemPrices)}
      recipes={recipesFor(item)}
    />
  );
  const focusAdd = () => { nameRef.current?.scrollIntoView({ block: 'center' }); nameRef.current?.focus(); };

  function buyCart() {
    if (!cartItems.length) {
      notify?.('Add something to the cart before buying.');
      return;
    }
    const checkout = buildCheckout({
      workspaceId: workspace.workspaceId,
      actorId,
      items: cartItems,
      priceMap: itemPrices,
    });
    saveCheckout(checkout);
    notify?.(`Checkout ready · ${formatCents(checkout.totalCents, checkout.currency)}`);
    navigate('spending');
  }

  async function clearList() {
    if (clearState.phase === 'confirm') {
      const targets = items;
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
      const message = failed ? `Removed ${removed}; ${failed} couldn't be removed. Refresh the list and try again.` : `Removed ${removed} ${removed === 1 ? 'item' : 'items'} from the cart.`;
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
        <span className="rm-cart-summary" aria-label={`${cartItems.length} items in cart`}>
          {cartItems.length} in cart
          {cartItems.length > 0 && <> · {formatCents(cartTotalCents, cartCurrency)}</>}
        </span>
        {items.length > 0 && (
          <button type="button" className="rm-btn rm-empty-cart" disabled={!connected || clearState.phase === 'saving'} onClick={clearList}>
            {clearState.phase === 'saving' ? 'Emptying…' : clearState.phase === 'confirm' ? `Remove all ${items.length}` : 'Empty cart'}
          </button>
        )}
      </div>
      <p className="rm-intro">Items land in the cart checked. Uncheck anything you don’t want. Prices show on each row.</p>
      {clearState.phase === 'confirm' && (
        <div className="rm-clear-confirm">
          <p role="status">Remove all {items.length} items from the cart?</p>
          <button type="button" className="rm-link" onClick={() => setClearState({ phase: 'idle', message: '' })}>Keep items</button>
        </div>
      )}
      {clearState.message && <p className={clearState.phase === 'error' ? 'rm-error' : 'rm-ok'} role={clearState.phase === 'error' ? 'alert' : 'status'}>{clearState.message}</p>}

      <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={focusAdd} />
      <BasketCompare
        workspace={workspace}
        actorId={actorId}
        api={api}
        connected={connected}
        items={items}
        onPrices={prices => setItemPrices(current => ({ ...current, ...prices }))}
        onStoreFound={setMatchedStore}
      />

      <div className="rm-dock rm-dock-buy">
        <button type="button" className="rm-btn" disabled={!cartItems.length} onClick={buyCart}>
          Buy{cartItems.length ? ` · ${formatCents(cartTotalCents, cartCurrency)}` : ''}
        </button>
        {!trip && (
          <button type="button" className="rm-btn rm-secondary" onClick={() => { startRef.current?.scrollIntoView({ block: 'center' }); startRef.current?.focus(); }}>
            Start a store run
          </button>
        )}
      </div>

      <div className="rm-columns">
        <div className="rm-main">
          <AddItemForm {...shared} serverNowMs={serverNowMs} nameRef={nameRef} />

          {trip && (
            <section aria-labelledby="rm-on-run">
              <div className="rm-list-heading">
                <h2 id="rm-on-run" className="rm-h2">
                  On {possessive(trip.claimedBy)} run to {trip.storeName}
                  {isShopper && newCount > 0 && <span className="rm-badge rm-badge-new">{newCount} new</span>}
                </h2>
              </div>
              {onRun.length ? <ul className="rm-items">{onRun.map(row)}</ul> : <p className="rm-empty">Nothing is on this run yet.</p>}
            </section>
          )}

          <section aria-labelledby="rm-cart">
            <div className="rm-list-heading">
              <h2 id="rm-cart" className="rm-h2">
                {trip ? 'Also in the cart' : 'Your cart'} <span className="rm-count">{offRun.length}</span>
              </h2>
              {cartItems.length > 0 && (
                <span className="rm-cart-total">{formatCents(cartTotalCents, cartCurrency)}</span>
              )}
            </div>
            {offRun.length
              ? <ul className="rm-items">{offRun.map(row)}</ul>
              : (
                <div className="rm-empty-state">
                  <p>{items.length ? 'Everything on this list is already on the active run.' : 'Your cart is empty.'}</p>
                  <button type="button" className="rm-btn" onClick={() => navigate('home')}>Find dinner with Cartners</button>
                </div>
              )}
          </section>
        </div>

        <div className="rm-side">
          <TripPanel {...shared} serverNowMs={serverNowMs} startRef={startRef} preferredStoreName={matchedStore} />
          {cartItems.length > 0 && (
            <section className="rm-card" aria-labelledby="rm-buy-side">
              <h2 id="rm-buy-side" className="rm-h2">Ready to buy</h2>
              <p className="rm-help">{cartItems.length} item{cartItems.length === 1 ? '' : 's'} · {formatCents(cartTotalCents, cartCurrency)}</p>
              <button type="button" className="rm-btn" onClick={buyCart}>Buy with Venmo / Zelle</button>
              <p className="rm-help">Opens Spending with your cart details and payment links. Opening a link never marks a debt paid.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
