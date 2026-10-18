import { useState } from 'react';
import { copyText, formatCents, PAY_NAMES, safePayLink } from '../../shopping/lib/format.js';

// Who owes whom, straight from the server's balances. Pay links are optional and member-provided;
// opening one never marks anything paid, and there is no in-app payment.
export default function Balances({ balances, workspace, actorId, name }) {
  const mine = balances.filter(b => b.from === actorId || b.to === actorId);
  const others = balances.filter(b => !mine.includes(b));
  return (
    <section className="rm-card" aria-labelledby="rm-balances">
      <h2 id="rm-balances" className="rm-h2">Who owes whom</h2>
      {balances.length === 0 && <p className="rm-help">Everyone is square.</p>}
      {mine.map(b => (b.from === actorId
        ? <Settle key={`${b.from}-${b.to}`} balance={b} recipient={workspace.actors.find(a => a.id === b.to)} name={name} />
        : <div className="rm-balance" key={`${b.from}-${b.to}`}><span><strong>{name(b.from)}</strong> owes you</span><span className="rm-price">{formatCents(b.cents)}</span></div>))}
      {others.map(b => (
        <div className="rm-balance rm-muted" key={`${b.from}-${b.to}`}><span>{name(b.from)} owes {name(b.to)}</span><span>{formatCents(b.cents)}</span></div>
      ))}
      {balances.length > 0 && <p className="rm-help">From confirmed split receipts only. Repayments aren't tracked in the app yet.</p>}
    </section>
  );
}

function Settle({ balance, recipient, name }) {
  const [copied, setCopied] = useState('');
  const amount = (balance.cents / 100).toFixed(2);
  const links = Object.entries(recipient?.payLinks || {}).map(([kind, url]) => ({ kind, url: safePayLink(kind, url) })).filter(link => link.url);
  async function copy(label, text) {
    setCopied((await copyText(text)) ? `${label} copied` : "Couldn't copy. Select it and copy it by hand.");
    setTimeout(() => setCopied(''), 2500);
  }
  return (
    <div className="rm-settle">
      <div className="rm-balance"><span>You owe <strong>{name(balance.to)}</strong></span><span className="rm-price">{formatCents(balance.cents)}</span></div>
      <div className="rm-copy-amount">
        <span>Send <strong>${amount}</strong> to {name(balance.to)}</span>
        <button type="button" className="rm-btn rm-secondary rm-small" onClick={() => copy('Amount', amount)}>Copy amount</button>
      </div>
      {links.length ? links.map(link => (
        <div className="rm-paylink" key={link.kind}>
          <span className="rm-mono">{link.url}</span>
          <a className="rm-btn rm-small" href={link.url} target="_blank" rel="noopener noreferrer">Open {name(balance.to)}'s {PAY_NAMES[link.kind]}</a>
        </div>
      )) : <p className="rm-help">{name(balance.to)} hasn't added a Venmo or PayPal link. Pay them another way.</p>}
      <p className="rm-help">Opening a link doesn't send money or mark this paid.</p>
      <p className="rm-ok" aria-live="polite">{copied}</p>
    </div>
  );
}
