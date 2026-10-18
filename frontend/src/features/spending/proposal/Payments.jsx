import { useState } from 'react';
import { copyText, formatCents, people, whenOf } from '../../shopping/lib/format.js';
import { PAY_APPS, payLink } from './payLinks.js';
import { proposalSample } from './sample.js';

// PROPOSAL (#8): who you owe and who owes you, per grocery trip, with the recipient's pay links.
// Reads the proposal sample until the backend sends settlements; every amount comes from the server.
export default function Payments({ workspace, actorId, onEditProfile }) {
  const { name } = people(workspace, actorId);
  const [dismissed, setDismissed] = useState(false);
  const all = proposalSample.settlements;
  const owe = all.filter(s => s.from === actorId && s.status === 'open');
  const owed = all.filter(s => s.to === actorId && s.status === 'open');
  const history = all.filter(s => (s.from === actorId || s.to === actorId) && s.status === 'received');
  const newest = [...owe].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0];
  const total = list => list.reduce((sum, s) => sum + s.cents, 0);
  const myProfile = proposalSample.payProfiles[actorId] || {};

  return (
    <div className="rm-main">
      <p className="rm-proposal-note"><span className="rm-pill rm-pill-sample">Proposal</span> Sample trips and amounts to show the idea in #8. Not this group's real balances, and nothing here is saved.</p>

      {newest && !dismissed && (
        <div className="rm-notice rm-notice-warn" role="status">
          <span>{name(newest.to)} finished the run to {newest.storeName}. Your share is <strong>{formatCents(newest.cents)}</strong>.</span>
          <button type="button" className="rm-link" onClick={() => setDismissed(true)}>Dismiss</button>
        </div>
      )}

      <div className="rm-stats">
        <div><span className="rm-help">You owe</span><strong className="rm-owe">{formatCents(total(owe))}</strong></div>
        <div><span className="rm-help">Owed to you</span><strong className="rm-owed">{formatCents(total(owed))}</strong></div>
      </div>

      <section className="rm-card" aria-labelledby="rm-you-owe">
        <h2 id="rm-you-owe" className="rm-h2">You owe</h2>
        {owe.length ? owe.map(s => <Debt key={s.id} settlement={s} name={name} />) : <p className="rm-help">You're all square.</p>}
      </section>

      <section className="rm-card" aria-labelledby="rm-owed">
        <h2 id="rm-owed" className="rm-h2">Owed to you</h2>
        {owed.length ? owed.map(s => (
          <div key={s.id} className="rm-debt">
            <TripHead settlement={s} who={s.from} name={name} />
            <Breakdown settlement={s} name={name} />
            <div className="rm-actions">
              <button type="button" className="rm-btn rm-small" disabled title="Proposal: needs the backend">Mark received</button>
              <button type="button" className="rm-btn rm-secondary rm-small" disabled title="Proposal: needs the backend">Remind {name(s.from)}</button>
            </div>
            <p className="rm-help">Only you can mark this received, since only you can see the money arrive.</p>
          </div>
        )) : <p className="rm-help">Nobody owes you right now.</p>}
        {!PAY_APPS.some(app => myProfile[app.key]) && (
          <p className="rm-notice"><span>Add your payment profiles so others can pay you in one tap.</span><button type="button" className="rm-link" onClick={onEditProfile}>Add profiles</button></p>
        )}
      </section>

      {history.length > 0 && (
        <details className="rm-collapsed">
          <summary>Settled ({history.length})</summary>
          <ul className="rm-plain">
            {history.map(s => (
              <li key={s.id} className="rm-balance rm-muted">
                <span>{s.from === actorId ? `You paid ${name(s.to)}` : `${name(s.from)} paid you`} for the {s.storeName} run{s.receivedAt ? `, ${whenOf(s.receivedAt)}` : ''}</span>
                <span>{formatCents(s.cents)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TripHead({ settlement: s, who, name }) {
  return (
    <div className="rm-debt-head">
      <span className="avatar" aria-hidden="true">{name(who)[0]}</span>
      <div className="rm-debt-who">
        <strong>{name(who)}</strong>
        <span className="rm-help">{s.storeName} run · {whenOf(s.finishedAt)} · receipt {formatCents(s.receiptTotalCents)} incl. tax</span>
      </div>
      <span className="rm-price rm-debt-amount">{formatCents(s.cents)}</span>
    </div>
  );
}

function Breakdown({ settlement: s }) {
  const b = s.breakdown;
  return (
    <dl className="rm-breakdown">
      <div><dt>Shared items · {b.sharedNote}</dt><dd>{formatCents(b.sharedCents)}</dd></div>
      {b.personalCents > 0 && <div><dt>Personal · {b.personalItems.join(', ')}</dt><dd>{formatCents(b.personalCents)}</dd></div>}
      {b.feesCents > 0 && <div><dt>Tax and fees, proportional</dt><dd>{formatCents(b.feesCents)}</dd></div>}
    </dl>
  );
}

function Debt({ settlement: s, name }) {
  const [copied, setCopied] = useState('');
  const profile = proposalSample.payProfiles[s.to] || {};
  const links = PAY_APPS.map(app => ({ app, link: payLink(app.key, profile[app.key], s.cents) })).filter(entry => entry.link);
  const amount = (s.cents / 100).toFixed(2);
  async function copy(label, text) {
    setCopied((await copyText(text)) ? `${label} copied` : "Couldn't copy. Select it and copy it by hand.");
    setTimeout(() => setCopied(''), 2500);
  }
  return (
    <div className="rm-debt">
      <TripHead settlement={s} who={s.to} name={name} />
      <Breakdown settlement={s} />
      <div className="rm-actions">
        {links.map(({ app, link }) => link.href
          ? <a key={app.key} className="rm-btn rm-secondary rm-small" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}{app.key !== 'venmo' ? ` · $${amount}` : ''}</a>
          : <button key={app.key} type="button" className="rm-btn rm-secondary rm-small" onClick={() => copy('Zelle contact', link.copy)}>Copy {link.label}</button>)}
        <button type="button" className="rm-btn rm-secondary rm-small" onClick={() => copy('Amount', amount)}>Copy ${amount}</button>
      </div>
      {!links.length && <p className="rm-help">{name(s.to)} hasn't added any payment profiles yet. Pay them another way.</p>}
      <p className="rm-help">Opening a link doesn't send money or mark this paid. {name(s.to)} confirms when it arrives.</p>
      <p className="rm-ok" aria-live="polite">{copied}</p>
    </div>
  );
}
