// Dev harness. Not part of the app itself.
// Pick who this tab is, and simulate offline, failed saves, races, and clock skew.
// Open a second tab with a different person to see shared updates.

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { PendingProvider } from "./lib/pending.jsx";
import { dataSource } from "./lib/api.js";
import { getMemberId, setMemberId } from "./lib/session.js";
import { mockControls, resetMock } from "./mock/mockServer.js";

const PEOPLE = [
  ["m_alex", "Alex"], ["m_sam", "Sam"], ["m_priya", "Priya"], ["m_dana", "Dana"], ["m_leo", "Leo"],
];

function Harness() {
  const [me, setMe] = useState(getMemberId());
  const [controls, setControls] = useState({ ...mockControls });
  const [epoch, setEpoch] = useState(0);

  function setControl(key, value) {
    mockControls[key] = value;
    setControls({ ...mockControls });
  }

  return (
    <>
      <div className="harness" aria-label="Demo controls">
        <label>
          This tab is{" "}
          <select value={me} onChange={(e) => { setMemberId(e.target.value); setMe(e.target.value); }}>
            {PEOPLE.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {dataSource === "fixture" ? (
          <>
            <label><input type="checkbox" checked={controls.offline} onChange={(e) => setControl("offline", e.target.checked)} /> Offline</label>
            <label>
              Next save{" "}
              <select value={controls.failNext || ""} onChange={(e) => setControl("failNext", e.target.value || null)}>
                <option value="">works</option>
                <option value="network">never arrives</option>
                <option value="lost-response">saves, reply lost</option>
              </select>
            </label>
            <label><input type="checkbox" checked={controls.loseNextStart} onChange={(e) => setControl("loseNextStart", e.target.checked)} /> Someone else starts first</label>
            <label>
              Server clock{" "}
              <select value={controls.serverSkewMs} onChange={(e) => setControl("serverSkewMs", Number(e.target.value))}>
                <option value={0}>matches</option>
                <option value={120000}>2 min ahead</option>
              </select>
            </label>
            <button type="button" onClick={() => { resetMock(); setControls({ ...mockControls }); setEpoch((n) => n + 1); }}>Reset sample data</button>
          </>
        ) : <span>Live server</span>}
      </div>
      <PendingProvider>
        <App key={`${me}-${epoch}`} me={me} />
      </PendingProvider>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Harness />
  </StrictMode>
);
