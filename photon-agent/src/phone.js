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

export function photonAgentName(sender, users = []) {
  const keys = phoneKeys(sender);
  const match = users.find((user) => [...phoneKeys(user.phoneNumber)].some((key) => keys.has(key)));
  const fromPhoton = [match?.firstName, match?.lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
  if (fromPhoton) return fromPhoton.slice(0, 60);
  const national = [...keys].find((key) => /^\d{10}$/.test(key));
  return national ? `Photon ${national.slice(-4)}` : 'Photon';
}

export function matchPhoneMap(map, raw) {
  if (!map?.size || !raw) return null;
  for (const key of phoneKeys(raw)) {
    if (map.has(key)) return map.get(key);
  }
  return null;
}
