import { useRef } from "react";
import AddItemForm from "./AddItemForm.jsx";
import ItemRow from "./ItemRow.jsx";
import RunPanel from "./RunPanel.jsx";
import { possessive, runIsOpen } from "./helpers.js";

const byCreated = (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at);
const RECENT_MS = 36 * 3600e3;

// The shared list, grouped by where each item stands relative to the current trip.
export default function ListPage({ groupId, snapshot, me, serverNowMs, onChanged, addNameRef }) {
  const startRef = useRef(null);
  const finishRef = useRef(null);
  const { items, members, run } = snapshot;
  const isShopper = run?.shopper_id === me;
  const open = runIsOpen(run, serverNowMs);

  const onTrip = run ? items.filter((i) => i.run_id === run.id).sort((a, b) => (a.status === b.status ? byCreated(a, b) : a.status === "open" ? -1 : 1)) : [];
  const waiting = items.filter((i) => i.status === "open" && (!run || i.run_id !== run.id)).sort(byCreated);
  const recentlyBought = items
    .filter((i) => i.status === "bought" && (!run || i.run_id !== run.id) && serverNowMs - Date.parse(i.bought_at) < RECENT_MS)
    .sort((a, b) => Date.parse(b.bought_at) - Date.parse(a.bought_at));

  // Requests made after the trip was claimed are marked so the shopper notices them.
  const badgeFor = (item) => {
    if (item.punted && item.status === "open") {
      return item.punted.run_id === run?.id
        ? { kind: "punted", text: `Not at ${item.punted.store}, moved to the next trip` }
        : { kind: "punted", text: `Not found at ${item.punted.store} last time` };
    }
    if (!run) return null;
    const afterStart = Date.parse(item.created_at) > Date.parse(run.started_at);
    if (item.run_id === run.id && afterStart) return { kind: "new", text: isShopper ? "New since you started" : "Added after the trip started" };
    if (item.run_id !== run.id && item.status === "open" && afterStart) return { kind: "next", text: "Added after requests closed" };
    return null;
  };

  const row = (item) => (
    <ItemRow key={item.id} item={item} groupId={groupId} members={members} me={me} run={run} badge={badgeFor(item)} onChanged={onChanged} />
  );

  const newOnTrip = onTrip.filter((i) => badgeFor(i)?.kind === "new" && i.status === "open").length;

  return (
    <div className="ap-list-page">
      <RunPanel {...{ groupId, snapshot, me, serverNowMs, onChanged, startRef, finishRef }} />

      <AddItemForm groupId={groupId} snapshot={snapshot} me={me} serverNowMs={serverNowMs} onSaved={onChanged} nameRef={addNameRef} />

      {run && (
        <section aria-labelledby="ap-trip-items">
          <h2 id="ap-trip-items" className="ap-h2 ap-section">
            On {possessive(members, run.shopper_id, me)} trip to {run.store}
            {isShopper && newOnTrip > 0 && <span className="ap-badge ap-badge-new">{newOnTrip} new</span>}
          </h2>
          {onTrip.length ? <ul className="ap-items">{onTrip.map(row)}</ul> : <p className="ap-empty">Nothing on this trip yet.{open ? " Roommates can still add items." : ""}</p>}
        </section>
      )}

      <section aria-labelledby="ap-waiting">
        <h2 id="ap-waiting" className="ap-h2 ap-section">{run ? "For the next trip" : "Needed"}</h2>
        {waiting.length
          ? <ul className="ap-items">{waiting.map(row)}</ul>
          : <p className="ap-empty">{run ? "Nothing is waiting for the next trip." : "The list is empty. Add what the group needs."}</p>}
      </section>

      {recentlyBought.length > 0 && (
        <details className="ap-recent">
          <summary>Bought recently ({recentlyBought.length})</summary>
          <ul className="ap-items">{recentlyBought.map(row)}</ul>
        </details>
      )}

      {/* Phone dock: the trip action stays reachable without scrolling back up. */}
      <div className="ap-dock">
        {!run && (
          <button type="button" className="ap-btn" onClick={() => { startRef.current?.scrollIntoView({ block: "center" }); startRef.current?.focus(); }}>
            Start a trip
          </button>
        )}
        {run && isShopper && (
          <button type="button" className="ap-btn" onClick={() => { finishRef.current?.scrollIntoView({ block: "center" }); finishRef.current?.click(); }}>
            Finish trip ({onTrip.filter((i) => i.status === "bought").length} of {onTrip.length} bought)
          </button>
        )}
        {run && !isShopper && (
          <button type="button" className="ap-btn ap-secondary" onClick={() => { addNameRef.current?.scrollIntoView({ block: "center" }); addNameRef.current?.focus(); }}>
            {open ? `Add to ${possessive(members, run.shopper_id, me)} trip` : "Add for the next trip"}
          </button>
        )}
      </div>
    </div>
  );
}
