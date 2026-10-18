import { clock, people, timeOf } from '../../shopping/lib/format.js';
import { acceptingRequests, activeTrip } from '../../shopping/lib/trip.js';

// In-app announcement for everyone except the shopper. It comes from the shell's polled
// snapshot, so every open page sees it; the countdown uses the server's requestDeadlineAt.
export default function RunBanner({ workspace, actorId, serverNowMs, onAdd, addLabel }) {
  const trip = activeTrip(workspace);
  if (!trip || trip.claimedBy === actorId) return null;
  const { name } = people(workspace, actorId);
  const open = acceptingRequests(trip, serverNowMs);
  return (
    <div className={`rm-banner ${open ? '' : 'rm-banner-quiet'}`} role="region" aria-label="Store run">
      <div className="rm-banner-text">
        {open ? (
          <>
            <strong>{name(trip.claimedBy)} is going to the store. Want anything?</strong>
            <span><span className="rm-banner-clock">{clock(Date.parse(trip.requestDeadlineAt) - serverNowMs)}</span> left · {trip.storeName}</span>
          </>
        ) : (
          <>
            <strong>{name(trip.claimedBy)} is shopping at {trip.storeName}.</strong>
            <span>Requests closed{trip.requestDeadlineAt ? ` at ${timeOf(trip.requestDeadlineAt)}` : ''}. New requests wait for the next run.</span>
          </>
        )}
      </div>
      {onAdd && <button type="button" className="rm-btn rm-small rm-banner-btn" onClick={onAdd}>{addLabel || (open ? 'Add a request' : 'Add for next run')}</button>}
    </div>
  );
}
