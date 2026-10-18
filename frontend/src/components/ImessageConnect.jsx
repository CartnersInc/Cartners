import { prettyPhone, smsHref } from '../imessageLine.js';

export function firstText(membership) {
  if (!membership?.inviteCode || membership.demo) return '';
  const name = String(membership.name || '').trim();
  return name ? `${membership.inviteCode} ${name}` : membership.inviteCode;
}

export default function ImessageConnect({ membership }) {
  const phone = prettyPhone();
  const text = firstText(membership);
  if (membership?.demo) {
    return <>
      <p>Texts do not change this sample list. Set up your own household, then connect each iPhone with that household’s invitation code.</p>
      <ol className="imessage-steps">
        <li>Create or join your real household.</li>
        <li>On Household, copy the invitation code.</li>
        <li>Text that code to <strong>{phone}</strong> from your iPhone, with your name after it.</li>
        <li>After Cartners replies, text “need milk” or “going to the store.”</li>
      </ol>
      <a className="text-button" href="#groups">Open Household</a>
    </>;
  }
  return <>
    <p>Each iPhone joins <strong>this</strong> household once. Someone in another household texts their own code.</p>
    <ol className="imessage-steps">
      <li>From your iPhone, open the blue iMessage thread for <strong>{phone}</strong>.</li>
      <li>Send the invitation code below once, with your name after it.</li>
      <li>When Cartners says this phone is on the household, text “need milk” or “going to QFC.”</li>
    </ol>
    {text
      ? <textarea className="invite-code" readOnly rows={3} aria-label="Message to text Cartners" value={text} />
      : <p>Your invitation code shows here after this browser finishes setup.</p>}
    {text && <a className="text-button" href={smsHref(text)}>Text this code to {phone}</a>}
  </>;
}
