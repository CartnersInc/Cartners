import { copyText } from '../../shopping/lib/format.js';
import { memberPayApps } from './payLinks.js';

const PAY_LOGOS = {
  venmo: 'venmo.png',
  cashapp: 'cashapp.png',
  paypal: 'paypal.png',
  zelle: 'zelle.png',
};

export function PayAppLogo({ appKey }) {
  const file = PAY_LOGOS[appKey];
  if (!file) return null;
  return <img className="rm-pay-icon" src={`${import.meta.env.BASE_URL}logos/${file}`} alt="" />;
}

const unpaidHint = 'Does not send money or mark paid.';

export function PayHandleMarks({ payLinks, cents }) {
  const entries = memberPayApps(payLinks, cents);
  if (!entries.length) return null;

  async function copyZelle(event, text) {
    event.preventDefault();
    event.stopPropagation();
    await copyText(text);
  }

  return (
    <span className="rm-pay-marks" onClick={event => event.stopPropagation()}>
      {entries.map(({ app, link }) => {
        const title = `${link.label}. ${unpaidHint}`;
        if (link.href) {
          return (
            <a
              key={app.key}
              className="rm-pay-mark"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={title}
              aria-label={title}
            >
              <PayAppLogo appKey={app.key} />
            </a>
          );
        }
        return (
          <button
            key={app.key}
            type="button"
            className="rm-pay-mark"
            title={`${link.label}. Copies the contact. ${unpaidHint}`}
            aria-label={`${link.label}. Copies the contact. ${unpaidHint}`}
            onClick={event => copyZelle(event, link.copy)}
          >
            <PayAppLogo appKey={app.key} />
          </button>
        );
      })}
    </span>
  );
}

export default function PersonName({ children }) {
  return <span className="rm-person"><span>{children}</span></span>;
}
