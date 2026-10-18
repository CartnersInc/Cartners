import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Counts writes that are in flight anywhere in the app, so the sync status can say
// "Saving 2 changes…".
const PendingContext = createContext({ count: 0, begin: () => {}, end: () => {} });

export function PendingProvider({ children }) {
  const [count, setCount] = useState(0);
  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const value = useMemo(() => ({ count, begin, end }), [count, begin, end]);
  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

export const usePending = () => useContext(PendingContext);
