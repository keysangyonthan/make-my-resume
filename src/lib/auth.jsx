import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';

const AuthContext = createContext(null);
const DEMO_KEY = 'rk_demo_user';
const mapUser = (u) => (u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null);

function readDemoUser() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => {
    if (!isFirebaseConfigured) { setUser(readDemoUser()); return; }
    return onAuthStateChanged(auth, (u) => setUser(mapUser(u)));
  }, []);

  async function signIn() {
    if (!isFirebaseConfigured) {
      const demo = { uid: 'demo', name: '', email: '', photo: '', demo: true };
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch { /* storage unavailable */ }
      setUser(demo);
      return demo;
    }
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const u = mapUser(res.user);
      setUser(u);
      return u;
    } catch (err) {
      // Popups are blocked on some mobile browsers — fall back to a full-page redirect.
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
        try { sessionStorage.setItem('rk_after_login', '1'); } catch { /* ignore */ }
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return null;
      throw err;
    }
  }

  async function signOut() {
    if (!isFirebaseConfigured) {
      try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
      setUser(null);
      return;
    }
    await fbSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading: user === undefined, signIn, signOut, demo: !isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
