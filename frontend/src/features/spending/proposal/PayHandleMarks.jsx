import { copyText } from '../../shopping/lib/format.js';
import { actorPayLinks, memberPayApps } from './payLinks.js';

const ICONS = {
  venmo: { bg: '#3D95CE', d: 'M7.5 5.5h3.2l1.7 8.2 1.7-8.2H17.5L14 18.5h-3.2z' },
  cashapp: { bg: '#00C244', d: 'M12.8 6.2c1.4.2 2.4 1 2.8 2.2h-2.1c-.2-.5-.7-.8-1.5-.8-.7 0-1.2.3-1.2.8 0 .5.5.7 1.4.9l.7.2c1.8.4 2.8 1.2 2.8 2.7 0 1.7-1.4 2.8-3.4 3v1.6h-1.7V15.9c-1.8-.2-3-1.2-3.3-2.7h2.1c.3.7.9 1 1.7 1 .9 0 1.5-.4 1.5-1s-.6-.8-1.7-1.1l-.6-.2C8.8 11.5 8 10.6 8 9.2c0-1.6 1.3-2.7 3.1-2.9V4.8h1.7z' },
  paypal: { bg: '#003087', d: 'M8 18.5 9.2 5.5h4.4c2.6 0 4 1.3 3.7 3.7-.4 3-2.4 4.5-5.3 4.5H9.8L9.2 18.5zm3.4-8.2h1.4c1.1 0 1.8-.5 2-1.6.2-1.1-.3-1.6-1.5-1.6h-1.3z' },
  zelle: { bg: '#6D1ED4', d: 'M7 6.2h10v2.2l-6.2 7.4H17v2.2H7v-2.2l6.2-7.4H7z' },
};

function PayAppIcon({ appKey }) {
  const mark = ICONS[appKey];
  if (!mark) return null;
  return (
    <svg viewBox="0 0 24 24" className="rm-pay-icon" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill={mark.bg} />
      <path d={mark.d} fill="#fff" />
    </svg>
  );
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
              <PayAppIcon appKey={app.key} />
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
            <PayAppIcon appKey={app.key} />
          </button>
        );
      })}
    </span>
  );
}

export default function PersonName({ workspace, actorId, cents, children }) {
  return (
    <span className="rm-person">
      <span>{children}</span>
      <PayHandleMarks payLinks={actorPayLinks(workspace, actorId)} cents={cents} />
    </span>
  );
}
