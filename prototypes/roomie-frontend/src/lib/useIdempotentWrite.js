import { useRef, useState } from "react";
import { newIdempotencyKey } from "./api.js";
import { usePending } from "./pending.jsx";

// Runs a write with an idempotency key.
// - Retrying the same payload reuses the same key, so the server can recognize the replay.
// - A different payload gets a new key.
// - After an uncertain failure (retryable), callers lock their inputs so the person can
//   only retry the same request or discard it. Editing then resubmitting could
//   otherwise save the same thing twice.
export function useIdempotentWrite() {
  const attempt = useRef({ key: null, fingerprint: null });
  const lastError = useRef(null);
  const pending = usePending();
  const [state, setState] = useState({ phase: "idle", error: null, retryable: false, replayed: false, conflict: null });

  async function submit(writeFn, payload) {
    const fingerprint = JSON.stringify(payload);
    if (attempt.current.fingerprint !== fingerprint) {
      attempt.current = { key: newIdempotencyKey(), fingerprint };
    }
    setState({ phase: "saving", error: null, retryable: false, replayed: false, conflict: null });
    pending.begin();
    try {
      const result = await writeFn(payload, attempt.current.key);
      attempt.current = { key: null, fingerprint: null };
      setState({ phase: "saved", error: null, retryable: false, replayed: result.replayed, conflict: null });
      return result;
    } catch (err) {
      lastError.current = err;
      const retryable = err?.retryable === true;
      if (!retryable) attempt.current = { key: null, fingerprint: null };
      setState({
        phase: "error",
        error: err?.message || "Something went wrong.",
        retryable,
        replayed: false,
        conflict: err?.status === 409 ? err.data || {} : null,
      });
      return null;
    } finally {
      pending.end();
    }
  }

  function reset() {
    attempt.current = { key: null, fingerprint: null };
    setState({ phase: "idle", error: null, retryable: false, replayed: false, conflict: null });
  }

  return { state, submit, reset, getLastError: () => lastError.current, locked: state.phase === "saving" || (state.phase === "error" && state.retryable) };
}
