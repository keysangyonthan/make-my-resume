import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/* global __BUILD_ID__, __BUILD_TIME__, __BUILD_MSG__ */
// Baked in at build time (see vite.config.js).
export const CURRENT = {
  version: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev',
  builtAt: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
  message: typeof __BUILD_MSG__ !== 'undefined' ? __BUILD_MSG__ : '',
};

const CHECK_EVERY_MS = 60 * 1000;
const VersionContext = createContext({ current: CURRENT, latest: null, updateAvailable: false, refresh: () => {} });

// Polls /version.json (written by every build) to learn when a newer version is live.
export function VersionProvider({ children }) {
  const [latest, setLatest] = useState(null);

  const check = useCallback(async () => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'demo') return;
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setLatest(await res.json());
    } catch { /* offline — try again later */ }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [check]);

  const updateAvailable = Boolean(latest?.version && latest.version !== CURRENT.version);
  const refresh = () => window.location.reload();

  return (
    <VersionContext.Provider value={{ current: CURRENT, latest, updateAvailable, refresh }}>
      {children}
    </VersionContext.Provider>
  );
}

export const useVersion = () => useContext(VersionContext);

// Re-render every minute so "x min ago" labels stay fresh.
export function useMinuteTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);
}
