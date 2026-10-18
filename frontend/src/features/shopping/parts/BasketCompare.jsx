import { useId, useState } from 'react';
import samplePricing from '../../../../../docs/fixtures/pricing.json';
import { formatCents, whenOf } from '../lib/format.js';

const ZIP_KEY = 'roomie:compareZip';
const readZip = () => { try { return localStorage.getItem(ZIP_KEY) || ''; } catch { return ''; } };
const SOURCE_LABEL = { live_api: 'Live prices', sample: 'Sample prices', unavailable: 'Prices unavailable' };

function pricesFromResult(result) {
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

// Nearby basket comparison (#4). The server/provider ranks baskets and calculates package
// costs; this only displays them. Offline, it shows the checked-in sample under a Sample label.
// Chosen basket line totals are also passed up so cart rows can show price beside Bought.
export default function BasketCompare({ workspace, actorId, api, connected, items, onPrices }) {
  const [zip, setZip] = useState(readZip);
  const [selected, setSelected] = useState(() => new Set(items.map(item => item.id)));
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ phase: 'idle', error: '' });
  const [perItem, setPerItem] = useState(false);
  const zipId = useId();
  const nameOf = id => (workspace.items || []).find(item => item.id === id)?.name || 'A request';

  function toggle(id) {
    setSelected(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function applyResult(next) {
    setResult(next);
    onPrices?.(pricesFromResult(next));
  }

  async function compare(event) {
    event.preventDefault();
    const postalCode = zip.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/.test(postalCode)) { setState({ phase: 'error', error: 'Enter a ZIP or postal code.' }); return; }
    try { localStorage.setItem(ZIP_KEY, postalCode); } catch { /* Remembering the ZIP is only a convenience. */ }
    if (!connected) { applyResult(samplePricing); setState({ phase: 'idle', error: '' }); return; }
    setState({ phase: 'loading', error: '' });
    try {
      const response = await api.request('/api/baskets/compare', { method: 'POST', body: { workspaceId: workspace.workspaceId, actorId, requestId: crypto.randomUUID(), itemIds: [...selected], postalCode } });
      applyResult(response); setState({ phase: 'idle', error: '' });
    } catch (err) {
      setState({ phase: 'error', error: err.message || 'Price comparison failed.' });
    }
  }

  const baskets = result?.baskets || [];
  const complete = baskets.filter(basket => basket.complete);
  const incomplete = baskets.filter(basket => !basket.complete);
  const best = complete.find(basket => basket.id === result?.cheapestCompleteBasketId);

  return (
    <details className="rm-card rm-compare">
      <summary className="rm-h2">Compare nearby baskets</summary>
      <form onSubmit={compare} noValidate className="rm-compare-form">
        <div className="rm-add-row">
          <div className="rm-field">
            <label htmlFor={zipId}>ZIP or postal code</label>
            <input id={zipId} value={zip} maxLength={10} autoComplete="postal-code" inputMode="text" placeholder="98105" onChange={e => setZip(e.target.value)} />
          </div>
          <div className="rm-actions rm-end">
            <button type="submit" className="rm-btn" disabled={state.phase === 'loading' || (connected && !selected.size)}>{state.phase === 'loading' ? 'Checking…' : connected ? 'Compare prices' : 'Show sample comparison'}</button>
          </div>
        </div>
        {connected && items.length > 0 && (
          <fieldset className="rm-fieldset rm-checks">
            <legend className="rm-label">Requests to price</legend>
            {items.map(item => <label key={item.id} className="rm-check"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /><span>{item.name}</span></label>)}
          </fieldset>
        )}
        {!connected && <p className="rm-help">The backend isn't connected, so this shows the checked-in sample for two requests. It is not a store quote.</p>}
      </form>
      {state.phase === 'error' && <p className="rm-error" role="alert">{state.error}</p>}

      {result && (
        <div className="rm-compare-result" aria-live="polite">
          <p className="rm-compare-source">
            <span className={`rm-pill ${result.sourceMode === 'live_api' ? 'rm-pill-live' : 'rm-pill-sample'}`}>{SOURCE_LABEL[result.sourceMode] || 'Unverified prices'}</span>
            {result.checkedAt && <span>Checked {whenOf(result.checkedAt)}</span>}
            {result.currency && <span>{result.currency}</span>}
          </p>
          {result.sampleNotice && <p className="rm-help">{result.sampleNotice}</p>}
          {result.sourceMode === 'unavailable' && <p className="rm-help">No authorized price source answered. Your list still works without it.</p>}

          {complete.length > 0 && (
            <>
              <h3 className="rm-h3">Complete baskets</h3>
              <ul className="rm-baskets">
                {complete.map(basket => <Basket key={basket.id} basket={basket} best={basket.id === best?.id} nameOf={nameOf} currency={result.currency} />)}
              </ul>
            </>
          )}
          {incomplete.length > 0 && (
            <>
              <h3 className="rm-h3">Incomplete baskets <span className="rm-help">(can't be ranked)</span></h3>
              <ul className="rm-baskets">
                {incomplete.map(basket => <Basket key={basket.id} basket={basket} nameOf={nameOf} currency={result.currency} />)}
              </ul>
            </>
          )}
          <p className="rm-help rm-fee">{result.feeStatus || 'Fees, tax and delivery are not included; final totals are unverified.'}</p>

          {result.perItemCheapest?.length > 0 && (
            <div>
              <button type="button" className="rm-link" aria-expanded={perItem} onClick={() => setPerItem(v => !v)}>{perItem ? 'Hide cheapest per item' : 'Show cheapest per item'}</button>
              {perItem && (
                <>
                  <ul className="rm-plain">
                    {result.perItemCheapest.map(entry => (
                      <li key={entry.itemId}>{nameOf(entry.itemId)}: {formatCents(entry.lineTotalCents, result.currency)} at {baskets.find(b => b.id === entry.basketId)?.storeName || 'another store'}</li>
                    ))}
                  </ul>
                  <p className="rm-help">Buying each item at a different store can mean extra stops and fees that erase the savings.</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </details>
  );
}

function LinePhoto({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url?.startsWith('https://') || failed) return null;
  return <img className="rm-basket-photo" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function Basket({ basket, best, nameOf, currency }) {
  return (
    <li className={`rm-basket ${best ? 'rm-basket-best' : ''}`}>
      <div className="rm-basket-head">
        <strong>{basket.storeName}</strong>
        {Number.isFinite(basket.distanceKm) && <span className="rm-help">{basket.distanceKm} km</span>}
        {best && <span className="rm-pill rm-pill-best">Lowest complete basket checked</span>}
        <span className="rm-price">{formatCents(basket.knownSubtotalCents, currency)}{basket.complete ? '' : ' known'}</span>
      </div>
      <ul className="rm-plain">
        {basket.items.map(line => (
          <li key={line.itemId} className="rm-basket-line">
            <LinePhoto url={line.imageUrl} />
            <span>{nameOf(line.itemId)}: {line.packagesNeeded} × {line.packageSize.unit === 'pack' ? `${line.packageSize.quantity} pack` : `${line.packageSize.quantity} ${line.packageSize.unit} pack`} at {formatCents(line.pricePerPackageCents, currency)} = {formatCents(line.lineTotalCents, currency)}</span>
          </li>
        ))}
        {basket.missingItemIds?.map(id => <li key={id} className="rm-missing">Missing: {nameOf(id)}</li>)}
      </ul>
      <p className="rm-help">Tax {Number.isInteger(basket.taxCents) ? formatCents(basket.taxCents, currency) : 'not included'} · delivery {Number.isInteger(basket.deliveryFeeCents) ? formatCents(basket.deliveryFeeCents, currency) : 'not included'}</p>
    </li>
  );
}
