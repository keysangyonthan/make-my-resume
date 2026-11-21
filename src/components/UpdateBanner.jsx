import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMinuteTick, useVersion } from '../lib/version';
import { timeAgo } from './ui';

const isEditor = (path) => path.startsWith('/app/edit/');

// Small "Updated x min ago" badge for top bars. Turns into a Refresh button
// when a newer version is live.
export function UpdateStatus() {
  const { current, updateAvailable, refresh } = useVersion();
  useMinuteTick();
  if (updateAvailable) {
    return (
      <button type="button" className="upd-pill new" onClick={refresh} title="A newer version of the site is live">
        <span className="upd-dot" /> New update · Refresh
      </button>
    );
  }
  const when = new Date(current.builtAt);
  return (
    <Link to="/changelog" className="upd-pill" title={`Last updated ${when.toLocaleString()} — see what’s new`}>
      <span className="upd-dot" /> Updated {timeAgo(when.getTime())}
    </Link>
  );
}

// Floating notice when a new version is live. Outside the editor, a tab that was
// in the background reloads by itself when you come back to it.
export default function UpdateBanner() {
  const { updateAvailable, refresh } = useVersion();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!updateAvailable) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isEditor(pathRef.current)) window.location.reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [updateAvailable]);

  if (!updateAvailable || dismissed) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version of the site is available.</span>
      <Link to="/changelog" className="update-link">What’s new</Link>
      <button className="btn btn-white btn-sm" onClick={refresh}>Refresh</button>
      <button className="update-x" onClick={() => setDismissed(true)} aria-label="Later">✕</button>
    </div>
  );
}
