import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getResume, saveResume } from '../lib/store';
import {
  SECTION_LABELS, emptyCustom, emptyEducation, emptyExperience, emptyProject, emptySkill,
} from '../lib/resume';
import { PAGE_SIZES } from '../templates';
import CustomiseLook from '../components/CustomiseLook';
import ProfileMenu from '../components/ProfileMenu';
import ResumePages from '../components/ResumePages';
import { ItemList, SectionCard, TextArea, TextInput } from '../components/FormParts';
import { BrandMark, Icon, Spinner, timeAgo } from '../components/ui';
import { useMinuteTick } from '../lib/version';
import { setLeaveGuard } from '../lib/leaveGuard';

const HINTS = {
  summary: 'Two or three sentences about who you are and what you’re great at.',
  experience: 'Most recent first. One achievement per line — numbers help.',
  education: 'Degrees, diplomas, bootcamps or certifications.',
  skills: 'Group related skills, separated by commas.',
  projects: 'Side projects, open source, portfolio pieces.',
  custom: 'Languages, awards, volunteering, interests — anything else.',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [savedAt, setSavedAt] = useState(null);
  const [manualDone, setManualDone] = useState(false);
  const [leaving, setLeaving] = useState(null); // null | saving | saved | error — the "saving before you go" overlay
  const [lookOpen, setLookOpen] = useState(false);
  const [tab, setTab] = useState('edit');
  const [pageCount, setPageCount] = useState(1);
  const [toast, setToast] = useState('');
  const [previewW, setPreviewW] = useState(560);
  const previewRef = useRef(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const latest = useRef(null);
  const draftTimer = useRef(null);
  const leaveAnswer = useRef(null);
  useMinuteTick();

  // A copy of unsaved changes is kept in this browser (not in the database),
  // so nothing is lost even if the tab closes before saving.
  const DRAFT_KEY = `rk_draft_${user.uid}_${id}`;
  const writeDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    if (!dirty.current || !latest.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), resume: latest.current })); } catch { /* storage full/blocked */ }
  }, [DRAFT_KEY]);
  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, [DRAFT_KEY]);

  // Load (and restore unsaved changes from a previous visit, if any)
  useEffect(() => {
    getResume(user.uid, id).then((server) => {
      if (!server) return navigate('/app', { replace: true });
      let r = server;
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { /* ignore */ }
      if (draft?.resume && draft.at > (server.updatedAt || 0)) {
        r = { ...draft.resume, id: server.id };
        dirty.current = true;
        setStatus('dirty');
        setToast('We brought back changes you hadn’t saved yet. Click Save to keep them.');
      } else if (draft) {
        clearDraft();
      }
      setResume(r);
      setSavedAt(server.updatedAt || Date.now());
      latest.current = r;
    }).catch(() => navigate('/app', { replace: true }));
  }, [user.uid, id, navigate, DRAFT_KEY, clearDraft]);

  // Saves to the database. Happens only when you click Save / press ⌘S,
  // export a PDF, or leave the editor — not while you type.
  const flush = useCallback(async ({ force = false } = {}) => {
    if (!latest.current || (!dirty.current && !force)) return true;
    dirty.current = false;
    saving.current = true;
    setStatus('saving');
    try {
      await saveResume(user.uid, latest.current);
      setSavedAt(Date.now());
      if (dirty.current) setStatus('dirty'); else { setStatus('saved'); clearDraft(); }
      return true;
    } catch {
      dirty.current = true;
      setStatus('error');
      writeDraft();
      return false;
    } finally {
      saving.current = false;
    }
  }, [user.uid, clearDraft, writeDraft]);

  const saveNow = useCallback(async () => {
    const ok = await flush({ force: true });
    if (ok) {
      setManualDone(true);
      setTimeout(() => setManualDone(false), 1600);
    }
  }, [flush]);

  // Shown when leaving with unsaved changes: "Saving your resume…" → "All changes saved".
  // Resolves true to continue leaving, false to stay.
  const saveBeforeLeaving = useCallback(async () => {
    if (!dirty.current && !saving.current) return true;
    setLeaving('saving');
    const t0 = Date.now();
    while (saving.current) await sleep(50); // let a save already in progress finish
    const ok = await flush();
    await sleep(Math.max(0, 450 - (Date.now() - t0)));
    if (!ok) {
      setLeaving('error');
      return new Promise((resolve) => { leaveAnswer.current = resolve; });
    }
    setLeaving('saved');
    await sleep(700);
    setLeaving(null);
    return true;
  }, [flush]);

  function answerLeave(choice) {
    if (choice === 'retry') {
      setLeaving('saving');
      flush().then(async (ok) => {
        if (!ok) { setLeaving('error'); return; }
        setLeaving('saved');
        await sleep(700);
        setLeaving(null);
        leaveAnswer.current?.(true);
      });
      return;
    }
    setLeaving(null);
    leaveAnswer.current?.(choice === 'leave');
  }

  // Let sign-out / "Refresh" elsewhere in the app save first.
  useEffect(() => setLeaveGuard(saveBeforeLeaving), [saveBeforeLeaving]);

  // In-app navigation (back arrow, browser Back, menu links): pause, save, then continue.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (dirty.current || saving.current) && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    let live = true;
    saveBeforeLeaving().then((go) => {
      if (!live) return;
      if (go) blocker.proceed(); else blocker.reset();
    });
    return () => { live = false; };
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+S / Ctrl+S saves instead of opening the browser's "Save page" dialog.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  const change = useCallback((fn) => {
    setResume((r) => {
      const next = fn(r);
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setStatus('dirty');
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(writeDraft, 400);
  }, [writeDraft]);

  // Leaving the website itself (closing the tab, typing another address, switching apps):
  // keep the local copy and save to the database.
  useEffect(() => {
    const onUnload = (e) => {
      if (!dirty.current) return;
      writeDraft();
      flush();
      e.preventDefault();
      e.returnValue = '';
    };
    const onHide = () => { if (document.visibilityState === 'hidden' && dirty.current) { writeDraft(); flush(); } };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onHide);
      if (dirty.current) { writeDraft(); flush(); }
    };
  }, [flush, writeDraft]);

  // Fit preview to available width
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setPreviewW(Math.max(240, Math.min(entry.contentRect.width, 860))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [resume === null, tab]);

  const deferredRaw = useDeferredValue(resume);
  const deferred = deferredRaw || resume;
  useToastTimeout(toast, setToast);

  if (!resume) return <Spinner />;

  const data = resume.data;
  const setMeta = (patch) => change((r) => ({ ...r, ...patch }));
  const setData = (key, value) => change((r) => ({ ...r, data: { ...r.data, [key]: value } }));
  const setPersonal = (k) => (v) => change((r) => ({ ...r, data: { ...r.data, personal: { ...r.data.personal, [k]: v } } }));
  const p = data.personal;

  const order = resume.sectionOrder;
  const moveSection = (k, d) => {
    const i = order.indexOf(k);
    const n = [...order];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setMeta({ sectionOrder: n });
  };
  const toggleHidden = (k) =>
    setMeta({ hidden: resume.hidden.includes(k) ? resume.hidden.filter((x) => x !== k) : [...resume.hidden, k] });

  async function exportPdf() {
    await flush();
    if (import.meta.env.MODE === 'demo') {
      setToast('This is a preview link, where printing is blocked. Export PDF works when you run the site.');
      return;
    }
    const prev = document.title;
    const name = (resume.title || p.fullName || 'Resume').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Resume';
    document.title = name;
    setToast('In the print dialog, set Destination to “Save as PDF”, then click Save.');
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => { window.print(); }, 150);
  }

  const sectionTools = (k) => {
    const i = order.indexOf(k);
    const hidden = resume.hidden.includes(k);
    return (
      <>
        <button className="icon-btn" title="Move section up" disabled={i === 0} onClick={() => moveSection(k, -1)}>{Icon.up}</button>
        <button className="icon-btn" title="Move section down" disabled={i === order.length - 1} onClick={() => moveSection(k, 1)}>{Icon.down}</button>
        <button className="icon-btn" title={hidden ? 'Show on resume' : 'Hide from resume'} onClick={() => toggleHidden(k)}>{hidden ? Icon.eyeOff : Icon.eye}</button>
      </>
    );
  };

  const renderSection = (k) => {
    const common = { title: SECTION_LABELS[k], hint: HINTS[k], tools: sectionTools(k), hidden: resume.hidden.includes(k) };
    switch (k) {
      case 'summary':
        return (
          <SectionCard {...common}>
            <TextArea value={data.summary} onChange={(v) => setData('summary', v)} rows={4}
              placeholder="e.g. Product designer with 7+ years of experience building consumer apps used by millions…" />
          </SectionCard>
        );
      case 'experience':
        return (
          <SectionCard {...common}>
            <ItemList items={data.experience} onChange={(v) => setData('experience', v)} create={emptyExperience}
              addLabel="Add experience"
              summary={(e) => [e.role || e.company, [e.role && e.company, e.start && `${e.start} – ${e.current ? 'Present' : e.end || ''}`].filter(Boolean).join(' · ')]}
              render={(e, set) => (
                <div className="grid2">
                  <TextInput label="Job title" value={e.role} onChange={(v) => set({ role: v })} placeholder="Product Designer" />
                  <TextInput label="Company" value={e.company} onChange={(v) => set({ company: v })} placeholder="Acme Inc." />
                  <TextInput label="Start date" value={e.start} onChange={(v) => set({ start: v })} placeholder="Jan 2022" />
                  <div>
                    {!e.current && <TextInput label="End date" value={e.end} onChange={(v) => set({ end: v })} placeholder="Dec 2023" />}
                    {e.current && <TextInput label="End date" value="Present" onChange={() => {}} />}
                    <label className="check"><input type="checkbox" checked={!!e.current} onChange={(ev) => set({ current: ev.target.checked })} /> I currently work here</label>
                  </div>
                  <TextInput full label="Location" optional value={e.location} onChange={(v) => set({ location: v })} placeholder="Bengaluru / Remote" />
                  <TextArea label="What did you do?" value={e.bullets} onChange={(v) => set({ bullets: v })} rows={5}
                    help="Each line becomes a bullet point."
                    placeholder={'Led the redesign of onboarding, lifting retention by 18%\nMentored 4 designers'} />
                </div>
              )} />
          </SectionCard>
        );
      case 'education':
        return (
          <SectionCard {...common}>
            <ItemList items={data.education} onChange={(v) => setData('education', v)} create={emptyEducation}
              addLabel="Add education"
              summary={(e) => [e.degree || e.school, [e.degree && e.school, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')]}
              render={(e, set) => (
                <div className="grid2">
                  <TextInput label="Degree / course" value={e.degree} onChange={(v) => set({ degree: v })} placeholder="B.Tech, Computer Science" />
                  <TextInput label="School / university" value={e.school} onChange={(v) => set({ school: v })} placeholder="IIT Delhi" />
                  <TextInput label="Start" optional value={e.start} onChange={(v) => set({ start: v })} placeholder="2016" />
                  <TextInput label="End" value={e.end} onChange={(v) => set({ end: v })} placeholder="2020" />
                  <TextInput full label="Location" optional value={e.location} onChange={(v) => set({ location: v })} placeholder="New Delhi" />
                  <TextArea label="Details" optional value={e.details} onChange={(v) => set({ details: v })} rows={3}
                    help="Grades, honours, relevant coursework — one per line." placeholder="CGPA 8.9 / 10" />
                </div>
              )} />
          </SectionCard>
        );
      case 'skills':
        return (
          <SectionCard {...common}>
            <ItemList items={data.skills} onChange={(v) => setData('skills', v)} create={emptySkill}
              addLabel="Add skill group"
              summary={(s) => [s.label || (s.items ? 'Skills' : ''), s.items]}
              render={(s, set) => (
                <div className="grid2">
                  <TextInput full label="Group name" optional value={s.label} onChange={(v) => set({ label: v })} placeholder="Languages, Tools, Design…" />
                  <TextArea label="Skills" value={s.items} onChange={(v) => set({ items: v })} rows={2}
                    help="Separate with commas." placeholder="Figma, Prototyping, User research" />
                </div>
              )} />
          </SectionCard>
        );
      case 'projects':
        return (
          <SectionCard {...common}>
            <ItemList items={data.projects} onChange={(v) => setData('projects', v)} create={emptyProject}
              addLabel="Add project"
              summary={(e) => [e.name, e.link]}
              render={(e, set) => (
                <div className="grid2">
                  <TextInput label="Project name" value={e.name} onChange={(v) => set({ name: v })} placeholder="Portfolio website" />
                  <TextInput label="Link" optional value={e.link} onChange={(v) => set({ link: v })} placeholder="github.com/you/project" />
                  <TextInput label="Start" optional value={e.start} onChange={(v) => set({ start: v })} placeholder="2023" />
                  <TextInput label="End" optional value={e.end} onChange={(v) => set({ end: v })} placeholder="2024" />
                  <TextArea label="Description" value={e.bullets} onChange={(v) => set({ bullets: v })} rows={3}
                    help="Each line becomes a bullet point." placeholder="Built with React and Firebase; 2k monthly users" />
                </div>
              )} />
          </SectionCard>
        );
      case 'custom':
        return (
          <SectionCard {...common}>
            <ItemList items={data.custom} onChange={(v) => setData('custom', v)} create={emptyCustom}
              addLabel="Add a section"
              summary={(c) => [c.title, c.content.split('\n')[0]]}
              render={(c, set) => (
                <div className="grid2">
                  <TextInput full label="Section title" value={c.title} onChange={(v) => set({ title: v })} placeholder="Languages / Awards / Volunteering" />
                  <TextArea label="Content" value={c.content} onChange={(v) => set({ content: v })} rows={3}
                    help="A single line shows as text; multiple lines become bullet points." placeholder="English (fluent), Hindi (native)" />
                </div>
              )} />
          </SectionCard>
        );
      default:
        return null;
    }
  };
  const renderKeyed = (k) => <div key={k} style={{ display: 'contents' }}>{renderSection(k)}</div>;

  const statusText = {
    saved: savedAt ? `Saved ${timeAgo(savedAt)}` : 'Saved',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    error: 'Couldn’t save — try again',
  }[status];

  return (
    <div className="editor">
      <header className="ebar">
        <Link to="/app" className="icon-btn" title="All resumes" style={{ width: 'auto', padding: '0 6px', gap: 6, display: 'inline-flex', alignItems: 'center' }}>
          {Icon.back}<BrandMark size={26} />
        </Link>
        <input className="title-input" value={resume.title} onChange={(e) => setMeta({ title: e.target.value })} aria-label="Resume name" />
        <div className="spacer" />
        <div className="seg mobile-tabs">
          <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>Edit</button>
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>Preview</button>
        </div>
        <span className={`save-state ${status} hide-sm`} title={savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : undefined} aria-live="polite">
          <span className="s-dot" />{statusText}
        </span>
        <button className={`btn btn-white btn-sm save-btn ${manualDone ? 'done' : ''} ${status === 'dirty' || status === 'error' ? 'needs-save' : ''}`} onClick={saveNow} disabled={status === 'saving'}
          title="Save now (⌘S / Ctrl+S)" aria-label="Save">
          {manualDone ? Icon.check : Icon.save}
          <span className="hide-xs">{status === 'saving' ? 'Saving…' : manualDone ? 'Saved' : 'Save'}</span>
        </button>
        <button className="btn btn-primary btn-sm" onClick={exportPdf} title="Export PDF" aria-label="Export PDF">{Icon.download}<span className="hide-xs">Export PDF</span></button>
        <span className="hide-sm"><ProfileMenu /></span>
      </header>

      <div className="ebody" data-tab={tab}>
        <div className="eform">
          <div className="eform-in">
            <CustomiseLook resume={resume} preview={deferred} setMeta={setMeta} pageCount={pageCount} open={lookOpen} setOpen={setLookOpen} />
            <SectionCard title={SECTION_LABELS.personal} hint="How employers will reach you." className="head-card">
              <div className="grid2">
                <TextInput label="Full name" value={p.fullName} onChange={setPersonal('fullName')} placeholder="Priya Sharma" />
                <TextInput label="Headline" optional value={p.headline} onChange={setPersonal('headline')} placeholder="Senior Product Designer" />
                <TextInput label="Email" type="email" value={p.email} onChange={setPersonal('email')} placeholder="you@email.com" />
                <TextInput label="Phone" type="tel" optional value={p.phone} onChange={setPersonal('phone')} placeholder="+91 98765 43210" />
                <TextInput label="Location" optional value={p.location} onChange={setPersonal('location')} placeholder="City, Country" />
                <TextInput label="Website" optional value={p.website} onChange={setPersonal('website')} placeholder="yourname.com" />
                <TextInput full label="LinkedIn" optional value={p.linkedin} onChange={setPersonal('linkedin')} placeholder="linkedin.com/in/yourname" />
              </div>
            </SectionCard>
            {order.map(renderKeyed)}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <button className="btn btn-primary btn-lg" onClick={exportPdf}>{Icon.download} Export PDF</button>
            </div>
          </div>
        </div>

        <div className="epreview">
          <div className="page-count"><span>{pageCount} {pageCount === 1 ? 'page' : 'pages'} · {PAGE_SIZES[resume.pageSize]?.label}</span></div>
          <div ref={previewRef} style={{ width: '100%' }}>
            <ResumePages resume={deferred} width={previewW} print onPageCount={setPageCount} />
          </div>
        </div>
      </div>

      {leaving && (
        <div className="leave-overlay" role="alertdialog" aria-live="assertive" aria-label="Saving your resume">
          <div className="leave-card">
            {leaving === 'saving' && (
              <>
                <div className="spinner" />
                <h3>Saving your resume…</h3>
                <p>Hang on a second — we’re saving your latest changes before you go.</p>
              </>
            )}
            {leaving === 'saved' && (
              <>
                <div className="leave-check">{Icon.check}</div>
                <h3>All changes saved</h3>
                <p>Your resume is safe. You can pick up where you left off anytime.</p>
              </>
            )}
            {leaving === 'error' && (
              <>
                <div className="leave-warn">!</div>
                <h3>Couldn’t save right now</h3>
                <p>You may be offline. Your changes are kept on this device and will come back the next time you open this resume.</p>
                <div className="leave-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => answerLeave('stay')}>Stay here</button>
                  <button className="btn btn-white btn-sm" onClick={() => answerLeave('leave')}>Leave anyway</button>
                  <button className="btn btn-primary btn-sm" onClick={() => answerLeave('retry')}>Try again</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">{toast}<button onClick={() => setToast('')}>Got it</button></div>
      )}
    </div>
  );
}

function useToastTimeout(toast, setToast) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 7000);
    return () => clearTimeout(t);
  }, [toast, setToast]);
}
