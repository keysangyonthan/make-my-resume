import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getResume, saveResume } from '../lib/store';
import {
  SECTION_LABELS, emptyCustom, emptyEducation, emptyExperience, emptyProject, emptySkill,
} from '../lib/resume';
import { PAGE_SIZES } from '../templates';
import CustomiseLook from '../components/CustomiseLook';
import { UpdateStatus } from '../components/UpdateBanner';
import ResumePages from '../components/ResumePages';
import { ItemList, SectionCard, TextArea, TextInput } from '../components/FormParts';
import { BrandMark, Icon, Spinner } from '../components/ui';

const HINTS = {
  summary: 'Two or three sentences about who you are and what you’re great at.',
  experience: 'Most recent first. One achievement per line — numbers help.',
  education: 'Degrees, diplomas, bootcamps or certifications.',
  skills: 'Group related skills, separated by commas.',
  projects: 'Side projects, open source, portfolio pieces.',
  custom: 'Languages, awards, volunteering, interests — anything else.',
};

export default function Editor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [status, setStatus] = useState('saved');
  const [lookOpen, setLookOpen] = useState(false);
  const [tab, setTab] = useState('edit');
  const [pageCount, setPageCount] = useState(1);
  const [toast, setToast] = useState('');
  const [previewW, setPreviewW] = useState(560);
  const previewRef = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(null);
  const timer = useRef(null);

  // Load
  useEffect(() => {
    getResume(user.uid, id).then((r) => {
      if (!r) return navigate('/app', { replace: true });
      setResume(r);
      latest.current = r;
    }).catch(() => navigate('/app', { replace: true }));
  }, [user.uid, id, navigate]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    setStatus('saving');
    try {
      await saveResume(user.uid, latest.current);
      setStatus(dirty.current ? 'saving' : 'saved');
    } catch {
      dirty.current = true;
      setStatus('error');
    }
  }, [user.uid]);

  const change = useCallback((fn) => {
    setResume((r) => {
      const next = fn(r);
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }, [flush]);

  // Save on leave
  useEffect(() => {
    const onUnload = (e) => { if (dirty.current) { flush(); e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('beforeunload', onUnload); flush(); };
  }, [flush]);

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

  function openLook() {
    const next = !lookOpen;
    setLookOpen(next);
    if (next) {
      setTab('edit');
      requestAnimationFrame(() => document.getElementById('customise-look')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  const statusText = { saved: 'Saved', saving: 'Saving…', error: 'Not saved — retrying' }[status];

  return (
    <div className="editor">
      <header className="ebar">
        <Link to="/app" className="icon-btn" title="All resumes" style={{ width: 'auto', padding: '0 6px', gap: 6, display: 'inline-flex', alignItems: 'center' }}>
          {Icon.back}<BrandMark size={26} />
        </Link>
        <input className="title-input" value={resume.title} onChange={(e) => setMeta({ title: e.target.value })} aria-label="Resume name" />
        <span className={`save-state ${status} hide-sm`}><span className="s-dot" />{statusText}</span>
        <span className="hide-sm"><UpdateStatus /></span>
        <div className="spacer" />
        <div className="seg mobile-tabs">
          <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>Edit</button>
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>Preview</button>
        </div>
        <button className={`btn btn-sm ${lookOpen ? 'btn-white' : 'btn-ghost'}`} onClick={openLook} aria-expanded={lookOpen}>
          {Icon.layout}<span className="hide-sm">Customise look</span>
        </button>
        <button className="btn btn-primary btn-sm" onClick={exportPdf} title="Export PDF" aria-label="Export PDF">{Icon.download}<span className="hide-xs">Export PDF</span></button>
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
