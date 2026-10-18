export const STORE_SUGGESTIONS = ["QFC", "Trader Joe's", "Safeway", "Costco", "Target"];
export const WINDOW_OPTIONS = [
  { value: 0, label: "no wait, I'm leaving now" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
];

export function memberName(members, id, me) {
  if (id === me) return "You";
  return members.find((m) => m.id === id)?.name ?? "Someone";
}

// "your" or "Sam's"
export function possessive(members, id, me) {
  if (id === me) return "your";
  return `${members.find((m) => m.id === id)?.name ?? "Someone"}'s`;
}

export function clock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function dateOf(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// Is the trip still taking requests, according to the server's clock?
export function runIsOpen(run, serverNowMs) {
  return !!run && serverNowMs < Date.parse(run.closes_at);
}
