import { useId, useState } from 'react';
import { formatCents, whenOf } from '../lib/format.js';

const ZIP_KEY = 'cartners:price-area';
const readZip = () => { try { return localStorage.getItem(ZIP_KEY) || ''; } catch { return ''; } };
const SOURCE_LABEL = { live_api: 'Live Kroger prices' };
const KROGER_LOGO = `${import.meta.env.BASE_URL}logos/kroger.jpg`;

function pricesFromResult(result) {
  if (!result?.baskets?.length || result.sourceMode !== 'live_api') return {};
  const best = result.baskets.find(basket => basket.id === result.cheapestCompleteBasketId)
    || result.baskets.find(basket => basket.complete);
  return Object.fromEntries((best?.items || [])
    .filter(line => line?.itemId && Number.isInteger(line.lineTotalCents))
    .map(line => [line.itemId, { cents: line.lineTotalCents, currency: result.currency || 'USD' }]));
}

// The price check is optional, visible, and only shows store results returned by the backend.
export default function BasketCompare({ workspace, actorId, api, connected, items, onPrices, onStoreFound }) {
  const [zip, setZip] = useState(readZip);
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ phase: 'idle', error: '' });
  const [locating, setLocating] = useState(false);
  const zipId = useId();
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
        if (zipCode) setZip(zipCode);
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

  async function compare(event) {
    event.preventDefault();
    const postalCode = zip.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(postalCode)) {
      setState({ phase: 'error', error: 'Enter your ZIP or postal code to check nearby stores.' });
      return;
    }
    if (!connected || !items.length) return;
    try { localStorage.setItem(ZIP_KEY, postalCode); } catch { /* A saved area is only a convenience. */ }
    setState({ phase: 'loading', error: '' });
    setResult(null);
    try {
      const response = await api.request('/api/baskets/compare', { method: 'POST', body: {
        workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(),
        itemIds: items.map(item => item.id), postalCode,
      } });
      setResult(response);
      onPrices?.(pricesFromResult(response));
      if (response.sourceMode === 'live_api') {
        const store = response.baskets?.find(basket => basket.storeName)?.storeName;
        if (store) onStoreFound?.(store);
      }
      setState({ phase: 'idle', error: '' });
    } catch (err) {
      setState({ phase: 'error', error: err.message || 'Could not check nearby prices. Your list is still available.' });
    }
  }

  const baskets = result?.sourceMode === 'live_api' ? result.baskets || [] : [];
  const complete = baskets.filter(basket => basket.complete);
  const incomplete = baskets.filter(basket => !basket.complete);
  const best = complete.find(basket => basket.id === result?.cheapestCompleteBasketId);

  return (
    <section className="rm-card rm-compare rm-compare-prominent" aria-labelledby="rm-compare-heading" aria-busy={state.phase === 'loading'}>
      <div className="rm-compare-title">
        <div><h2 className="rm-h2" id="rm-compare-heading">Find your groceries at Kroger</h2><p className="rm-help">Match your list to nearby products, package sizes, and prices.</p></div>
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
      {result?.sourceMode === 'live_api' && <div className="rm-compare-result" aria-live="polite">
        <p className="rm-compare-source"><span className="rm-pill rm-pill-live">{SOURCE_LABEL.live_api}</span>{result.checkedAt && <span>Checked {whenOf(result.checkedAt)}</span>}</p>
        {[...complete, ...incomplete].map(basket => <Basket key={basket.id} basket={basket} best={basket.id === best?.id} nameOf={nameOf} currency={result.currency} />)}
        <p className="rm-help rm-fee">{result.feeStatus || 'Tax, discounts, and delivery may change the final total.'}</p>
      </div>}
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

function Basket({ basket, best, nameOf, currency }) {
  return <section className={`rm-store-result ${best ? 'rm-store-best' : ''}`} aria-label={`${basket.storeName} basket`}>
    <div className="rm-basket-head">
      <strong><img className="rm-store-logo" src={KROGER_LOGO} alt="" />{basket.storeName}</strong>
      {best && <span className="rm-pill rm-pill-best">Lowest complete basket</span>}
      <span className="rm-price">{formatCents(basket.knownSubtotalCents, currency)}<small> estimated</small></span>
    </div>
    {basket.items.map(line => <ProductLine key={line.itemId} line={line} name={nameOf(line.itemId)} currency={currency} />)}
    {basket.missingItemIds?.map(id => <p key={id} className="rm-missing">No Kroger match for {nameOf(id)}</p>)}
  </section>;
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
    <span className="rm-price">{formatCents(line.pricePerPackageCents, currency)}<small> / pack</small></span>
  </article>;
}
