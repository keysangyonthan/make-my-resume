import { Link } from 'react-router-dom';
import { CHANGELOG } from '../changelog';
import { useAuth } from '../lib/auth';
import { useMinuteTick, useVersion } from '../lib/version';
import { Brand, timeAgo } from '../components/ui';
import { UpdateStatus } from '../components/UpdateBanner';
import { APP_NAME } from '../config';

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function Changelog() {
  const { user } = useAuth();
  const { current, latest, updateAvailable, refresh } = useVersion();
  useMinuteTick();
  const built = new Date(current.builtAt);

  // Group entries by date for the timeline.
  const groups = [];
  CHANGELOG.forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  });

  return (
    <>
      <nav className="nav">
        <div className="nav-in">
          <Brand to={user ? '/app' : '/'} />
          <div className="nav-links">
            <UpdateStatus />
            <Link className="btn btn-primary" to={user ? '/app' : '/'}>{user ? 'My resumes' : 'Home'}</Link>
          </div>
        </div>
      </nav>

      <main className="clog">
        <header className="clog-head">
          <span className="pill">Changelog</span>
          <h1>What’s new in {APP_NAME}</h1>
          <p>Every feature and improvement, newest first.</p>
        </header>

        <div className={`live-card ${updateAvailable ? 'stale' : ''}`}>
          <div className="live-dot" />
          <div className="live-text">
            {updateAvailable ? (
              <>
                <b>A newer version is live.</b>
                <span>You’re viewing the version from {built.toLocaleString()}. Refresh to get the latest{latest?.message ? `: “${latest.message.split('\n')[0]}”` : '.'}</span>
              </>
            ) : (
              <>
                <b>You’re on the latest version.</b>
                <span>
                  Last updated {timeAgo(built.getTime())} · {built.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  {current.message ? <> · “{current.message.split('\n')[0]}”</> : null}
                </span>
              </>
            )}
          </div>
          {updateAvailable && <button className="btn btn-primary btn-sm" onClick={refresh}>Refresh</button>}
        </div>

        <div className="timeline">
          {groups.map((g) => (
            <section key={g.date} className="tl-day">
              <div className="tl-date">{fmtDate(g.date)}</div>
              <div className="tl-entries">
                {g.items.map((e) => (
                  <article key={e.version} className="tl-entry">
                    <div className="tl-meta">
                      <span className={`tl-tag ${e.tag.toLowerCase()}`}>{e.tag}</span>
                      <span className="tl-ver">v{e.version}</span>
                    </div>
                    <h2>{e.title}</h2>
                    <ul>{e.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <footer className="foot">© {new Date().getFullYear()} {APP_NAME}</footer>
    </>
  );
}
