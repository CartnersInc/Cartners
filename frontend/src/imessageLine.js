export const IMESSAGE_LINE = String(import.meta.env.VITE_CARTNERS_IMESSAGE_LINE || '+14156055508').replace(/\s/g, '');

export function prettyPhone(value = IMESSAGE_LINE) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

export function smsHref(body) {
  return `sms:${IMESSAGE_LINE}?body=${encodeURIComponent(body)}`;
}
