import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { deleteResume, listResumes, newId, saveResume } from '../lib/store';
import { blankResume, sampleResume } from '../lib/resume';
import { TEMPLATES, TEMPLATE_KEYS } from '../templates';
import ResumePages from '../components/ResumePages';
import { Brand, DemoBanner, Icon, timeAgo } from '../components/ui';
import { UpdateStatus } from '../components/UpdateBanner';
import ProfileMenu, { ShareButton } from '../components/ProfileMenu';

export default function Dashboard() {
  const { user } = useAuth();
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

  const [creating, setCreating] = useState(null);
  async function create({ example = false, template } = {}) {
    if (creating) return;
    setCreating(template || (example ? 'example' : 'blank'));
    const r = example ? sampleResume() : blankResume({ name: user.name, email: user.email });
    if (template) { r.template = template; r.title = `${TEMPLATES[template].name} resume`; }
    try {
      await saveResume(user.uid, r);
      navigate(`/app/edit/${r.id}`);
    } catch (e) {
      setError(e.message);
      setCreating(null);
    }
  }

  // Template previews use example content with the user's own name where we have it.
  const preview = useMemo(() => {
    const r = sampleResume();
    if (user.name) r.data.personal.fullName = user.name;
    return r;
  }, [user.name]);
  const stripRef = useRef(null);
  const scrollStrip = (dir) => stripRef.current?.scrollBy({ left: dir * 520, behavior: 'smooth' });

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
            <ShareButton />
            <ProfileMenu />
          </div>
        </div>
      </nav>

      <main className="dash">
        <div className="dash-head">
          <div>
            <h1>{firstName ? `Welcome back, ${firstName}` : 'Your resumes'}</h1>
            <p>Create a new resume or pick up where you left off.</p>
          </div>
        </div>

        <section className="dash-section">
          <div className="dash-section-head">
            <h2>Start a new resume</h2>
            <div className="strip-nav">
              <button className="icon-btn" onClick={() => scrollStrip(-1)} aria-label="Scroll templates left">{Icon.back}</button>
              <button className="icon-btn" onClick={() => scrollStrip(1)} aria-label="Scroll templates right" style={{ transform: 'scaleX(-1)' }}>{Icon.back}</button>
            </div>
          </div>
          <div className="tpl-strip" ref={stripRef}>
            <button className={`tpl-card blank ${creating === 'blank' ? 'busy' : ''}`} onClick={() => create()} disabled={!!creating}>
              <div className="tpl-card-thumb blank-thumb"><span className="plus">+</span></div>
              <div className="tpl-card-name">Blank</div>
              <div className="tpl-card-desc">Start from scratch</div>
            </button>
            {TEMPLATE_KEYS.map((k) => (
              <button key={k} className={`tpl-card ${creating === k ? 'busy' : ''}`} onClick={() => create({ template: k })} disabled={!!creating}>
                <div className="tpl-card-thumb">
                  <ResumePages resume={{ ...preview, template: k }} width={150} maxPages={1} gap={0} />
                  <span className="tpl-card-cta">{creating === k ? 'Creating…' : 'Use template'}</span>
                </div>
                <div className="tpl-card-name">{TEMPLATES[k].name}</div>
                <div className="tpl-card-desc">{TEMPLATES[k].blurb}</div>
              </button>
            ))}
          </div>
        </section>

        <div className="dash-section-head" style={{ marginTop: 8 }}>
          <h2>Your resumes{items?.length ? <span className="count">{items.length}</span> : null}</h2>
        </div>

        {error && <p style={{ color: '#dc2626' }}>Couldn’t load your resumes: {error}</p>}
        {items === null ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}><div className="spinner" /></div>
        ) : (
          <div className="grid-cards">
            {items.length === 0 && (
              <button className="newcard" onClick={() => create({ example: true })} disabled={!!creating}>
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
