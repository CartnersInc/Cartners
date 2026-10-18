// PROPOSAL (#8): Payments and Your profile tabs. Shown in the dev server, hidden in production
// builds unless VITE_PAYMENTS_PROPOSAL=1. Nothing here writes to the backend.
export const PAYMENTS_PROPOSAL = import.meta.env?.DEV || import.meta.env?.VITE_PAYMENTS_PROPOSAL === '1';

// Members save usernames, never URLs. The app builds links only to these known HTTPS hosts.
export const PAY_APPS = [
  { key: 'venmo', label: 'Venmo', field: 'Venmo username', placeholder: 'sam-k', pattern: /^[A-Za-z0-9_-]{5,30}$/, hint: '5–30 letters, numbers, - or _' },
  { key: 'cashapp', label: 'Cash App', field: 'Cash App $cashtag', placeholder: '$samk', pattern: /^[A-Za-z][A-Za-z0-9]{0,19}$/, hint: 'Starts with a letter, up to 20 characters' },
  { key: 'paypal', label: 'PayPal', field: 'PayPal.me name', placeholder: 'samk', pattern: /^[A-Za-z0-9]{1,20}$/, hint: 'Letters and numbers, up to 20' },
  { key: 'zelle', label: 'Zelle', field: 'Zelle email or phone', placeholder: 'sam@example.com', pattern: /^([^\s@]+@[^\s@]+\.[^\s@]+|\+?[0-9 ()-]{7,20})$/, hint: 'An email or phone number' },
];

export const cleanHandle = (key, value) => String(value || '').trim().replace(key === 'cashapp' ? /^\$/ : /^@/, '');

export function isValidHandle(key, value) {
  const app = PAY_APPS.find(a => a.key === key);
  return !!app && app.pattern.test(cleanHandle(key, value));
}

// Returns { href, label } for apps with a profile link, or { copy } for Zelle. Cash App and PayPal.me
// links carry the amount; Venmo profile links don't reliably, so the amount is copied separately.
export function payLink(key, handle, cents) {
  if (!isValidHandle(key, handle)) return null;
  const name = encodeURIComponent(cleanHandle(key, handle));
  const amount = Number.isInteger(cents) ? (cents / 100).toFixed(2) : null;
  if (key === 'venmo') return { href: `https://venmo.com/u/${name}`, label: `Venmo @${cleanHandle(key, handle)}` };
  if (key === 'paypal') return { href: `https://paypal.me/${name}${amount ? `/${amount}` : ''}`, label: `PayPal.me/${cleanHandle(key, handle)}` };
  if (key === 'cashapp') return { href: `https://cash.app/$${name}${amount ? `/${amount}` : ''}`, label: `Cash App $${cleanHandle(key, handle)}` };
  if (key === 'zelle') return { copy: cleanHandle(key, handle), label: `Zelle ${cleanHandle(key, handle)}` };
  return null;
}

// Only apps the member actually saved. Invalid or empty handles are omitted — never invented.
export function memberPayApps(payLinks, cents) {
  if (!payLinks || typeof payLinks !== 'object') return [];
  return PAY_APPS.flatMap(app => {
    const link = payLink(app.key, payLinks[app.key], cents);
    return link ? [{ app, link }] : [];
  });
}

export function actorPayLinks(workspace, actorId) {
  return workspace?.actors?.find(actor => actor.id === actorId)?.payLinks;
}
