import { useId, useState } from "react";
import { api } from "../lib/api.js";
import { useIdempotentWrite } from "../lib/useIdempotentWrite.js";
import { clock, memberName, possessive, runIsOpen, STORE_SUGGESTIONS, timeOf, WINDOW_OPTIONS } from "./helpers.js";

// The one trip action. With no trip, it starts one ("I'm going to [store]. Want
// anything in the next [10] minutes?"), which claims every unbought request. During a
// trip it shows who's shopping and, for the shopper, Finish trip.
export default function RunPanel({ groupId, snapshot, me, serverNowMs, onChanged, startRef, finishRef }) {
  const [notice, setNotice] = useState(null); // survives switching between start and active views

  return (
    <section className="ap-card ap-run" aria-labelledby="ap-run-title">
      {notice && (
        <div className={`ap-notice ap-notice-${notice.kind}`} role={notice.kind === "warn" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <button type="button" className="ap-link" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
      {snapshot.run
        ? <ActiveTrip {...{ groupId, snapshot, me, serverNowMs, onChanged, setNotice, finishRef }} />
        : <StartTrip {...{ groupId, snapshot, me, onChanged, setNotice, startRef }} />}
    </section>
  );
}

function StartTrip({ groupId, snapshot, me, onChanged, setNotice, startRef }) {
  const [store, setStore] = useState(snapshot.last_store || "");
  const [windowMinutes, setWindowMinutes] = useState(10);
  const [missingStore, setMissingStore] = useState(false);
  const write = useIdempotentWrite();
  const storeId = useId();
  const windowId = useId();
  const claimable = snapshot.items.filter((i) => i.status === "open" && !i.run_id).length;

  async function start(e) {
    e.preventDefault();
    if (!store.trim()) { setMissingStore(true); startRef.current?.focus(); return; }
    setMissingStore(false);
    const result = await write.submit((p, key) => api.startRun(groupId, p, key), { store: store.trim(), window_minutes: windowMinutes });
    if (result) {
      const { run, claimed_count: claimed } = result.data;
      setNotice({
        kind: "ok",
        text: `Trip started. You claimed ${claimed} item${claimed === 1 ? "" : "s"}${run.window_minutes ? `, and roommates can add more for ${run.window_minutes} minutes` : ""}.`,
      });
      write.reset();
    } else {
      // A losing start (409) tells us who actually owns the trip. Never replace them.
      const err = write.getLastError();
      const owner = err?.status === 409 && err.data?.run;
      if (owner) {
        const name = memberName(snapshot.members, owner.shopper_id, me);
        setNotice({
          kind: "warn",
          text: `${name} started a trip to ${owner.store} at ${timeOf(owner.started_at)}, just before you. Your trip wasn't started, and the list is on ${name === "You" ? "your" : name + "'s"} trip.`,
        });
        write.reset();
      }
    }
    onChanged();
  }

  return (
    <form onSubmit={start} noValidate>
      <h2 id="ap-run-title" className="ap-h2">Going shopping?</h2>
      <fieldset disabled={write.locked} className="ap-fieldset">
        <p className="ap-sentence">
          <label htmlFor={storeId}>I'm going to</label>{" "}
          <input
            id={storeId}
            ref={startRef}
            className="ap-inline-input"
            value={store}
            list="ap-run-stores"
            placeholder="store"
            maxLength={40}
            aria-invalid={missingStore}
            onChange={(e) => setStore(e.target.value)}
          />
          .{" "}
          <label htmlFor={windowId}>Want anything in the next</label>{" "}
          <select id={windowId} className="ap-inline-select" value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))}>
            {WINDOW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          ?
        </p>
        <datalist id="ap-run-stores">{STORE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </fieldset>
      {missingStore && <p className="ap-error" role="alert">Where are you going? Type a store.</p>}
      {write.state.phase === "error" && !write.state.conflict && <div className="ap-error" role="alert"><p>{write.state.error}</p></div>}
      <p className="ap-help">
        {claimable
          ? `Starting the trip claims the ${claimable} item${claimable === 1 ? "" : "s"} still needed.`
          : "Nothing is on the list yet. Roommates can still add items during the request window."}
      </p>
      <div className="ap-actions">
        <button type="submit" className="ap-btn" disabled={write.state.phase === "saving"}>
          {write.state.phase === "saving" ? "Starting…" : write.state.retryable ? "Try again" : "Start trip"}
        </button>
        {write.state.retryable && <button type="button" className="ap-btn ap-secondary" onClick={() => { write.reset(); onChanged(); }}>Discard</button>}
      </div>
    </form>
  );
}

function ActiveTrip({ groupId, snapshot, me, serverNowMs, onChanged, setNotice, finishRef }) {
  const [confirming, setConfirming] = useState(false);
  const write = useIdempotentWrite();
  const run = snapshot.run;
  const isShopper = run.shopper_id === me;
  const shopper = memberName(snapshot.members, run.shopper_id, me);
  const tripItems = snapshot.items.filter((i) => i.run_id === run.id);
  const bought = tripItems.filter((i) => i.status === "bought").length;
  const unchecked = tripItems.length - bought;
  const punted = snapshot.items.filter((i) => i.status === "open" && i.punted?.run_id === run.id).length;
  const puntedText = punted ? ` ${punted} item${punted === 1 ? " this store didn't have is" : "s this store didn't have are"} already waiting for the next trip.` : "";
  const open = runIsOpen(run, serverNowMs);

  async function finish() {
    const result = await write.submit((p, key) => api.finishRun(groupId, run.id, p, key), {});
    if (result) {
      const kept = result.data.kept_count;
      setNotice({ kind: "ok", text: `Trip finished. ${kept ? `${kept} unchecked item${kept === 1 ? "" : "s"} stay on the list for the next trip.` : punted ? "Everything else was bought." : "Everything was bought."}${puntedText}` });
    }
    onChanged();
  }

  return (
    <div>
      <h2 id="ap-run-title" className="ap-h2">{isShopper ? `You're shopping at ${run.store}` : `${shopper} is shopping at ${run.store}`}</h2>
      <p className="ap-run-time" role="timer">
        {run.window_minutes === 0
          ? `Started ${timeOf(run.started_at)} with no request window. New items wait for the next trip.`
          : open
            ? <>Requests close in <strong>{clock(Date.parse(run.closes_at) - serverNowMs)}</strong>, at {timeOf(run.closes_at)}.</>
            : `Requests closed at ${timeOf(run.closes_at)}. New items wait for the next trip.`}
      </p>
      <div className="ap-progress" aria-hidden="true"><div style={{ width: `${tripItems.length ? (bought / tripItems.length) * 100 : 0}%` }} /></div>
      <p className="ap-help">{bought} of {tripItems.length} bought on this trip.</p>

      {isShopper ? (
        !confirming ? (
          <div className="ap-actions">
            <button type="button" ref={finishRef} className="ap-btn" onClick={() => setConfirming(true)}>Finish trip</button>
          </div>
        ) : (
          <div className="ap-confirm" role="group" aria-label="Confirm finishing the trip">
            <p>
              Finish this trip?{" "}
              {unchecked ? `${unchecked} unchecked item${unchecked === 1 ? "" : "s"} will stay on the list for the next trip.` : "Everything is checked off."}{puntedText}{" "}
              No prices needed.
            </p>
            {write.state.phase === "error" && <div className="ap-error" role="alert"><p>{write.state.error}</p></div>}
            <div className="ap-actions">
              <button type="button" className="ap-btn" onClick={finish} disabled={write.state.phase === "saving"}>
                {write.state.phase === "saving" ? "Finishing…" : write.state.retryable ? "Try again" : "Finish trip"}
              </button>
              <button type="button" className="ap-btn ap-secondary" disabled={write.state.phase === "saving"} onClick={() => { setConfirming(false); write.reset(); }}>
                Keep shopping
              </button>
            </div>
          </div>
        )
      ) : (
        <p className="ap-help">Only {shopper} can finish this trip. You can still add items{open ? " to it" : " for the next trip"} and check off anything you bought.</p>
      )}
      <p className="ap-visually-hidden">{possessive(snapshot.members, run.shopper_id, me)} trip</p>
    </div>
  );
}
