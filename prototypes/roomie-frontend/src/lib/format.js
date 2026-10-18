// Display helpers only. Nothing here calculates who owes what.

export function formatCents(cents) {
  if (cents == null) return "Unknown";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// Turns what someone typed ("12.5", "$12.50") into whole cents, or null if it isn't a valid amount.
export function parseDollarsToCents(text) {
  const cleaned = String(text ?? "").trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Only member-provided HTTPS links on known Venmo/PayPal hosts are shown. Nothing is guessed.
const ALLOWED_HOSTS = {
  venmo: ["venmo.com", "www.venmo.com", "account.venmo.com"],
  paypal: ["paypal.me", "www.paypal.me", "paypal.com", "www.paypal.com"],
};
export const PAY_APP_NAMES = { venmo: "Venmo", paypal: "PayPal" };

export function safeProfileLink(kind, url) {
  if (!url || !ALLOWED_HOSTS[kind]) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !ALLOWED_HOSTS[kind].includes(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
