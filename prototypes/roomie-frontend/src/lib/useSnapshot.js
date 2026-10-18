import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// Polls the group's shared snapshot. Every tab and phone sees the same data this way.
//
// - Switching groups never shows the previous group's data: anything stored for
//   another group is hidden, and late responses from the old group are ignored.
// - offsetMs is the difference between the server clock and this device's clock,
//   so countdowns are based on server timestamps, not a timer started locally.
// - After a failed poll, the last good data stays visible and `error` explains why.
export function useSnapshot(groupId, { intervalMs = 3000 } = {}) {
  const [state, setState] = useState({ groupId: null, data: null, error: null, lastOkAt: null, offsetMs: 0 });
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    const ticket = ++latest.current;
    const sentAt = Date.now();
    try {
      const data = await api.getSnapshot(groupId);
      if (ticket !== latest.current) return; // superseded by a newer request or a group switch
      const receivedAt = Date.now();
      setState({
        groupId,
        data,
        error: null,
        lastOkAt: receivedAt,
        offsetMs: Date.parse(data.server_time) - (sentAt + receivedAt) / 2,
      });
    } catch (error) {
      if (ticket !== latest.current) return;
      setState((s) => (s.groupId === groupId
        ? { ...s, error }
        : { groupId, data: null, error, lastOkAt: null, offsetMs: 0 }));
    }
  }, [groupId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    const wake = () => refresh();
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      latest.current++; // ignore any response still in flight for this group
    };
  }, [refresh, intervalMs]);

  const current = state.groupId === groupId;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    lastOkAt: current ? state.lastOkAt : null,
    offsetMs: current ? state.offsetMs : 0,
    refresh,
  };
}

// Re-renders every `ms` so countdowns and "updated 20s ago" stay current.
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
