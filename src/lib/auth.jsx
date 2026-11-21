import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { getProfile, saveProfile } from './store';

const AuthContext = createContext(null);
const DEMO_KEY = 'rk_demo_user';
const mapUser = (u) => (u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null);

// Combine the Google account with the user's own profile edits.
// profile.photo: undefined = use Google photo, '' = no photo, 'data:…' = uploaded photo.
function withProfile(base, profile = {}) {
  if (!base) return null;
  return {
    ...base,
    googleName: base.name,
    googlePhoto: base.photo,
    name: profile.name?.trim() || base.name,
    photo: profile.photo !== undefined ? profile.photo : base.photo,
    profile,
  };
}

function readDemoUser() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  // Load the saved profile and merge it in (keeps the Google values as a fallback).
  async function hydrate(base) {
    if (!base) return setUser(null);
    setUser((prev) => (prev && prev.uid === base.uid ? prev : withProfile(base)));
    try {
      const profile = await getProfile(base.uid);
      setUser(withProfile(base, profile));
    } catch {
      setUser(withProfile(base));
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) { hydrate(readDemoUser()); return undefined; }
    return onAuthStateChanged(auth, (u) => hydrate(mapUser(u)));
  }, []);

  async function updateProfile(changes) {
    if (!user) return;
    const profile = { ...(user.profile || {}), ...changes };
    delete profile.updatedAt;
    await saveProfile(user.uid, profile);
    setUser(withProfile({ uid: user.uid, name: user.googleName, email: user.email, photo: user.googlePhoto, demo: user.demo }, profile));
  }

  async function signIn() {
    if (!isFirebaseConfigured) {
      const demo = { uid: 'demo', name: '', email: '', photo: '', demo: true };
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch { /* storage unavailable */ }
      await hydrate(demo);
      return demo;
    }
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const u = mapUser(res.user);
      await hydrate(u);
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
    <AuthContext.Provider value={{ user, loading: user === undefined, signIn, signOut, updateProfile, demo: !isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
