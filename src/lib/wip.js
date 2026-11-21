import { UPLOAD_LOCKED, WIP_PASSWORD } from '../config';

// Note: this only hides an unfinished feature from regular visitors; it is not real security.
// The unlock is remembered only for the current browser session (until the tab/browser is closed),
// so the password is asked for again in every new session.
const KEY = 'rk_wip_upload_unlocked';

export function isUploadUnlocked() {
  if (!UPLOAD_LOCKED) return true;
  try { return sessionStorage.getItem(KEY) === WIP_PASSWORD; } catch { return false; }
}

export function tryUnlockUpload(pw) {
  if (String(pw).trim() !== WIP_PASSWORD) return false;
  try { sessionStorage.setItem(KEY, WIP_PASSWORD); } catch { /* ignore */ }
  try { localStorage.removeItem(KEY); } catch { /* clear the old, permanent unlock */ }
  return true;
}
