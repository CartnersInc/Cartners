import { useEffect, useRef, useState } from "react";
import { api } from "./lib/api.js";
import { usePending } from "./lib/pending.jsx";
import { useNow, useSnapshot } from "./lib/useSnapshot.js";
import ListPage from "./list/ListPage.jsx";
import SpendingPage from "./spending/SpendingPage.jsx";
import RunBanner from "./groups/RunBanner.jsx";
import SyncStatus from "./groups/SyncStatus.jsx";
import "./app.css";

const GROUP_KEY = "roomie-group";

export default function App({ me }) {
  const [groups, setGroups] = useState(null);
  const [groupsError, setGroupsError] = useState(null);
  const [groupId, setGroupId] = useState(() => { try { return sessionStorage.getItem(GROUP_KEY); } catch { return null; } });
  const [tab, setTab] = useState("list");
  const [groupsAttempt, setGroupsAttempt] = useState(0);
  const addNameRef = useRef(null);
  const pending = usePending();

  useEffect(() => {
    let live = true;
    setGroupsError(null);
    api.listGroups()
      .then((gs) => {
        if (!live) return;
        setGroups(gs);
        setGroupId((cur) => (gs.some((g) => g.id === cur) ? cur : gs[0]?.id ?? null));
      })
      .catch((e) => live && setGroupsError(e.message));
    return () => { live = false; };
  }, [me, groupsAttempt]);

  useEffect(() => { try { if (groupId) sessionStorage.setItem(GROUP_KEY, groupId); } catch { /* ignore */ } }, [groupId]);

  const snap = useSnapshot(groupId);
  const now = useNow(1000);
  const serverNowMs = now + snap.offsetMs;
  const data = snap.data;
  const groupName = groups?.find((g) => g.id === groupId)?.name;

  function goAdd() {
    setTab("list");
    setTimeout(() => { addNameRef.current?.scrollIntoView({ block: "center" }); addNameRef.current?.focus(); });
  }

  if (!groups) {
    return (
      <div className="ap-app">
        <p className="ap-help">{groupsError ? groupsError : "Loading your groups…"}</p>
        {groupsError && <button type="button" className="ap-btn" onClick={() => setGroupsAttempt((n) => n + 1)}>Try again</button>}
      </div>
    );
  }

  return (
    <div className="ap-app">
      <header className="ap-header">
        <div className="ap-groups" role="group" aria-label="Your groups">
          {groups.map((g) => (
            <button key={g.id} type="button" className="ap-group" aria-pressed={g.id === groupId} onClick={() => setGroupId(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
        <div className="ap-members" aria-label={groupName ? `${groupName} members` : "Members"}>
          {data
            ? data.members.map((m) => (
              <span key={m.id} className={`ap-member ${m.id === me ? "ap-member-me" : ""}`}>{m.name}{m.id === me ? " (you)" : ""}</span>
            ))
            : <span className="ap-help">Loading {groupName || "group"}…</span>}
        </div>
      </header>

      <SyncStatus hasData={!!data} error={snap.error} lastOkAt={snap.lastOkAt} now={now} pendingCount={pending.count} onRetry={snap.refresh} />

      {data && <RunBanner snapshot={data} me={me} serverNowMs={serverNowMs} onAdd={goAdd} />}

      <nav className="ap-tabs" aria-label="Sections">
        <button type="button" className="ap-tab" aria-current={tab === "list" ? "page" : undefined} onClick={() => setTab("list")}>List</button>
        <button type="button" className="ap-tab" aria-current={tab === "spending" ? "page" : undefined} onClick={() => setTab("spending")}>Spending</button>
      </nav>

      {tab === "list" && (
        data
          ? <ListPage key={groupId} groupId={groupId} snapshot={data} me={me} serverNowMs={serverNowMs} onChanged={snap.refresh} addNameRef={addNameRef} />
          : <p className="ap-empty">{snap.error ? snap.error.message : `Loading ${groupName || "the list"}…`}</p>
      )}
      {tab === "spending" && groupId && <SpendingPage key={groupId} groupId={groupId} currentMemberId={me} />}
    </div>
  );
}
