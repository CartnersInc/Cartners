import { prettyPhone, smsHref } from '../imessageLine.js';

export function firstText(membership) {
  if (!membership?.inviteCode || membership.demo) return '';
  return membership.inviteCode;
}

export default function ImessageConnect({ membership }) {
  const phone = prettyPhone();
  const text = firstText(membership);
  if (membership?.demo) {
    return <>
      <p>Texts do not change this sample list. Set up your own household, then connect each Photon user with that household’s invitation code.</p>
      <ol className="imessage-steps">
        <li>Create or join your real household.</li>
        <li>On Household, copy the invitation code.</li>
        <li>Text that code to <strong>{phone}</strong>. Cartners uses that Photon user’s name.</li>
        <li>After Cartners replies, text “need milk” or “going to the store.”</li>
      </ol>
      <a className="text-button" href="#groups">Open Household</a>
    </>;
  }
  return <>
    <p>Each Photon user joins <strong>this</strong> household from their own phone. Cartners uses that Photon name, not one shared label.</p>
    <ol className="imessage-steps">
      <li>Open the blue iMessage thread for <strong>{phone}</strong>.</li>
      <li>Send the invitation code below once. Add a name after it only if it should differ from the Photon user.</li>
      <li>When Cartners replies with that Photon name, text “need milk” or “going to QFC.”</li>
    </ol>
    {text
      ? <textarea className="invite-code" readOnly rows={3} aria-label="Message to text Cartners" value={text} />
      : <p>Your invitation code shows here after this browser finishes setup.</p>}
    {text && <a className="text-button" href={smsHref(text)}>Text this code to {phone}</a>}
  </>;
}
