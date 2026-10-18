import { timeOf } from "../list/helpers.js";

const STALE_MS = 10000;

// Live, stale, or offline, plus how many saves are in flight.
export default function SyncStatus({ hasData, error, lastOkAt, now, pendingCount, onRetry }) {
  let kind = "live";
  let text = "Up to date";
  if (error?.offline) {
    kind = "offline";
    text = hasData
      ? `Offline. Showing the list as of ${timeOf(new Date(lastOkAt).toISOString())}. Changes can't be saved until you're back online.`
      : "Offline. Can't load the list until you're back online.";
  } else if (error) {
    kind = "offline";
    text = `Couldn't refresh: ${error.message}`;
  } else if (lastOkAt && now - lastOkAt > STALE_MS) {
    kind = "stale";
    text = `Last updated ${Math.round((now - lastOkAt) / 1000)} seconds ago. Reconnecting…`;
  } else if (!lastOkAt) {
    kind = "stale";
    text = "Loading…";
  }

  return (
    <div className={`ap-sync ap-sync-${kind}`} role="status">
      <span className="ap-sync-dot" aria-hidden="true" />
      <span className="ap-sync-text">{text}</span>
      {pendingCount > 0 && <span className="ap-sync-pending">Saving {pendingCount} change{pendingCount === 1 ? "" : "s"}…</span>}
      {kind === "offline" && <button type="button" className="ap-link" onClick={onRetry}>Retry now</button>}
    </div>
  );
}
