import { useId, useState } from 'react';
import RunBanner from './parts/RunBanner.jsx';
import { useWrite } from '../shopping/lib/useWrite.js';
import { people, spendingModeOf, useServerNow } from '../shopping/lib/format.js';
import { activeTrip } from '../shopping/lib/trip.js';
import '../shopping/roomie.css';
import Preferences from '../plans/Preferences.jsx';

// Groups (#9): who is in this group, the active shopper and countdown, the store-run sheet,
// and the group's Pooled/Split spending preference. The shell's group menu does the switching.
export default function Groups({ workspace, actorId, api, onWorkspaceChange, navigate, notify, connected, membership, onLeave }) {
  const [copied, setCopied] = useState('');
  const [leaving, setLeaving] = useState(false);
  const serverNowMs = useServerNow(workspace.serverNow);
  const { members, group } = people(workspace, actorId);
  const trip = activeTrip(workspace);
  const shared = { workspace, actorId, api, onWorkspaceChange, connected, notify };

  return (
    <div className="rm-page">
      <div className="rm-title-row">
        <h1 className="rm-h1">Your household</h1>
        {!connected && <span className="rm-pill rm-pill-sample">Offline</span>}
      </div>
      <p className="rm-intro">Everything here belongs to {group?.name || 'this group'}. Lists, runs and spending never mix between groups.</p>

      <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={() => navigate('shopping')} addLabel="Open the cart" />

      <div className="household-settings">
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

          <Preferences {...shared} />
          {!membership?.demo && <section className="rm-card"><h2 className="rm-h2">Invite someone to your table</h2><p className="rm-help">They can choose “Join with a code” on the welcome screen. Only share this code with people you want in your household.</p><details><summary>Show invitation code</summary><textarea className="invite-code" aria-label="Invitation code" readOnly value={membership?.inviteCode || ''} /><button className="rm-btn rm-secondary" onClick={async () => { try { await navigator.clipboard.writeText(membership.inviteCode); setCopied('Invitation copied.'); } catch { setCopied('Select the code above and copy it.'); } }}>Copy invitation code</button><p role="status">{copied}</p></details></section>}
          <details className="household-spending"><summary>Default for purchase records</summary><SpendingStyle {...shared} /></details>
          {onLeave && <section className="rm-card"><h2 className="rm-h2">Your profile</h2><p>{membership?.demo ? 'You’re exploring sample people and shared sample data.' : `You’re here as ${membership?.name}. Your membership is saved in this browser.`}</p>{!membership?.demo && <p className="rm-help">Keep your invitation code to rejoin on another device. Rejoining creates a new member; account recovery is not available yet.</p>}{leaving ? <><p>Save your invitation before leaving. This removes access from this browser, not your household’s records.</p><button className="rm-btn" onClick={onLeave}>Leave this browser</button><button className="rm-link" onClick={() => setLeaving(false)}>Stay here</button></> : <button className="rm-btn rm-secondary" onClick={() => membership?.demo ? onLeave() : setLeaving(true)}>{membership?.demo ? 'Set up your own household' : 'Leave or join another household'}</button>}</section>}


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
          <label><input type="radio" name="rm-spending-mode" checked={mode === 'pooled'} onChange={() => setMode('pooled')} /><span>Track who paid</span></label>
          <label><input type="radio" name="rm-spending-mode" checked={mode === 'split'} onChange={() => setMode('split')} /><span>Split expenses</span></label>
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
