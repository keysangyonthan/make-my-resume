// Lets the editor save unsaved work before the app signs out or reloads.
// The editor registers a function; others call beforeLeave() and wait for it.
let guard = null;

export function setLeaveGuard(fn) {
  guard = fn;
  return () => { if (guard === fn) guard = null; };
}

export async function beforeLeave() {
  return guard ? guard() : true;
}
