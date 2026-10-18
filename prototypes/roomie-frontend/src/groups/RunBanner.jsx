import { clock, memberName, runIsOpen, timeOf } from "../list/helpers.js";

// In-app banner for everyone except the shopper. It comes from the polled snapshot,
// so it appears in any open browser, and the countdown uses the server's closes_at.
export default function RunBanner({ snapshot, me, serverNowMs, onAdd }) {
  const run = snapshot?.run;
  if (!run || run.shopper_id === me) return null;
  const who = memberName(snapshot.members, run.shopper_id, me);
  const open = runIsOpen(run, serverNowMs);

  return (
    <div className={`ap-banner ${open ? "" : "ap-banner-quiet"}`} role="region" aria-label="Store run">
      <div className="ap-banner-text">
        {open ? (
          <>
            <strong>{who} is going to {run.store}. Want anything?</strong>
            <span>Add it in the next <span className="ap-banner-clock">{clock(Date.parse(run.closes_at) - serverNowMs)}</span>.</span>
          </>
        ) : (
          <>
            <strong>{who} is shopping at {run.store}.</strong>
            <span>{run.window_minutes ? `Requests closed at ${timeOf(run.closes_at)}.` : "This trip didn't take requests."} New items wait for the next trip.</span>
          </>
        )}
      </div>
      <button type="button" className="ap-btn ap-small ap-banner-btn" onClick={onAdd}>
        {open ? "Add an item" : "Add for next time"}
      </button>
    </div>
  );
}
