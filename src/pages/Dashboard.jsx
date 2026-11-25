import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { deleteResume, listResumes, newId, saveResume } from '../lib/store';
import { blankResume, sampleResume } from '../lib/resume';
import { TEMPLATES, TEMPLATE_KEYS, templateSample } from '../templates';
import ResumePages from '../components/ResumePages';
import DocThumb from '../components/DocThumb';
import { importResumeFile } from '../lib/importResume';
import { isUploadUnlocked } from '../lib/wip';
import { UPLOAD_VISIBLE } from '../config';
import WipGate from '../components/WipGate';
import Modal from '../components/Modal';
import { LinkedInCard, linkedInOf } from '../components/LinkedIn';
import { resumeDataFromLinkedIn } from '../lib/linkedin';
import { Brand, DemoBanner, Icon, timeAgo } from '../components/ui';
import ProfileMenu, { ShareButton } from '../components/ProfileMenu';

// How a template looks in the library: its own accent color, section order and example extras.
function tplPreview(base, k, linked) {
  const t = TEMPLATES[k];
  return {
    ...base,
    template: k,
    ...(t.accent ? { accent: t.accent } : {}),
    ...(t.order ? { sectionOrder: t.order } : {}),
    ...(linked ? {} : { data: templateSample(base.data, k) }),
  };
}

export default function Dashboard() {
  const { user, updateProfile } = useAuth();
  // One favourite resume per person, saved on their profile.
  const favId = user.profile?.favoriteResume || null;
  const [favBusy, setFavBusy] = useState(false);
  const [replaceFav, setReplaceFav] = useState(null); // resume waiting for "replace favourite?" confirmation
  function starClicked(r) {
    if (favId && favId !== r.id && items?.some((x) => x.id === favId)) setReplaceFav(r);
    else toggleFavorite(r);
  }
  async function toggleFavorite(r) {
    if (favBusy) return;
    setFavBusy(true);
    try { await updateProfile({ favoriteResume: favId === r.id ? null : r.id }); } finally { setFavBusy(false); }
  }
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
    // If LinkedIn details are imported, templates are filled from LinkedIn instead.
    const withExample = example || !!template;
    const li = linkedInOf(user);
    const r = withExample ? sampleResume() : blankResume({ name: user.name, email: user.email });
    if (template && li) {
      r.data = resumeDataFromLinkedIn(li.data);
      if (!r.data.personal.fullName && user.name) r.data.personal.fullName = user.name;
      if (!r.data.personal.email && user.email) r.data.personal.email = user.email;
      r.notice = 'linkedin';
    } else if (withExample) {
      if (user.name) r.data.personal.fullName = user.name;
      if (user.email) r.data.personal.email = user.email;
      r.exampleContent = true;
    }
    if (template) {
      const t = TEMPLATES[template];
      r.template = template;
      r.title = `${t.name} resume`;
      if (t.accent) r.accent = t.accent;
      if (t.order) r.sectionOrder = [...t.order];
      if (r.exampleContent) r.data = templateSample(r.data, template);
    }
    try {
      await saveResume(user.uid, r);
      navigate(`/app/edit/${r.id}`);
    } catch (e) {
      setError(e.message);
      setCreating(null);
    }
  }

  // Picked a style on the home page before signing in? Open it straight away.
  const [params, setParams] = useSearchParams();
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    let k = params.get('template');
    try { k = k || sessionStorage.getItem('mmr_start_template'); sessionStorage.removeItem('mmr_start_template'); } catch { /* ignore */ }
    if (!k || !TEMPLATES[k]) return;
    autoStarted.current = true;
    setParams({}, { replace: true });
    create({ template: k });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Template previews use example content with the user's own name where we have it.
  const linked = linkedInOf(user);
  const preview = useMemo(() => {
    const r = sampleResume();
    if (linked) r.data = resumeDataFromLinkedIn(linked.data);
    else if (user.name) r.data.personal.fullName = user.name;
    return r;
  }, [user.name, linked]);
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
    if (favId === r.id) updateProfile({ favoriteResume: null }).catch(() => {});
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

        <LinkedInCard />

        <section className="dash-section">
          <div className="dash-section-head">
            <h2>Start a new resume{linked && <span className="li-tag">Using your LinkedIn</span>}</h2>
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
            {UPLOAD_VISIBLE && (
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
            )}
            <input ref={fileRef} type="file" hidden
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
            {TEMPLATE_KEYS.map((k) => (
              <button key={k} className={`tpl-card ${creating === k ? 'busy' : ''}`} onClick={() => create({ template: k })} disabled={!!creating}>
                <div className="tpl-card-thumb">
                  <ResumePages resume={tplPreview(preview, k, !!linked)} width={150} maxPages={1} gap={0} />
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
            {[...items].sort((a, b) => (b.id === favId) - (a.id === favId)).map((r) => (
              <div key={r.id} className={`rcard ${r.id === favId ? 'fav' : ''}`}>
                <button
                  className={`star-btn ${r.id === favId ? 'on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); starClicked(r); }}
                  title={r.id === favId ? 'Remove from favourite' : 'Make this your favourite'}
                  aria-label={r.id === favId ? 'Remove from favourite' : 'Make this your favourite'}
                  aria-pressed={r.id === favId}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={r.id === favId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" /></svg>
                </button>
                {r.id === favId && <span className="fav-badge">Favourite</span>}
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

      {replaceFav && (
        <Modal
          title="Replace your favourite?"
          onClose={() => setReplaceFav(null)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setReplaceFav(null)}>Keep current</button>
              <button className="btn btn-primary" onClick={() => { toggleFavorite(replaceFav); setReplaceFav(null); }}>⭐ Make this my favourite</button>
            </>
          )}
        >
          <p className="fav-confirm">
            You can have <b>one favourite resume</b>. Starring <b>“{replaceFav.title || 'Untitled resume'}”</b> will remove the star from <b>“{items.find((x) => x.id === favId)?.title || 'your current favourite'}”</b>.
          </p>
        </Modal>
      )}

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
