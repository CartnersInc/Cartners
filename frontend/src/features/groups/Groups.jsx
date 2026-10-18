import { useId, useState } from 'react';
import TripPanel from './parts/TripPanel.jsx';
import RunBanner from './parts/RunBanner.jsx';
import { useWrite } from '../shopping/lib/useWrite.js';
import { people, spendingModeOf, useServerNow } from '../shopping/lib/format.js';
import { activeTrip } from '../shopping/lib/trip.js';
import '../shopping/roomie.css';

// Groups (#9): who is in this group, the active shopper and countdown, the store-run sheet,
// and the group's Pooled/Split spending preference. The shell's group menu does the switching.
export default function Groups({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected }) {
  const serverNowMs = useServerNow(workspace.serverNow);
  const { members, group } = people(workspace, actorId);
  const trip = activeTrip(workspace);
  const others = (workspace.groups || []).filter(g => g.workspaceId !== workspace.workspaceId);
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, notify };

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Groups</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Sample preview</span>}
      </div>
      <p className="rm-intro">Everything here belongs to {group?.name || 'this group'}. Lists, runs and spending never mix between groups.</p>

      <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={() => navigate('shopping')} addLabel="Open the cart" />

      <div className="rm-columns">
        <div className="rm-main">
          <section className="rm-card" aria-labelledby="rm-members">
            <h2 id="rm-members" className="rm-h2">{group?.name || 'This group'}</h2>
            <ul className="rm-members">
              {members.map(member => (
                <li key={member.id}>
                  <span className="avatar" aria-hidden="true">{member.name[0]}</span>
                  <span>{member.name}{member.id === actorId ? ' (you)' : ''}</span>
                  {trip?.claimedBy === member.id && <span className="rm-badge rm-badge-new">Shopping now</span>}
                </li>
              ))}
            </ul>
          </section>

          <SpendingStyle {...shared} />

          <section className="rm-card" aria-labelledby="rm-other-groups">
            <h2 id="rm-other-groups" className="rm-h2">Your other groups</h2>
            {others.length ? (
              <>
                <ul className="rm-plain">{others.map(g => <li key={g.workspaceId}><strong>{g.name}</strong>{g.spendingMode ? ` · ${g.spendingMode === 'pooled' ? 'Pooled' : 'Split'} spending` : ''}</li>)}</ul>
                <p className="rm-help">Switch groups with the group menu at the top.{!connected && ' Switching needs the backend.'}</p>
              </>
            ) : <p className="rm-help">You're only in this group.</p>}
          </section>
        </div>
        <div className="rm-side">
          <TripPanel {...shared} serverNowMs={serverNowMs} />
        </div>
      </div>
    </div>
  );
}

function SpendingStyle({ workspace, actorId, api, onWorkspaceChange, connected, notify }) {
  const current = spendingModeOf(workspace);
  const [choice, setChoice] = useState(null); // null follows the server's current value
  const mode = choice ?? current;
  const setMode = setChoice;
  const write = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const labelId = useId();

  async function save(event) {
    event.preventDefault();
    const result = await write.send('/api/preferences', 'PATCH', { spendingMode: mode });
    if (result) { notify?.(result.changeSummary || `Spending is now ${mode === 'pooled' ? 'pooled' : 'split'} for this group.`); setChoice(null); write.reset(); }
  }

  return (
    <form className="rm-card" onSubmit={save} aria-labelledby={labelId}>
      <h2 id={labelId} className="rm-h2">How this group pays</h2>
      <fieldset className="rm-fieldset" disabled={write.locked || !connected}>
        <legend className="sr-only">Spending style</legend>
        <div className="rm-seg rm-seg-wide">
          <label><input type="radio" name="rm-spending-mode" checked={mode === 'pooled'} onChange={() => setMode('pooled')} /><span>Pooled</span></label>
          <label><input type="radio" name="rm-spending-mode" checked={mode === 'split'} onChange={() => setMode('split')} /><span>Split</span></label>
        </div>
      </fieldset>
      <p className="rm-help">{mode === 'pooled' ? 'Pooled: receipts show who paid. Nobody owes anyone, like a family budget.' : 'Split: each receipt is shared among chosen people, with personal items assigned to their owner.'}</p>
      {write.state.phase === 'error' && <p className="rm-error" role="alert">{write.state.error}</p>}
      <div className="rm-actions">
        <button type="submit" className="rm-btn" disabled={!connected || write.saving || (mode === current && !write.state.retryable)}>{write.saving ? 'Saving…' : write.state.retryable ? 'Try again' : 'Save'}</button>
        {mode !== current && !write.saving && <button type="button" className="rm-btn rm-secondary" onClick={() => { setChoice(null); write.reset(); }}>Cancel</button>}
      </div>
      {!connected && <p className="rm-help">Preview only. Connect the backend to change this.</p>}
    </form>
  );
}
