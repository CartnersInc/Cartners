import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createApi, isWorkspace, isDraft } from './api/client.js';
import Home from './features/home/Home.jsx';
import Icon from './components/Icon.jsx';
import ContextPicker from './components/ContextPicker.jsx';
import FeatureErrorBoundary from './components/FeatureErrorBoundary.jsx';
import { initialWorkspace } from './samples.js';
import { clearPurchasePrompt } from './features/groups/parts/TripPanel.jsx';
import Onboarding from './features/onboarding/Onboarding.jsx';
import { readMembership, leaveMembership } from './features/onboarding/session.js';

const api = createApi({ baseUrl: import.meta.env.VITE_API_BASE_URL || '', getToken: () => readMembership()?.sessionToken });
const pages = ['home', 'plans', 'shopping', 'spending', 'groups'];
const mainPages = ['home', 'shopping'];
const morePages = ['plans', 'spending', 'groups'];
const pageLabels = { home: 'Home', plans: 'This week', shopping: 'Shopping', spending: 'Spending', groups: 'Household' };
// Only page entry modules — not helpers like Preferences.jsx — so More-nav chunks stay stable.
const featureFiles = import.meta.glob([
  './features/shopping/Shopping.jsx',
  './features/spending/Spending.jsx',
  './features/groups/Groups.jsx',
  './features/plans/Plans.jsx',
]);
const features = Object.fromEntries(pages.slice(1).map(page => {
  const filename = `./features/${page}/${page[0].toUpperCase()}${page.slice(1)}.jsx`;
  return [page, featureFiles[filename] ? lazy(featureFiles[filename]) : null];
}));
export const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const currentPage = () => pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
function loadDrafts() {
  try { const data = JSON.parse(sessionStorage.getItem('common:drafts') || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([id, entry]) => entry && typeof entry === 'object' && !entry.localOnly && (entry.message === undefined || (typeof entry.message === 'string' && entry.message.length <= 500)) && (!entry.draft || isDraft(entry.draft, id)))) : {}; } catch { return {}; }
}
function ComingSoon({ page, navigate }) {
  return <section className="empty-page"><Icon name={page} /><h1>{page[0].toUpperCase() + page.slice(1)}</h1><p>This area is coming next. Start with a meal idea on Home; your current idea will stay there.</p><button className="button" onClick={() => navigate('home')}>Back to Home<Icon name="arrow" /></button></section>;
}

export default function App() {
  const [membership, setMembership] = useState(readMembership);
  const [snapshot, setSnapshot] = useState(null);
  function complete(member, workspace) { clearPurchasePrompt(); setSnapshot(workspace || null); setMembership(member); location.hash = 'home'; }
  function leave() { clearPurchasePrompt(); leaveMembership(); setSnapshot(null); setMembership(null); }
  return membership ? <WorkspaceApp key={membership.workspaceId + membership.actorId} membership={membership} initialSnapshot={snapshot} onLeave={leave} /> : <Onboarding api={api} onComplete={complete} />;
}

