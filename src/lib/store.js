// Data layer: Firestore when configured, localStorage otherwise (demo mode).
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, orderBy, query, serverTimestamp,
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
