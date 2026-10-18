const KEY = 'cartners:membership';
export function readMembership() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    return value && typeof value.workspaceId === 'string' && typeof value.actorId === 'string' && (value.demo || /^[a-f0-9]{64}$/.test(value.sessionToken)) ? value : null;
  } catch { return null; }
}
export function saveMembership(value) {
  // Do not claim setup succeeded if this browser cannot retain its access key.
  localStorage.setItem(KEY, JSON.stringify(value));
}
export function leaveMembership() { localStorage.removeItem(KEY); }
export function secret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
}
