import { useId, useState } from 'react';
import RunBanner from './parts/RunBanner.jsx';
import { useWrite } from '../shopping/lib/useWrite.js';
import { people, spendingModeOf, useServerNow } from '../shopping/lib/format.js';
import { activeTrip } from '../shopping/lib/trip.js';
import '../shopping/roomie.css';
import Preferences from '../plans/Preferences.jsx';
import { PAY_APPS, isValidHandle, cleanHandle } from '../spending/proposal/payLinks.js';
import PersonName, { PayHandleMarks } from '../spending/proposal/PayHandleMarks.jsx';
import { isFamilyTable, splitsCosts, withMemberPayLinks } from '../../household.js';
import { readMembership, saveMembership } from '../onboarding/session.js';
import { IMESSAGE_LINE, prettyPhone, smsHref } from '../../imessageLine.js';

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
      <p className="rm-intro">{isFamilyTable(workspace, membership) ? `${group?.name || 'This family'} shares one grocery list. Receipts stay a household record unless you switch to splitting.` : splitsCosts(workspace) ? `${group?.name || 'This household'} splits purchases. Add Venmo, Zelle, Cash App, or PayPal so people can pay you after a run.` : `Everything here belongs to ${group?.name || 'this group'}. Lists, runs and spending never mix between groups.`}</p>

      <RunBanner workspace={workspace} actorId={actorId} serverNowMs={serverNowMs} onAdd={() => navigate('shopping')} addLabel="Open the cart" />

      <div className="household-settings">
        <div className="rm-main">
          <section className="rm-card" aria-labelledby="rm-members">
            <h2 id="rm-members" className="rm-h2">{group?.name || 'This group'}</h2>
            <ul className="rm-members">
              {members.map(member => (
                <li key={member.id}>
                  <span className="avatar" aria-hidden="true">{member.name[0]}</span>
                  <PersonName>{member.name}{member.id === actorId ? ' (you)' : ''}</PersonName>
                  <PayHandleMarks payLinks={member.payLinks} />
                  {trip?.claimedBy === member.id && <span className="rm-badge rm-badge-new">Shopping now</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="rm-card" aria-labelledby="rm-imessage">
            <h2 id="rm-imessage" className="rm-h2">Text the household line</h2>
            <p className="rm-help">From an iPhone on this household, text Cartners at <strong>{prettyPhone()}</strong>. “Going to the store” starts a run. “Need milk” adds it. The website never sends those texts for you.</p>
            <p><a className="rm-btn" href={smsHref(isFamilyTable(workspace, membership) ? 'Going to the store. What does everyone need?' : 'Going to QFC. What do you guys need?')}>Text {prettyPhone()}</a></p>
            <p className="rm-help">Line {IMESSAGE_LINE}. Open that thread, don’t start a new one to a different number.</p>
          </section>
          <Preferences {...shared} />
          {!membership?.demo && <section className="rm-card"><h2 className="rm-h2">Invite someone to your table</h2><p className="rm-help">They can choose “Join with a code” on the welcome screen. Only share this code with people you want in your household.</p><details><summary>Show invitation code</summary><textarea className="invite-code" aria-label="Invitation code" readOnly value={membership?.inviteCode || ''} /><button className="rm-btn rm-secondary" onClick={async () => { try { await navigator.clipboard.writeText(membership.inviteCode); setCopied('Invitation copied.'); } catch { setCopied('Select the code above and copy it.'); } }}>Copy invitation code</button><p role="status">{copied}</p></details></section>}
          <details className="household-spending" open={splitsCosts(workspace)}><summary>{isFamilyTable(workspace, membership) ? 'Family budget or split' : 'How you split purchases'}</summary><SpendingStyle {...shared} /></details>
          <PayHandles {...shared} membership={membership} />
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
          <label><input type="radio" name="rm-spending-mode" checked={mode === 'pooled'} onChange={() => setMode('pooled')} /><span>Family budget</span></label>
          <label><input type="radio" name="rm-spending-mode" checked={mode === 'split'} onChange={() => setMode('split')} /><span>Split with roommates</span></label>
        </div>
      </fieldset>
      <p className="rm-help">{mode === 'pooled' ? 'Family budget: receipts show who paid for groceries. Nobody owes anyone.' : 'Split: each receipt is shared among chosen people. Settle with Venmo, Zelle, Cash App, or PayPal. Opening a link never marks a debt paid.'}</p>
      {write.state.phase === 'error' && <p className="rm-error" role="alert">{write.state.error}</p>}
      <div className="rm-actions">
        <button type="submit" className="rm-btn" disabled={!connected || write.saving || (mode === current && !write.state.retryable)}>{write.saving ? 'Saving…' : write.state.retryable ? 'Try again' : 'Save'}</button>
        {mode !== current && !write.saving && <button type="button" className="rm-btn rm-secondary" onClick={() => { setChoice(null); write.reset(); }}>Cancel</button>}
      </div>
      {!connected && <p className="rm-help">Preview only. Connect the backend to change this.</p>}
    </form>
  );
}

function PayHandles({ workspace, actorId, api, onWorkspaceChange, connected, notify, membership }) {
  const me = workspace.actors.find(actor => actor.id === actorId);
  const [values, setValues] = useState(() => ({ ...(me?.payLinks || membership?.payLinks || {}) }));
  const write = useWrite({ api, workspace, actorId, onWorkspaceChange });
  const errors = PAY_APPS.filter(app => values[app.key]?.trim() && !isValidHandle(app.key, values[app.key]));

  async function save(event) {
    event.preventDefault();
    if (errors.length) return;
    const payLinks = Object.fromEntries(PAY_APPS.flatMap(app => {
      const value = cleanHandle(app.key, values[app.key] || '');
      return value ? [[app.key, value]] : [];
    }));
    const result = await write.send('/api/members/pay-links', 'PATCH', { payLinks });
    if (result) {
      const current = readMembership();
      if (current && !current.demo) saveMembership({ ...current, payLinks });
      notify?.(result.changeSummary || 'Saved your payment handles.');
      return;
    }
    const err = write.getLastError();
    if (err?.status !== 404) return;
    const current = readMembership();
    if (!current || current.demo) return;
    const next = { ...current, payLinks };
    saveMembership(next);
    write.reset();
    onWorkspaceChange(withMemberPayLinks(workspace, next));
    notify?.('Saved on this device. The hosted API cannot store handles until it is redeployed. Opening a link still never marks a debt paid.');
  }

  return (
    <form className="rm-card" onSubmit={save}>
      <h2 className="rm-h2">Venmo, Zelle, Cash App, PayPal</h2>
      <p className="rm-help">{isFamilyTable(workspace, membership) ? 'Shown next to your name so people can find you. Family grocery spending does not create IOUs. Cartners never moves money.' : 'Shown next to your name. Opening a link never marks a debt paid. Cartners never moves money.'}</p>
      {PAY_APPS.map(app => (
        <label key={app.key} className="rm-field">{app.field}
          <input value={values[app.key] || ''} placeholder={app.placeholder} autoComplete="off" maxLength={40} disabled={write.locked || !connected} onChange={e => setValues(current => ({ ...current, [app.key]: e.target.value }))} />
          <span className="rm-help">{app.hint}</span>
        </label>
      ))}
      {write.state.phase === 'error' && <p className="rm-error" role="alert">{write.state.error}</p>}
      {errors.length > 0 && <p className="rm-error" role="alert">Check the highlighted handles before saving.</p>}
      <button type="submit" className="rm-btn" disabled={!connected || write.saving || errors.length > 0}>{write.saving ? 'Saving…' : 'Save payment handles'}</button>
      {!connected && <p className="rm-help">Needs the shared backend.</p>}
    </form>
  );
}
