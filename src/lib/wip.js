import { UPLOAD_LOCKED, WIP_PASSWORD } from '../config';

// Note: this only hides an unfinished feature from regular visitors; it is not real security.
const KEY = 'rk_wip_upload_unlocked';

export function isUploadUnlocked() {
  if (!UPLOAD_LOCKED) return true;
  try { return localStorage.getItem(KEY) === WIP_PASSWORD; } catch { return false; }
}

export function tryUnlockUpload(pw) {
  if (String(pw).trim() !== WIP_PASSWORD) return false;
  try { localStorage.setItem(KEY, WIP_PASSWORD); } catch { /* ignore */ }
  return true;
}
