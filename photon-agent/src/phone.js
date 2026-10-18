// iMessage senders arrive as +E.164, 10-digit, tel:, or chat handles. Match them all.

export function phoneKeys(raw) {
  const text = String(raw || '').trim().toLowerCase();
  const keys = new Set();
  if (!text) return keys;
  keys.add(text);
  const stripped = text.replace(/^(?:tel|sms|imessage):/, '');
  keys.add(stripped);
  const digits = stripped.replace(/\D/g, '');
  if (!digits) return keys;
  keys.add(digits);
  keys.add(`+${digits}`);
  let national = digits;
  if (digits.length === 11 && digits.startsWith('1')) national = digits.slice(1);
  if (national.length === 10) {
    keys.add(national);
    keys.add(`1${national}`);
    keys.add(`+1${national}`);
  }
  return keys;
}

export function expandPhoneSet(values) {
  const next = new Set();
  for (const value of values) for (const key of phoneKeys(value)) next.add(key);
  return next;
}

export function expandPhoneMap(entries) {
  const next = new Map();
  for (const [sender, id] of entries) {
    for (const key of phoneKeys(sender)) next.set(key, id);
  }
  return next;
}

export function matchPhoneSet(set, raw) {
  if (!set?.size) return true;
  for (const key of phoneKeys(raw)) if (set.has(key)) return true;
  return false;
}

export function matchPhoneMap(map, raw) {
  if (!map?.size || !raw) return null;
  for (const key of phoneKeys(raw)) {
    if (map.has(key)) return map.get(key);
  }
  return null;
}
