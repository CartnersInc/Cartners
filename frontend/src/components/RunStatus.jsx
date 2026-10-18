import Icon from './Icon.jsx';
import { clock, people, useServerNow } from '../features/shopping/lib/format.js';
import { acceptingRequests, activeTrip } from '../features/shopping/lib/trip.js';

// Compact shell announcement for every page. Groups/Shopping keep their own run controls;
// this chip only points at Shopping so there is not a second place to start or finish a run.
export default function RunStatus({ workspace, actorId, page }) {
  const trip = activeTrip(workspace);
  const serverNowMs = useServerNow(workspace.serverNow);
  if (!trip) return null;
  const { name } = people(workspace, actorId);
  const shopper = name(trip.claimedBy);
  const store = trip.storeName || 'the store';
  const open = acceptingRequests(trip, serverNowMs);
  const heading = trip.claimedBy === actorId ? `You're shopping at ${store}` : `${shopper} is at ${store}`;
  const detail = open
    ? `Requests can still join${trip.requestDeadlineAt ? ` · ${clock(Date.parse(trip.requestDeadlineAt) - serverNowMs)} left` : ''}`
    : 'Wait for next run';
  return (
    <a className={`run-status${open ? '' : ' run-status-closed'}`} href="#shopping" aria-current={page === 'shopping' ? 'page' : undefined} aria-label={`Store run: ${heading}. ${detail}. Open shopping.`}>
      <Icon name="shopping" />
      <span className="run-status-copy">
        <strong>{heading}</strong>
        <span>{detail}</span>
      </span>
    </a>
  );
}
