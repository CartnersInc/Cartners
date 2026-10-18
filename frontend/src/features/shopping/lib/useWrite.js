import { useRef, useState } from 'react';

// True when the request may or may not have reached the server: no response,
// timeout, 429/5xx, or the server marked it retryable. Retrying must reuse the requestId.
export function isUncertain(err) {
  if (err?.payload?.error?.retryable === true) return true;
  return !err?.status || err.status === 429 || err.status >= 500;
}

// One write at a time for one form or control.
// - Adds workspaceId, actorId and a requestId to the body.
// - Retrying the same input reuses the same requestId, so the server can return the original action.
// - After an uncertain failure, `locked` is true: callers keep the input and only offer Try again or Discard.
// - Any server snapshot (success, or the fresh state in a 409) goes to onWorkspaceChange.
export function useWrite({ api, workspace, actorId, onWorkspaceChange }) {
  const attempt = useRef(null);
  const busy = useRef(false);
  const lastError = useRef(null);
  const [state, setState] = useState({ phase: 'idle', error: '', code: '', status: 0, retryable: false, payload: null });

  function apply(next) {
    if (!next) return;
    try { onWorkspaceChange(next); } catch { /* The shell keeps the previous snapshot and the next poll refreshes it. */ }
  }

  async function send(path, method, fields) {
    if (busy.current) return null;
    const input = { workspaceId: workspace.workspaceId, actorId, ...fields };
    const key = `${method} ${path} ${JSON.stringify(input)}`;
    if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID() };
    busy.current = true;
    setState({ phase: 'saving', error: '', code: '', status: 0, retryable: false, payload: null });
    try {
      const result = await api.request(path, { method, body: { ...input, requestId: attempt.current.requestId } });
      attempt.current = null;
      apply(result?.workspace);
      setState({ phase: 'saved', error: '', code: '', status: 200, retryable: false, payload: null });
      return result || {};
    } catch (err) {
      lastError.current = err;
      const retryable = isUncertain(err);
      if (!retryable) attempt.current = null;
      apply(err?.payload?.workspace);
      setState({ phase: 'error', error: err?.message || 'Something went wrong.', code: err?.code || '', status: err?.status || 0, retryable, payload: err?.payload || null });
      return null;
    } finally {
      busy.current = false;
    }
  }

  function reset() {
    attempt.current = null;
    setState({ phase: 'idle', error: '', code: '', status: 0, retryable: false, payload: null });
  }

  return {
    state, send, reset,
    getLastError: () => lastError.current,
    saving: state.phase === 'saving',
    locked: state.phase === 'saving' || (state.phase === 'error' && state.retryable),
  };
}
