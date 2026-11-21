// Data layer: Firestore when configured, localStorage otherwise (demo mode).
import {
  addDoc, collection, doc, getDoc, getDocs, setDoc, deleteDoc, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const LS_KEY = (uid) => `rk_resumes_${uid}`;
const lsRead = (uid) => { try { return JSON.parse(localStorage.getItem(LS_KEY(uid))) || {}; } catch { return {}; } };
const lsWrite = (uid, all) => { try { localStorage.setItem(LS_KEY(uid), JSON.stringify(all)); } catch { /* quota */ } };

const col = (uid) => collection(db, 'users', uid, 'resumes');
const toMillis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : t || Date.now());

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 20);

export async function listResumes(uid) {
  if (!isFirebaseConfigured) {
    return Object.values(lsRead(uid)).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const snap = await getDocs(query(col(uid), orderBy('updatedAt', 'desc')));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id, updatedAt: toMillis(d.data().updatedAt) }));
}

export async function getResume(uid, id) {
  if (!isFirebaseConfigured) return lsRead(uid)[id] || null;
  const d = await getDoc(doc(col(uid), id));
  return d.exists() ? { ...d.data(), id: d.id, updatedAt: toMillis(d.data().updatedAt) } : null;
}

export async function saveResume(uid, resume) {
  if (!isFirebaseConfigured) {
    const all = lsRead(uid);
    all[resume.id] = { ...resume, updatedAt: Date.now() };
    lsWrite(uid, all);
    return;
  }
  const { id, ...rest } = resume;
  await setDoc(doc(col(uid), id), { ...rest, updatedAt: serverTimestamp() });
}

export async function deleteResume(uid, id) {
  if (!isFirebaseConfigured) {
    const all = lsRead(uid);
    delete all[id];
    lsWrite(uid, all);
    return;
  }
  await deleteDoc(doc(col(uid), id));
}

// ── Profile (custom name + photo), stored at users/{uid} ──
const PROFILE_KEY = (uid) => `rk_profile_${uid}`;

export async function getProfile(uid) {
  if (!isFirebaseConfigured) {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY(uid))) || {}; } catch { return {}; }
  }
  const d = await getDoc(doc(db, 'users', uid));
  return d.exists() ? d.data().profile || {} : {};
}

export async function saveProfile(uid, profile) {
  if (!isFirebaseConfigured) {
    try { localStorage.setItem(PROFILE_KEY(uid), JSON.stringify(profile)); } catch { /* quota */ }
    return;
  }
  await setDoc(doc(db, 'users', uid), { profile: { ...profile, updatedAt: serverTimestamp() } }, { merge: true });
}

// ── Feedback from the "Contact me" form, stored at feedback/{autoId} ──
// Visitors can only add messages; nobody can read them from the website.
// Read them in Firebase → Firestore → Data → feedback.
export async function submitFeedback({ kind, name, email, message, uid }) {
  const entry = {
    kind: String(kind || 'other').slice(0, 20),
    name: String(name || '').trim().slice(0, 100),
    email: String(email || '').trim().slice(0, 200),
    message: String(message || '').trim().slice(0, 2000),
    uid: uid || '',
    page: window.location.pathname.slice(0, 100),
  };
  if (!isFirebaseConfigured) {
    try {
      const all = JSON.parse(localStorage.getItem('rk_feedback_demo') || '[]');
      all.push({ ...entry, createdAt: Date.now() });
      localStorage.setItem('rk_feedback_demo', JSON.stringify(all));
    } catch { /* ignore */ }
    return;
  }
  await addDoc(collection(db, 'feedback'), { ...entry, createdAt: serverTimestamp() });
}
