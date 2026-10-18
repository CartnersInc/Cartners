import { useState } from 'react';
import { copyText, formatCents, quantityLabel } from '../../shopping/lib/format.js';
import { clearCheckout } from '../../shopping/lib/checkout.js';
import { PAY_APPS, payLink } from '../proposal/payLinks.js';
import { proposalSample } from '../proposal/sample.js';

// Cart → Buy handoff: show what is being purchased, then Venmo / Zelle / Cash App / PayPal links.
export default function CartCheckout({ checkout, actorId, onDismiss, onEditProfile }) {
  const [copied, setCopied] = useState('');
  const profile = proposalSample.payProfiles[actorId] || {};
  const payee = Object.entries(proposalSample.payProfiles).find(([id]) => id !== actorId)?.[0] || actorId;
  const payeeProfile = proposalSample.payProfiles[payee] || profile;
  const amount = Number.isInteger(checkout.totalCents) ? (checkout.totalCents / 100).toFixed(2) : null;
  const links = PAY_APPS
    .map(app => ({ app, link: payLink(app.key, payeeProfile[app.key], checkout.totalCents) }))
    .filter(entry => entry.link);

  async function copy(label, text) {
    setCopied((await copyText(text)) ? `${label} copied` : "Couldn't copy. Select it and copy by hand.");
    setTimeout(() => setCopied(''), 2500);
  }

  function dismiss() {
    clearCheckout();
    onDismiss?.();
  }

  return (
    <section className="rm-card rm-checkout" aria-labelledby="rm-checkout-title">
      <div className="rm-title-row">
        <h2 id="rm-checkout-title" className="rm-h2">Buy this cart</h2>
        <button type="button" className="rm-link" onClick={dismiss}>Clear checkout</button>
      </div>
      <p className="rm-help">
        These are the items still checked in Shopping. Opening Venmo or Zelle never marks a debt paid.
        It only opens the payment app with the amount.
      </p>

      <ul className="rm-checkout-lines">
        {checkout.lines.map(line => (
          <li key={line.id} className="rm-checkout-line">
            <div>
              <strong>{line.name}</strong>
              <span className="rm-help">{quantityLabel(line)}{line.note ? ` · ${line.note}` : ''}{line.estimated ? ' · estimated' : ''}</span>
            </div>
            <span className="rm-price">{formatCents(line.cents, line.currency || checkout.currency)}</span>
          </li>
        ))}
      </ul>

      <div className="rm-checkout-total">
        <span>Cart total</span>
        <strong className="rm-price">{formatCents(checkout.totalCents, checkout.currency)}</strong>
      </div>

      <div className="rm-actions rm-checkout-pay">
        {links.map(({ app, link }) => link.href
          ? <a key={app.key} className="rm-btn" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}{amount && app.key !== 'venmo' ? ` · $${amount}` : ''}</a>
          : <button key={app.key} type="button" className="rm-btn rm-secondary" onClick={() => copy('Zelle contact', link.copy)}>Copy {link.label}</button>)}
        {amount && <button type="button" className="rm-btn rm-secondary" onClick={() => copy('Amount', amount)}>Copy ${amount}</button>}
      </div>

      {!links.length && (
        <p className="rm-notice">
          <span>Add Venmo, Zelle, Cash App, or PayPal handles so Buy can open a payment link.</span>
          <button type="button" className="rm-link" onClick={onEditProfile}>Add profiles</button>
        </p>
      )}
      <p className="rm-ok" aria-live="polite">{copied}</p>
    </section>
  );
}
