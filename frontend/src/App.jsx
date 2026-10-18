import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createApi, isWorkspace, isDraft } from './api/client.js';
import Home from './features/home/Home.jsx';
import Icon from './components/Icon.jsx';
import { initialWorkspace } from './samples.js';

const api = createApi({ baseUrl: import.meta.env.VITE_API_BASE_URL || '' });
const pages = ['home', 'plans', 'shopping', 'spending', 'groups'];
const featureFiles = import.meta.glob('./features/{shopping,spending,groups,plans}/*.jsx');
const features = Object.fromEntries(pages.slice(1).map(page => {
  const filename = `./features/${page}/${page[0].toUpperCase()}${page.slice(1)}.jsx`;
  return [page, featureFiles[filename] ? lazy(featureFiles[filename]) : null];
}));
export const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const currentPage = () => pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
function loadDrafts() {
  try { const data = JSON.parse(sessionStorage.getItem('common:drafts') || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([id, entry]) => entry && typeof entry === 'object' && (entry.message === undefined || (typeof entry.message === 'string' && entry.message.length <= 500)) && (!entry.draft || isDraft(entry.draft, entry.localOnly ? 'demo-family' : id)))) : {}; } catch { return {}; }
}
function ComingSoon({ page, navigate }) {
  return <section className="empty-page"><Icon name={page} /><h1>{page[0].toUpperCase() + page.slice(1)}</h1><p>This area is coming next. Start with a meal idea on Home; your current idea will stay there.</p><button className="button" onClick={() => navigate('home')}>Back to Home<Icon name="arrow" /></button></section>;
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [actorId, setActorId] = useState(initialWorkspace.actors[0].id);
  const [connection, setConnection] = useState('loading');
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState(loadDrafts);
  const [planDate, setPlanDate] = useState(today);
  const activeGroup = useRef(initialWorkspace.workspaceId);
  const hasLive = useRef(false);
  const pollRequest = useRef(0);
  const mainRef = useRef(null);
  const Feature = features[page];
  function onWorkspaceChange(next) {
    if (!isWorkspace(next, activeGroup.current)) throw new Error('The server returned an invalid group snapshot. The previous data is preserved.');
    ++pollRequest.current;
    setWorkspace(current => next.listRevision < current.listRevision ? current : next);
  }
  function navigate(next) { if (pages.includes(next)) location.hash = next; }
  useEffect(() => {
    const handle = () => setPage(currentPage());
    addEventListener('hashchange', handle);
    return () => removeEventListener('hashchange', handle);
  }, []);
  useEffect(() => { mainRef.current?.focus(); }, [page]);
  function updateEntry(id, entry) {
    setDrafts(current => {
      const next = { ...current, [id]: entry };
      try { sessionStorage.setItem('common:drafts', JSON.stringify(next)); } catch { /* In-memory drafts survive navigation if storage is blocked. */ }
      return next;
    });
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
        onWorkspaceChange(next); hasLive.current = true; setConnection('connected');
      } catch {
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
  const connected = connection === 'connected' && !switching;
  const featureProps = { workspace, actorId, api, onWorkspaceChange, navigate, notify: setNotice };
  return <div className="app-shell">
    <a className="skip-link" href="#content" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
    <aside className="sidebar"><a className="wordmark" href="#home" aria-label="Cartners Home">cartners<span>.</span></a><div className="sidebar-house"><Icon name="home" /><span>{workspace.groups.find(group => group.workspaceId === workspace.workspaceId)?.name || 'Your group'}</span></div><nav aria-label="Main navigation">{pages.map(id => <a key={id} href={`#${id}`} aria-current={page === id ? 'page' : undefined}><Icon name={id} /><span>{id[0].toUpperCase() + id.slice(1)}</span></a>)}</nav><div className="sidebar-footer"><Icon name="leaf" /><p>A little more together.</p><span>A shared table.<br />A lighter everyday.</span></div></aside>
    <div className="app-stage"><header className="topbar"><a className="mobile-wordmark" href="#home">cartners.</a><label className="group-control"><span className="sr-only">Active group</span><select value={workspace.workspaceId} disabled={!connected} onChange={e => changeGroup(e.target.value)}>{workspace.groups.map(group => <option key={group.workspaceId} value={group.workspaceId}>{group.name}</option>)}</select></label><div className="session-controls"><span className="connection-label">{connection === 'loading' ? 'Connecting…' : connection === 'connected' ? 'Connected' : connection === 'stale' ? 'Connection lost · showing last update' : 'Sample preview'}</span><label className="actor-control"><span className="sr-only">Demo person</span><span className="avatar" aria-hidden="true">{workspace.actors.find(actor => actor.id === actorId)?.name[0]}</span><select value={actorId} disabled={switching} onChange={e => setActorId(e.target.value)}>{workspace.actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label></div></header>
      <main id="content" ref={mainRef} tabIndex={-1} className="main-content">
        {connection === 'stale' && <p className="connection-note" role="status">{connection === 'loading' ? 'Checking for the shared backend…' : connection === 'stale' ? 'Updates are paused. Your last saved data is still visible; reconnect before making changes.' : 'Explore fixed samples while the backend is being built. Nothing here is live AI or a saved purchase.'}</p>}
        <div hidden={page !== 'home'}><Home key={workspace.workspaceId} {...featureProps} active={page === 'home'} connected={connected} entry={drafts[workspace.workspaceId]} onEntryChange={entry => updateEntry(workspace.workspaceId, entry)} planDate={planDate} onPlanDateChange={setPlanDate} /></div>
        {page !== 'home' && <Suspense fallback={<p role="status">Opening {page}…</p>}>{Feature ? <Feature key={workspace.workspaceId} {...featureProps} connected={connected} onPlanDateChange={setPlanDate} /> : <ComingSoon page={page} navigate={navigate} />}</Suspense>}
      </main><footer className="app-footer">Cartners · made for the things you share.<span>Demo household</span></footer>
    </div><div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div>
  </div>;
}
