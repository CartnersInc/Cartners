import { useEffect, useMemo, useState } from 'react';

// Display helpers only. Money and list rules come from the server.

export const UNITS = ['count', 'pack', 'can', 'g', 'ml'];
export const WINDOW_MINUTES = [5, 10, 15];

export function formatCents(cents, currency = 'USD') {
  if (!Number.isInteger(cents)) return 'Unknown';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

// "12.5" or "$12.50" → 1250 cents; null if it isn't a valid nonnegative amount.
export function parseDollars(text) {
  const cleaned = String(text ?? '').trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function quantityLabel(item) {
  const quantity = item?.quantity ?? '';
  const unit = item?.unit && item.unit !== 'count' ? ` ${item.unit}` : '';
  return `${quantity}${unit}`;
}

export function clock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export const timeOf = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const whenOf = iso => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// The server's current time, ticking once a second. Countdowns use this and the server's
// requestDeadlineAt, never a timer started in the browser.
export function useServerNow(serverNow) {
  const offset = useMemo(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0), [serverNow]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now + offset;
}

export function people(workspace, actorId) {
  const name = id => (id === actorId ? 'You' : workspace.actors.find(actor => actor.id === id)?.name || 'Someone');
  const possessive = id => (id === actorId ? 'your' : `${name(id)}'s`);
  const group = workspace.groups?.find(g => g.workspaceId === workspace.workspaceId);
  const members = group?.memberIds?.length ? workspace.actors.filter(actor => group.memberIds.includes(actor.id)) : workspace.actors;
  return { name, possessive, members, group };
}

export const scopeLabel = (item, name) => (item.requestFor === 'household' || !item.requestFor ? 'Shared' : `Just ${name(item.requestFor).replace(/^You$/, 'you')}`);

export function spendingModeOf(workspace) {
  return workspace.preferences?.spendingMode || people(workspace).group?.spendingMode || 'split';
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Only member-provided HTTPS links on known Venmo/PayPal hosts are shown. Nothing is guessed.
const PAY_HOSTS = { venmo: ['venmo.com', 'www.venmo.com', 'account.venmo.com'], paypal: ['paypal.me', 'www.paypal.me', 'paypal.com', 'www.paypal.com'] };
export const PAY_NAMES = { venmo: 'Venmo', paypal: 'PayPal' };
export function safePayLink(kind, url) {
  if (!url || !PAY_HOSTS[kind]) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && PAY_HOSTS[kind].includes(parsed.hostname) ? parsed.href : null;
  } catch { return null; }
}