function WorkspaceApp({ membership, initialSnapshot, onLeave }) {
  const [page, setPage] = useState(currentPage);
  const [workspace, setWorkspace] = useState(() => initialSnapshot || { ...initialWorkspace, workspaceId: membership.workspaceId, actors: [{ id: membership.actorId, name: membership.name }], groups: [{ workspaceId: membership.workspaceId, name: membership.householdName }], preferences: { ...initialWorkspace.preferences, spendingMode: 'pooled' } });
  const [actorId, setActorId] = useState(membership.actorId);
  const [connection, setConnection] = useState('loading');
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState('');
  const [accessLost, setAccessLost] = useState(false);
  const [undoingDraft, setUndoingDraft] = useState(false);
  const [draftUndoError, setDraftUndoError] = useState('');
  const [drafts, setDrafts] = useState(loadDrafts);
  const [planDate, setPlanDate] = useState(today);
  const activeGroup = useRef(membership.workspaceId);
  const hasLive = useRef(false);
  const pollRequest = useRef(0);
  const mainRef = useRef(null);
  const Feature = features[page];
  function onWorkspaceChange(next) {
    if (!isWorkspace(next, activeGroup.current)) throw new Error('The server returned an invalid group snapshot. The previous data is preserved.');
    ++pollRequest.current;
    setWorkspace(current => next.listRevision < current.listRevision ? current : next);
  }
  function navigate(next, date = today()) {
    if (next === 'home-new') { updateEntry(activeGroup.current, { message: '' }); setPlanDate(date); location.hash = 'home'; return; }
    if (pages.includes(next)) location.hash = next;
  }
  useEffect(() => {
    const handle = () => setPage(currentPage());
    addEventListener('hashchange', handle);
    return () => removeEventListener('hashchange', handle);
  }, []);
  useEffect(() => { mainRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [page]);
  function updateEntry(id, entry) {
    setDrafts(current => {
      const next = { ...current, [id]: entry };
      try { sessionStorage.setItem('common:drafts', JSON.stringify(next)); } catch { /* In-memory drafts survive navigation if storage is blocked. */ }
      return next;
    });
  }
  async function undoLatestDraft() {
    const groupId = activeGroup.current, entry = drafts[groupId];
    if (!entry?.saved || undoingDraft) return;
    const undoAttempt = entry.undoAttempt || { workspaceId: groupId, actorId: entry.saved.actorId || actorId, requestId: crypto.randomUUID() };
    updateEntry(groupId, { ...entry, undoAttempt });
    setUndoingDraft(true); setDraftUndoError('');
    try {
      const result = await api.request(`/api/actions/${encodeURIComponent(entry.saved.actionId)}/undo`, { method: 'POST', body: undoAttempt });
      if (!isWorkspace(result.workspace, groupId)) throw new Error('The server returned an invalid cart. Your last saved data is still visible.');
      onWorkspaceChange(result.workspace);
      updateEntry(groupId, { ...entry, saved: null, confirmAttempt: null, undoAttempt: null, undoMessage: result.changeSummary || 'Cart updates reversed.' });
      setNotice(result.changeSummary || 'Cart updates reversed.');
    } catch (err) { setDraftUndoError(err.message || 'Could not undo this cart update. Try again.'); }
    finally { setUndoingDraft(false); }
  }
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    let disposed = false, inFlight = false, requestController;
    async function poll() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      const groupId = activeGroup.current, request = ++pollRequest.current;
      requestController = new AbortController();
      try {
        const next = await api.request(`/api/workspace?workspaceId=${encodeURIComponent(groupId)}`, { signal: requestController.signal });
        if (disposed || groupId !== activeGroup.current || request !== pollRequest.current) return;
        if (!isWorkspace(next, groupId)) throw new Error('Invalid workspace response');
        onWorkspaceChange(next); hasLive.current = true; setConnection('connected'); setAccessLost(false);
      } catch (error) {
        if (error.status === 401 && !disposed) setAccessLost(true);
        if (!disposed && groupId === activeGroup.current && request === pollRequest.current) setConnection(hasLive.current ? 'stale' : 'sample');
      } finally { inFlight = false; }
    }
    poll();
    const timer = setInterval(poll, 3000);
    document.addEventListener('visibilitychange', poll);
    return () => { disposed = true; clearInterval(timer); requestController?.abort(); document.removeEventListener('visibilitychange', poll); };
  }, []);
  async function changeGroup(nextId) {
    if (nextId === activeGroup.current || switching) return;
    setSwitching(true);
    try {
      const next = await api.request(`/api/workspace?workspaceId=${encodeURIComponent(nextId)}`);
      if (!isWorkspace(next, nextId)) throw new Error('The server returned an invalid group. Your previous group is still selected.');
      ++pollRequest.current; activeGroup.current = nextId;
      setWorkspace(next); setActorId(next.actors.some(actor => actor.id === actorId) ? actorId : next.actors[0]?.id || '');
      setConnection('connected'); setPlanDate(today());
    } catch (err) { setNotice(err.message); }
    finally { setSwitching(false); }
  }
  function useDraft(draft) {
    if (draft?.planDate) setPlanDate(draft.planDate);
    updateEntry(activeGroup.current, { draft, localOnly: false, aiPreviewOnly: false, message: '' });
    navigate('home');
  }
  const connected = connection === 'connected' && !switching;
  const featureProps = { workspace, actorId, api, onWorkspaceChange, navigate, notify: setNotice, onUseDraft: useDraft, connection, membership, onLeave };
  const navLink = id => <a key={id} href={`#${id}`} aria-current={page === id ? 'page' : undefined}><Icon name={id} /><span>{pageLabels[id]}</span>{id === 'shopping' && workspace.items.some(item => !item.removed && !item.bought) && <span className="nav-count" aria-hidden="true">{workspace.items.filter(item => !item.removed && !item.bought).length}</span>}</a>;
  return <div className={`app-shell page-${page}`}>
    <a className="skip-link" href="#content" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
    <aside className="sidebar"><a className="wordmark" href="#home" aria-label="Cartners Home">cartners<span>.</span></a><div className="sidebar-house"><Icon name="home" /><span>{workspace.groups.find(group => group.workspaceId === workspace.workspaceId)?.name || 'Your group'}</span></div><nav aria-label="Main navigation">{mainPages.map(navLink)}<div className="desktop-nav">{morePages.map(navLink)}</div><details className="sidebar-more" open={morePages.includes(page)}><summary><Icon name="groups" /><span>More</span></summary><div>{morePages.map(navLink)}</div></details></nav><div className="sidebar-footer"><Icon name="leaf" /><p>A little more together.</p><span>A shared table.<br />A lighter everyday.</span></div></aside>
    <div className="app-stage"><header className="topbar"><a className="mobile-wordmark" href="#home">cartners<span>.</span></a>{membership.demo ? <ContextPicker label="Sample household" value={workspace.workspaceId} options={workspace.groups.map(group => ({ value: group.workspaceId, label: group.name }))} disabled={!connected} onChange={changeGroup} icon="home" /> : <button className="text-button household-link" onClick={() => navigate('groups')}><Icon name="home" />{workspace.groups[0]?.name || membership.householdName}</button>}<div className="session-controls">{page !== 'home' && <a className="home-return" href="#home"><Icon name="home" /><span>Home</span></a>}<span className="connection-label">{connection === 'loading' ? 'Connecting…' : connection === 'connected' ? (membership.demo ? 'Shared demo' : 'List up to date') : connection === 'stale' ? 'Connection lost · showing last update' : 'Offline · changes paused'}</span>{membership.demo ? <ContextPicker label="Demo as" value={actorId} options={workspace.actors.map(actor => ({ value: actor.id, label: actor.name }))} disabled={switching} onChange={setActorId} /> : <button className="text-button" onClick={() => navigate('groups')}>{membership.name}</button>}</div></header>
      <main id="content" ref={mainRef} tabIndex={-1} className="main-content">
        {accessLost && <p className="notice error" role="alert">Your household membership is no longer available on the server. <button className="text-button" onClick={onLeave}>Return to setup</button></p>}
        {membership.demo && <p className="notice demo-notice">You’re exploring a shared sample household. Names, history, and preferences are examples. <button className="text-button" onClick={onLeave}>Set up your own</button></p>}
        {page === 'shopping' && drafts[workspace.workspaceId]?.saved && <aside className="cart-undo" aria-label="Recent cart update">
          <span>{drafts[workspace.workspaceId].saved.message}</span>
          <button className="text-button" disabled={undoingDraft || !connected} onClick={undoLatestDraft}>{undoingDraft ? 'Undoing…' : 'Undo'}</button>
          {draftUndoError && <span className="cart-undo-error" role="alert">{draftUndoError}</span>}
        </aside>}
        {(connection === 'stale' || connection === 'sample') && <p className="connection-note" role="status">{connection === 'stale' ? 'Updates are paused. Your last saved data is still visible; reconnect before making changes.' : 'The shared list is offline. Your changes are paused; reconnect to save meals or groceries.'}</p>}
        <div hidden={page !== 'home'}><Home key={workspace.workspaceId} {...featureProps} active={page === 'home'} connected={connected} entry={drafts[workspace.workspaceId]} onEntryChange={entry => updateEntry(workspace.workspaceId, entry)} planDate={planDate} onPlanDateChange={setPlanDate} /></div>
        {page !== 'home' && <FeatureErrorBoundary page={page} label={pageLabels[page]} icon={page} navigate={navigate}><Suspense fallback={<p role="status">Opening {pageLabels[page] || page}…</p>}>{Feature ? <Feature key={workspace.workspaceId} {...featureProps} connected={connected} onPlanDateChange={setPlanDate} /> : <ComingSoon page={page} navigate={navigate} />}</Suspense></FeatureErrorBoundary>}
      </main><footer className="app-footer">Cartners · made for the things you share.<span>Your table</span></footer>
    </div><div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
  </div>;
}
