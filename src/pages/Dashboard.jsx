import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { deleteResume, listResumes, newId, saveResume } from '../lib/store';
import { blankResume, sampleResume } from '../lib/resume';
import { TEMPLATES, TEMPLATE_KEYS } from '../templates';
import ResumePages from '../components/ResumePages';
import DocThumb from '../components/DocThumb';
import { importResumeFile } from '../lib/importResume';
import { isUploadUnlocked } from '../lib/wip';
import WipGate from '../components/WipGate';
import { Brand, DemoBanner, Icon, timeAgo } from '../components/ui';
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
    // Templates (and "Start from an example") open with example content to edit,
    // personalised with the user's own name and email. "Blank" starts empty.
    const withExample = example || !!template;
    const r = withExample ? sampleResume() : blankResume({ name: user.name, email: user.email });
    if (withExample) {
      if (user.name) r.data.personal.fullName = user.name;
      if (user.email) r.data.personal.email = user.email;
      r.exampleContent = true;
    }
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
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(null); // null | { name } | { error }
  const [dragOver, setDragOver] = useState(false);
  const [unlocked, setUnlocked] = useState(isUploadUnlocked);
  const [gate, setGate] = useState(false);
  const pickFile = () => (unlocked ? fileRef.current?.click() : setGate(true));

  // Upload a PDF / Word / text resume → editable document.
  async function upload(file) {
    if (!file || importing?.name) return;
    setImporting({ name: file.name });
    try {
      const { html, title, warnings } = await importResumeFile(file);
      const doc = {
        id: newId(),
        kind: 'document',
        title,
        html,
        font: 'sans',
        pageSize: 'A4',
        sourceName: file.name,
        importNote: warnings.length
          ? `Imported “${file.name}”. ${warnings.join(' ')}`
          : `Imported “${file.name}”. Click anywhere on the page to edit.`,
      };
      await saveResume(user.uid, doc);
      navigate(`/app/doc/${doc.id}`);
    } catch (e) {
      setImporting({ error: e?.message || 'Something went wrong reading that file. Please try another one.' });
    }
  }
  const openPath = (r) => (r.kind === 'document' ? `/app/doc/${r.id}` : `/app/edit/${r.id}`);
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
            <button
              className={`tpl-card upload ${dragOver ? 'drag' : ''}`}
              onClick={pickFile}
              disabled={!!creating || !!importing?.name}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (unlocked) upload(e.dataTransfer.files?.[0]); else setGate(true); }}
            >
              <div className="tpl-card-thumb upload-thumb">
                {!unlocked && <span className="wip-chip">🔒 Work in progress</span>}
                <span className="up-ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                </span>
                <span className="up-types">PDF · Word</span>
              </div>
              <div className="tpl-card-name">Upload resume</div>
              <div className="tpl-card-desc">{unlocked ? 'Edit your own file directly' : 'Coming soon'}</div>
            </button>
            <input ref={fileRef} type="file" hidden
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
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
                <div className="thumbwrap" onClick={() => navigate(openPath(r))}>
                  {r.kind === 'document'
                    ? <DocThumb html={r.html} font={r.font} width={190} />
                    : <ResumePages resume={r} width={190} maxPages={1} gap={0} />}
                </div>
                <div className="meta">
                  <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(openPath(r))}>
                    <div className="t">{r.title || 'Untitled resume'}</div>
                    <div className="d">{r.kind === 'document' ? 'Uploaded document' : TEMPLATES[r.template]?.name} · Edited {timeAgo(r.updatedAt)}</div>
                  </div>
                  <button className="icon-btn" aria-label="More" onClick={(e) => { e.stopPropagation(); setConfirmDel(false); setMenu(menu === r.id ? null : r.id); }}>{Icon.dots}</button>
                </div>
                {menu === r.id && (
                  <div className="menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => navigate(openPath(r))}>Open</button>
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

      {gate && (
        <WipGate onClose={() => setGate(false)} onUnlock={() => { setUnlocked(true); setGate(false); setTimeout(() => fileRef.current?.click(), 50); }} />
      )}

      {importing && (
        <div className="leave-overlay" role="alertdialog" aria-live="assertive">
          <div className="leave-card">
            {importing.name ? (
              <>
                <div className="spinner" />
                <h3>Reading your resume…</h3>
                <p>Turning “{importing.name}” into an editable document. This takes a few seconds.</p>
              </>
            ) : (
              <>
                <div className="leave-warn">!</div>
                <h3>Couldn’t open that file</h3>
                <p>{importing.error}</p>
                <div className="leave-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setImporting(null)}>Close</button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setImporting(null); pickFile(); }}>Choose another file</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
