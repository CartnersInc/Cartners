// Checkout handoff from Shopping → Spending payments (Venmo / Zelle / etc.).

export const CHECKOUT_KEY = 'cartners:checkout';
export const SPENDING_TAB_KEY = 'roomie:spendingTab';

/** Stable sample cents when compare/catalog has no line price yet. */
export function estimateCents(item) {
  const text = `${item?.name || ''}|${item?.unit || ''}|${item?.id || ''}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return 149 + (hash % 851);
}

export function priceForItem(item, priceMap = {}) {
  const known = priceMap[item.id];
  if (known && Number.isInteger(known.cents)) {
    return { cents: known.cents, currency: known.currency || 'USD', estimated: false };
  }
  return { cents: estimateCents(item), currency: 'USD', estimated: true };
}

export function buildCheckout({ workspaceId, actorId, items, priceMap }) {
  const lines = items.map(item => {
    const price = priceForItem(item, priceMap);
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note || '',
      cents: price.cents,
      currency: price.currency,
      estimated: price.estimated,
    };
  });
  const currency = lines[0]?.currency || 'USD';
  const totalCents = lines.reduce((sum, line) => sum + (Number.isInteger(line.cents) ? line.cents : 0), 0);
  return {
    workspaceId,
    actorId,
    createdAt: new Date().toISOString(),
    currency,
    totalCents,
    lines,
  };
}

export function saveCheckout(payload) {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(payload));
    sessionStorage.setItem(SPENDING_TAB_KEY, 'payments');
  } catch { /* Checkout still works in-memory for this navigation if storage is blocked. */ }
}

export function readCheckout() {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.lines)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearCheckout() {
  try { sessionStorage.removeItem(CHECKOUT_KEY); } catch { /* ignore */ }
}
