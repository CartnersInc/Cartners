import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { saveMembership, secret } from './session.js';
import KitchenArt from '../../components/KitchenArt.jsx';
import { useSurfaceMotion } from '../../components/useMotion.js';

const names = { family: 'Our family', roommates: 'Our kitchen', friends: 'Our get-together', other: 'Our table' };
const split = value => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];
export default function Onboarding({ api, onComplete }) {
  const [step, setStep] = useState(0);
  const stepMotion = useSurfaceMotion(step);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('create');
  const [kind, setKind] = useState('family');
  const [householdName, setHouseholdName] = useState('');
  const [code, setCode] = useState('');
  const [servings, setServings] = useState(2);
  const [restrictions, setRestrictions] = useState('');
  const [likes, setLikes] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [keys] = useState(() => ({ sessionToken: secret(), inviteCode: secret() }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function finish(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    const inviteCode = mode === 'join' ? code.trim() : keys.inviteCode;
    try {
      const body = { name: name.trim(), sessionToken: keys.sessionToken, inviteCode,
        ...(mode === 'create' ? { householdName: householdName.trim() || names[kind], kind, servings: Number(servings), restrictions: split(restrictions), likes: split(likes), maxPrepMinutes: Number(minutes) } : {}) };
      const result = await api.request(mode === 'join' ? '/api/households/join' : '/api/households', { method: 'POST', body });
      const membership = { workspaceId: result.workspace.workspaceId, actorId: result.actorId, name: name.trim(), householdName: result.workspace.groups[0].name, sessionToken: keys.sessionToken, inviteCode, kind: mode === 'create' ? kind : 'other' };
      saveMembership(membership); onComplete(membership, result.workspace);
    } catch (err) {
      setError(err.status === 404 && err.code === 'REQUEST_FAILED'
        ? 'The website is newer than the shared backend. Deploy the latest main branch to Render, then try again. Your answers are still here.'
        : err.message || 'Could not save setup. Allow browser storage and try again.');
    }
    finally { setPending(false); }
  }
  function demo() {
    const membership = { demo: true, workspaceId: 'demo-family', actorId: 'leila', name: 'Leila', householdName: 'Sample family' };
    try { saveMembership(membership); onComplete(membership); } catch { setError('Allow browser storage to continue.'); }
  }
  function next(event) { event.preventDefault(); setError(''); setStep(step + 1); }
  return <main className="setup-page" data-step={step}>
    <a className="wordmark setup-logo" href="#home" onClick={e => { e.preventDefault(); if (!pending) setStep(0); }}>cartners<span>.</span></a>
    <div className="setup-layout">
      <aside className="setup-story"><h1>A little less planning.<br /><span>A little more dinner.</span></h1><p>Find something everyone wants to eat, bring the groceries together, and keep track of who picked them up.</p><KitchenArt /><div className="setup-example"><p>“Something quick for four. One of us is vegetarian.”</p><span>One idea. One shared list. Dinner sorted.</span></div></aside>
      <section ref={stepMotion} className="setup-content" aria-label="Set up Cartners">
        {step > 0 && <><div className="setup-progress"><button className="text-button" disabled={pending} onClick={() => { setError(''); setStep(step - 1); }}>Back</button><span>Step {step} of {mode === 'join' ? 2 : 3}</span></div><div className="setup-meter" aria-hidden="true"><span style={{ transform: `scaleX(${step / (mode === 'join' ? 2 : 3)})` }} /></div></>}
        {step === 0 ? <><h2>Make room at your table.</h2><p>Start with your name and who you’re planning for. You can invite everyone else later.</p><button className="button primary" onClick={() => setStep(1)}>Get started<Icon name="arrow" /></button><button className="text-button setup-demo" onClick={demo}>Explore a sample household</button><p className="small muted">Your membership stays in this browser. No password or payment details needed.</p></> : step === 1 ? <form onSubmit={next}><h2>First, what should we call you?</h2><label>Your name<input autoFocus autoComplete="given-name" value={name} maxLength={60} required onChange={e => setName(e.target.value)} /></label><p className="small muted">This is the name your household will see when you add groceries or record a purchase.</p><button className="button primary" disabled={!name.trim()}>Continue<Icon name="arrow" /></button></form> : step === 2 ? <form onSubmit={mode === 'join' ? finish : next}><h2>Who’s at your table, {name.trim()}?</h2><fieldset disabled={pending}><legend>Start or join a household</legend><div className="setup-choices">{[['create','Start a household'],['join','Join with a code']].map(([value,label]) => <label key={value}><input type="radio" name="setup-mode" checked={mode===value} onChange={() => setMode(value)} />{label}</label>)}</div></fieldset>
          {mode === 'join' ? <><label>Invitation code<textarea value={code} rows={3} required spellCheck="false" autoCapitalize="none" onChange={e => setCode(e.target.value)} /></label><p className="small muted">Ask a household member for the code in their Household page. Their saved preferences will carry over.</p></> : <><fieldset><legend>We’re planning for…</legend><div className="setup-choices">{[['family','Family'],['roommates','Roommates'],['friends','Friends or a party'],['other','Something else']].map(([value,label]) => <label key={value}><input type="radio" name="household-kind" checked={kind===value} onChange={() => setKind(value)} />{label}</label>)}</div></fieldset><label>Household name <span className="muted">(optional)</span><input value={householdName} maxLength={80} placeholder={names[kind]} onChange={e => setHouseholdName(e.target.value)} /></label></>}
          <button className="button primary" disabled={pending || (mode === 'join' && !/^[a-f0-9]{64}$/.test(code.trim()))}>{pending ? 'Joining…' : mode === 'join' ? 'Join household' : 'Continue'}<Icon name="arrow" /></button>
        </form> : <form onSubmit={finish}><h2>Help us find food that fits.</h2><p>Set your usuals now. You can change them for any meal.</p><div className="setup-fields"><label>Usually cooking for<input type="number" min="1" max="12" required value={servings} onChange={e => setServings(e.target.value)} /></label><label>Time to cook (minutes)<input type="number" min="1" max="240" required value={minutes} onChange={e => setMinutes(e.target.value)} /></label></div><label>Dietary needs & foods to avoid <span className="muted">(optional)</span><input value={restrictions} maxLength={300} placeholder="Vegetarian, no peanuts" onChange={e => setRestrictions(e.target.value)} /></label><p className="small muted">Separate with commas. Tell us known restrictions; AI cannot guarantee an ingredient is allergy-safe.</p><label>Foods you enjoy <span className="muted">(optional)</span><input value={likes} maxLength={300} placeholder="Tacos, pasta, Thai food" onChange={e => setLikes(e.target.value)} /></label><p className="small muted">We’ll ask about stores when you shop, and splitting costs when you record a purchase.</p><button className="button primary" disabled={pending}>{pending ? 'Setting your table…' : 'Let’s find something to eat'}<Icon name="arrow" /></button></form>}
        {error && <p className="notice error" role="alert">{error}</p>}
      </section>
    </div>
  </main>;
}
