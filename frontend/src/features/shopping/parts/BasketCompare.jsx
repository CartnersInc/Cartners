import { useEffect, useId, useRef, useState } from 'react';
import { formatCents, whenOf } from '../lib/format.js';

const ZIP_KEY = 'cartners:price-area';
const readZip = () => { try { return localStorage.getItem(ZIP_KEY) || ''; } catch { return ''; } };
const SOURCE_LABEL = { live_api: 'Live Kroger prices' };
const KROGER_LOGO = `${import.meta.env.BASE_URL}logos/kroger.jpg`;

function milesOf(basket) {
  if (Number.isFinite(basket?.distanceMiles)) return basket.distanceMiles;
  if (Number.isFinite(basket?.distanceKm)) return basket.distanceKm / 1.60934;
  return null;
}

function featuredBasket(result) {
  if (!result?.baskets?.length) return null;
  return result.baskets.find(basket => basket.id === result.nearestBasketId)
    || [...result.baskets].sort((a, b) => (milesOf(a) ?? 9999) - (milesOf(b) ?? 9999))[0]
    || result.baskets.find(basket => basket.complete)
    || result.baskets[0];
}

function pricesFromResult(result) {
  if (!result?.baskets?.length || result.sourceMode !== 'live_api') return {};
  const nearest = featuredBasket(result);
  return Object.fromEntries((nearest?.items || [])
    .filter(line => line?.itemId && Number.isInteger(line.lineTotalCents))
    .map(line => [line.itemId, { cents: line.lineTotalCents, currency: result.currency || 'USD' }]));
}

function splitTrip(baskets, itemIds) {
  if (baskets.length < 2 || !itemIds.length) return null;
  const picks = [];
  for (const itemId of itemIds) {
    const options = baskets.flatMap(basket => {
      const line = basket.items?.find(entry => entry.itemId === itemId);
      return Number.isInteger(line?.lineTotalCents) ? [{ basket, line }] : [];
    });
    if (!options.length) return null;
    options.sort((a, b) => a.line.lineTotalCents - b.line.lineTotalCents);
    picks.push(options[0]);
  }
  const storeIds = [...new Set(picks.map(pick => pick.basket.storeId))];
  if (storeIds.length !== 2) return null;
  const total = picks.reduce((sum, pick) => sum + pick.line.lineTotalCents, 0);
  const bestSingle = baskets.filter(basket => basket.complete).sort((a, b) => a.knownSubtotalCents - b.knownSubtotalCents)[0];
  if (!bestSingle || bestSingle.knownSubtotalCents - total < 300) return null;
  const stores = storeIds.map(id => baskets.find(basket => basket.storeId === id)).filter(Boolean);
  return { stores, total, saveCents: bestSingle.knownSubtotalCents - total, picks };
}

