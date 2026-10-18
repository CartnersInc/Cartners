import { useId, useState } from 'react';
import { people } from '../../shopping/lib/format.js';
import { cleanHandle, isValidHandle, PAY_APPS, payLink } from './payLinks.js';
import { proposalSample } from './sample.js';

// PROPOSAL (#8): the member's own payment profiles. Usernames only; the app builds the links.
// Saving needs the proposed backend route, so this form validates and previews but doesn't save.
export default function PayProfile({ workspace, actorId }) {
  const { name } = people(workspace, actorId);
  const [values, setValues] = useState(() => ({ ...(proposalSample.payProfiles[actorId] || {}) }));
  const [submitted, setSubmitted] = useState(false);
  const baseId = useId();
  const errors = PAY_APPS.filter(app => values[app.key]?.trim() && !isValidHandle(app.key, values[app.key]));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="rm-main">
      <p className="rm-proposal-note"><span className="rm-pill rm-pill-sample">Proposal</span> Saving payment profiles needs the backend route proposed in #8. This form checks and previews, but doesn't save yet.</p>
      <form className="rm-card rm-form" onSubmit={save} noValidate aria-labelledby={`${baseId}-title`}>
        <h2 id={`${baseId}-title`} className="rm-h2">{name(actorId) === 'You' ? 'Your' : `${name(actorId)}'s`} payment profiles</h2>
        <p className="rm-help">People in your groups see these only when they owe you. Add just the apps you use.</p>
        <div className="rm-profile-grid">
          {PAY_APPS.map(app => {
            const id = `${baseId}-${app.key}`;
            const bad = submitted && errors.includes(app);
            return (
              <div key={app.key} className="rm-field">
                <label htmlFor={id}>{app.field} <span className="rm-optional">optional</span></label>
                <input id={id} value={values[app.key] || ''} placeholder={app.placeholder} autoComplete="off" maxLength={40}
                  aria-invalid={bad} aria-describedby={`${id}-hint`} onChange={e => setValues(v => ({ ...v, [app.key]: e.target.value }))} />
                <span id={`${id}-hint`} className={bad ? 'rm-error-text' : 'rm-help'}>{bad ? `Check this. ${app.hint}.` : app.hint}</span>
              </div>
            );
          })}
        </div>
        <div className="rm-field">
          <span className="rm-label">What others will see</span>
          <ul className="rm-plain">
            {PAY_APPS.map(app => {
              if (!values[app.key]?.trim()) return null;
              const link = payLink(app.key, values[app.key], 1215);
              return <li key={app.key}>{link ? (link.href ? <span className="rm-mono">{link.href}</span> : `Zelle: ${cleanHandle(app.key, values[app.key])}`) : <span className="rm-error-text">{app.label}: check this entry</span>}</li>;
            })}
            {!PAY_APPS.some(app => values[app.key]?.trim()) && <li className="rm-help">Nothing yet. Others will be asked to pay you another way.</li>}
          </ul>
          <span className="rm-help">Example links use a $12.15 debt. Cash App and PayPal fill in the amount.</span>
        </div>
        <div className="rm-actions">
          <button type="submit" className="rm-btn">Save profiles</button>
        </div>
        {submitted && (errors.length
          ? <p className="rm-error" role="alert">Fix the highlighted {errors.length === 1 ? 'field' : 'fields'} first.</p>
          : <p className="rm-notice" role="status">Looks good. In the proposal this saves to your member profile; for now it isn't stored.</p>)}
      </form>
    </div>
  );
}
