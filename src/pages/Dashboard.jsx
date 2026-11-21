import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { deleteResume, listResumes, newId, saveResume } from '../lib/store';
import { blankResume, sampleResume } from '../lib/resume';
import { TEMPLATES } from '../templates';
import ResumePages from '../components/ResumePages';
import { Avatar, Brand, DemoBanner, Icon, timeAgo } from '../components/ui';
import { UpdateStatus } from '../components/UpdateBanner';

export default function Dashboard() {
  const { user, signOut, demo } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [menu, setMenu] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listResumes(user.uid).then(setItems).catch((e) => { setError(e.message); setItems([]); });
  }, [user.uid]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  async function create(example = false) {
    const r = example ? sampleResume() : blankResume({ name: user.name, email: user.email });
    await saveResume(user.uid, r);
    navigate(`/app/edit/${r.id}`);
  }

  async function duplicate(r) {
    const copy = { ...structuredClone(r), id: newId(), title: `${r.title} (copy)` };
    await saveResume(user.uid, copy);
    setItems((xs) => [{ ...copy, updatedAt: Date.now() }, ...xs]);
  }

  async function remove(r) {
    await deleteResume(user.uid, r.id);
    setItems((xs) => xs.filter((x) => x.id !== r.id));
  }

  const firstName = (user.name || '').split(' ')[0];

  return (
    <>
      <DemoBanner />
      <nav className="nav">
        <div className="nav-in">
          <Brand to="/app" />
          <div className="nav-links">
            <span className="hide-xs"><UpdateStatus /></span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); navigate('/'); }}>
              {demo ? 'Exit demo' : 'Sign out'}
            </button>
            <Avatar user={user} />
          </div>
        </div>
      </nav>

      <main className="dash">
        <div className="dash-head">
          <div>
            <h1>{firstName ? `Welcome back, ${firstName}` : 'Your resumes'}</h1>
            <p>Create a new resume or pick up where you left off.</p>
          </div>
          <button className="btn btn-primary" onClick={() => create(false)}>{Icon.plus} New resume</button>
        </div>

        {error && <p style={{ color: '#dc2626' }}>Couldn’t load your resumes: {error}</p>}
        {items === null ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}><div className="spinner" /></div>
        ) : (
          <div className="grid-cards">
            <button className="newcard" onClick={() => create(false)}>
              <span className="plus">+</span>
              Start from scratch
              <small>Blank form, ready to fill</small>
            </button>
            {items.length === 0 && (
              <button className="newcard" onClick={() => create(true)}>
                <span className="plus" style={{ background: '#0f172a' }}>★</span>
                Start from an example
                <small>Edit a filled-in resume</small>
              </button>
            )}
            {items.map((r) => (
              <div key={r.id} className="rcard">
                <div className="thumbwrap" onClick={() => navigate(`/app/edit/${r.id}`)}>
                  <ResumePages resume={r} width={190} maxPages={1} gap={0} />
                </div>
                <div className="meta">
                  <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/app/edit/${r.id}`)}>
                    <div className="t">{r.title || 'Untitled resume'}</div>
                    <div className="d">{TEMPLATES[r.template]?.name} · Edited {timeAgo(r.updatedAt)}</div>
                  </div>
                  <button className="icon-btn" aria-label="More" onClick={(e) => { e.stopPropagation(); setConfirmDel(false); setMenu(menu === r.id ? null : r.id); }}>{Icon.dots}</button>
                </div>
                {menu === r.id && (
                  <div className="menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => navigate(`/app/edit/${r.id}`)}>Open</button>
                    <button onClick={() => { setMenu(null); duplicate(r); }}>Duplicate</button>
                    {confirmDel ? (
                      <button className="danger" onClick={() => { setMenu(null); remove(r); }}>Yes, delete forever</button>
                    ) : (
                      <button className="danger" onClick={() => setConfirmDel(true)}>Delete…</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