// The price check is optional, visible, and only shows store results returned by the backend.
export default function BasketCompare({ workspace, actorId, api, connected, items, onPrices, onStoreFound }) {
  const [zip, setZip] = useState(readZip);
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ phase: 'idle', error: '' });
  const [locating, setLocating] = useState(false);
  const [openTrip, setOpenTrip] = useState('');
  const [coords, setCoords] = useState(null);
  const zipId = useId();
  const comparedFor = useRef('');
  const nameOf = id => workspace.items.find(item => item.id === id)?.name || 'A grocery item';

  function useMyLocation() {
    if (!navigator.geolocation) {
      setState({ phase: 'error', error: 'This browser cannot use your location. Type a ZIP instead.' });
      return;
    }
    setLocating(true);
    setState({ phase: 'idle', error: '' });
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const params = new URLSearchParams({
          latitude: position.coords.latitude.toFixed(5),
          longitude: position.coords.longitude.toFixed(5),
          localityLanguage: 'en',
        });
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
        const found = response.ok ? await response.json() : null;
        const zipCode = String(found?.postcode || '').match(/\d{5}/)?.[0];
        if (zipCode) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setZip(zipCode);
        }
        else setState({ phase: 'error', error: 'No US ZIP code was found for that location. Type a postal code instead.' });
      } catch {
        setState({ phase: 'error', error: 'Could not find a ZIP for that location. Type it instead.' });
      } finally {
        setLocating(false);
      }
    }, () => {
      setLocating(false);
      setState({ phase: 'error', error: 'Location was not allowed. Type a ZIP instead.' });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  async function compareList(postalCode) {
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(postalCode)) {
      setState({ phase: 'error', error: 'Enter your ZIP or postal code to check nearby stores.' });
      return;
    }
    if (!connected || !items.length) return;
    try { localStorage.setItem(ZIP_KEY, postalCode); } catch { /* A saved area is only a convenience. */ }
    const signature = `${workspace.listRevision}:${postalCode}:${items.map(item => item.id).join(',')}`;
    comparedFor.current = signature;
    setState({ phase: 'loading', error: '' });
    setResult(null);
    try {
      const response = await api.request('/api/baskets/compare', { method: 'POST', body: {
        workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(),
        itemIds: items.map(item => item.id), postalCode,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      } });
      setResult(response);
      onPrices?.(pricesFromResult(response));
      if (response.sourceMode === 'live_api') {
        const nearest = featuredBasket(response);
        if (nearest?.storeName) onStoreFound?.(nearest.storeName);
        setOpenTrip(nearest?.id || '');
      }
      setState({ phase: 'idle', error: '' });
    } catch (err) {
      setState({ phase: 'error', error: err.message || 'Could not check nearby prices. Your list is still available.' });
    }
  }

  const itemKey = items.map(item => item.id).join(',');
  useEffect(() => {
    const postalCode = zip.trim();
    const signature = `${workspace.listRevision}:${postalCode}:${itemKey}`;
    if (!connected || !itemKey || !/^\d{5}/.test(postalCode) || comparedFor.current === signature) return;
    compareList(postalCode);
  }, [connected, itemKey, zip, workspace.listRevision, coords]);

  function compare(event) {
    event.preventDefault();
    compareList(zip.trim());
  }

  const baskets = result?.sourceMode === 'live_api' ? [...(result.baskets || [])].sort((a, b) => (milesOf(a) ?? 9999) - (milesOf(b) ?? 9999)) : [];
  const complete = baskets.filter(basket => basket.complete);
  const cheapest = complete.find(basket => basket.id === result?.cheapestCompleteBasketId) || [...complete].sort((a, b) => a.knownSubtotalCents - b.knownSubtotalCents)[0];
  const nearest = featuredBasket(result);

  return (
    <section className="rm-card rm-compare rm-compare-prominent" aria-labelledby="rm-compare-heading" aria-busy={state.phase === 'loading'}>
      <div className="rm-compare-title">
        <div><h2 className="rm-h2" id="rm-compare-heading">Find cheapest groceries nearby</h2><p className="rm-help">Use your location to price the list at the nearest Kroger-family store (QFC or Fred Meyer). Other nearby stores stay listed so you can compare, but cart prices and the store run default to the closest one.</p></div>
        <img className="rm-kroger-logo" src={KROGER_LOGO} alt="Kroger" />
      </div>
      <form onSubmit={compare} noValidate className="rm-compare-form">
        <div className="rm-compare-controls">
          <label className="rm-field" htmlFor={zipId}>ZIP or postal code
            <input id={zipId} value={zip} maxLength={10} autoComplete="postal-code" inputMode="text" placeholder="Enter your area" onChange={e => setZip(e.target.value)} />
          </label>
          <button type="button" className="rm-btn rm-secondary" disabled={locating || state.phase === 'loading'} onClick={useMyLocation}>{locating ? 'Finding ZIP…' : 'Use my location'}</button>
          <button type="submit" className="rm-btn" disabled={!connected || !items.length || state.phase === 'loading' || locating}>
            {state.phase === 'loading' ? 'Finding nearby prices…' : 'Compare my list'}
          </button>
        </div>
        {!items.length && <p className="rm-help">Add groceries to your list and Cartners can price them together.</p>}
        {!connected && <p className="rm-help">Store prices appear when Cartners is connected. We won’t show made-up prices.</p>}
      </form>

      {locating && <p className="rm-help" role="status">Looking up the ZIP for your location.</p>}
      {state.phase === 'error' && <p className="rm-error" role="alert">{state.error}</p>}
      {state.phase === 'loading' && <p className="rm-help" role="status">Checking {items.length} {items.length === 1 ? 'item' : 'items'} near {zip.trim()}…</p>}

      {result && result.sourceMode !== 'live_api' && <p className="rm-notice" role="status">{result.sourceMode === 'sample' ? 'Kroger has not returned verified prices yet. No sample prices are shown.' : 'Kroger prices are unavailable right now. Your list is ready to use.'}</p>}
      {result?.sourceMode === 'live_api' && <TripPicker
        baskets={baskets}
        nearest={nearest}
        cheapest={cheapest}
        split={splitTrip(baskets, items.map(item => item.id))}
        openTrip={openTrip}
        setOpenTrip={setOpenTrip}
        nameOf={nameOf}
        currency={result.currency}
        checkedAt={result.checkedAt}
        feeStatus={result.feeStatus}
        onShop={onStoreFound}
      />}
    </section>
  );
}

function stockLabel(value) {
  const level = String(value || '').toLowerCase();
  if (!level) return 'Availability not reported';
  if (level.includes('out') || level.includes('none')) return 'Reported out of stock';
  if (level.includes('low')) return 'Reported low stock';
  if (level.includes('high') || level.includes('in stock') || level.includes('available')) return 'Reported in stock';
  return `Availability: ${value}`;
}

function TripPicker({ baskets, nearest, cheapest, split, openTrip, setOpenTrip, nameOf, currency, checkedAt, feeStatus, onShop }) {
  const completeCount = baskets.filter(basket => basket.complete).length;
  const missingCount = baskets.filter(basket => !basket.complete).length;
  return <div className="rm-compare-result" aria-live="polite">
    <div className="rm-trip-heading">
      <h3 className="rm-h3">Nearest Kroger first</h3>
      <p className="rm-help">{completeCount} complete option{completeCount === 1 ? '' : 's'}{missingCount ? ` · ${missingCount} with missing prices` : ''}</p>
      <p className="rm-compare-source"><span className="rm-pill rm-pill-live">{SOURCE_LABEL.live_api}</span>{checkedAt && <span>Checked {whenOf(checkedAt)}</span>}</p>
    </div>
    {split && <article className="rm-store-result rm-split-trip">
      <div className="rm-basket-head">
        <strong><span className="rm-pill">2-store trip</span> {split.stores.map(store => store.storeName).join(' + ')}</strong>
        <span className="rm-price">{formatCents(split.total, currency)}</span>
      </div>
      <p className="rm-help">Save up to {formatCents(split.saveCents, currency)} versus the cheapest single store, if both stops are worth it.</p>
    </article>}
    {baskets.map(basket => {
      const open = openTrip === basket.id;
      const miles = milesOf(basket);
      return <section key={basket.id} className={`rm-store-result ${basket.id === nearest?.id ? 'rm-store-best' : ''}`}>
        <button type="button" className="rm-trip-toggle" aria-expanded={open} onClick={() => setOpenTrip(open ? '' : basket.id)}>
          <span>
            <strong><img className="rm-store-logo" src={KROGER_LOGO} alt="" />{basket.storeName}</strong>
            <small>{basket.id === nearest?.id ? 'Nearest' : basket.id === cheapest?.id ? 'Cheapest complete' : basket.complete ? `${basket.items.length} priced items` : `${basket.missingItemIds?.length || 0} missing`}{miles != null ? ` · ${miles.toFixed(1)} mi` : ''}</small>
          </span>
          <span className="rm-price">{formatCents(basket.knownSubtotalCents, currency)}</span>
        </button>
        {open && <>
          {basket.items.map(line => <ProductLine key={line.itemId} line={line} name={nameOf(line.itemId)} currency={currency} />)}
          {basket.missingItemIds?.map(id => <p key={id} className="rm-missing">No Kroger match for {nameOf(id)}</p>)}
          <button type="button" className="rm-btn" onClick={() => onShop?.(basket.storeName)}>Shop here</button>
        </>}
      </section>;
    })}
    <p className="rm-help rm-fee">{feeStatus || 'Tax, discounts, and delivery may change the final total. These are Kroger-family shelf prices, not a quote from every Seattle chain.'}</p>
  </div>;
}

function ProductLine({ line, name, currency }) {
  const [imageFailed, setImageFailed] = useState(false);
  const title = line.productName || line.description || name;
  const hasImage = line.imageUrl?.startsWith('https://') && !imageFailed;
  return <article className="rm-product">
    {hasImage ? <img className="rm-product-image" src={line.imageUrl} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <span className="rm-product-image rm-product-placeholder" aria-hidden="true">Item</span>}
    <div className="rm-product-copy"><strong>{title}</strong>
      <small>{[line.brand, line.productSize].filter(Boolean).join(' · ') || name}</small>
      <small>{line.packagesNeeded} × {line.packageSize.quantity} {line.packageSize.unit} · {stockLabel(line.stockLevel)}{line.aisle ? ` · aisle ${line.aisle}` : ''}</small>
    </div>
    <span className="rm-price">{formatCents(line.pricePerPackageCents, currency)}<small> / pack</small>{line.onSale && Number.isInteger(line.regularPriceCents) && <small className="rm-was">{formatCents(line.regularPriceCents, currency)}</small>}</span>
  </article>;
}
