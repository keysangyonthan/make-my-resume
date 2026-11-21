import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { useAuth } from '../lib/auth';
import { getResume, saveResume } from '../lib/store';
import { useMinuteTick } from '../lib/version';
import { setLeaveGuard } from '../lib/leaveGuard';
import { BrandMark, Icon, Spinner, timeAgo } from '../components/ui';
import ProfileMenu from '../components/ProfileMenu';
import '../styles/doc.css';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MM = 96 / 25.4; // CSS pixels per millimetre
const PAGES = {
  A4: { label: 'A4', css: 'A4', w: 210, h: 297 },
  Letter: { label: 'US Letter', css: 'letter', w: 215.9, h: 279.4 },
};
const MARGIN = { y: 16, x: 18 }; // page margins in mm (screen and PDF)
const MAX_DOC_CHARS = 900 * 1024; // database limit is 1 MB per resume

const T = {
  undo: <path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3" />,
  ul: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  ol: <path d="M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5a1.5 1.5 0 013 0c0 1.5-3 2-3 4h3" />,
  left: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  center: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  right: <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
  link: <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />,
  clear: <path d="M4 7V4h16v3M9 20h6M12 4v16M3 3l18 18" />,
  hr: <path d="M3 12h18" />,
};
const TIcon = ({ d }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

function ToolButton({ on, disabled, onClick, title, children }) {
  return (
    <button type="button" className={`tb ${on ? 'on' : ''}`} disabled={disabled} title={title} aria-label={title} aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

function LinkPopover({ editor, onClose }) {
  const [url, setUrl] = useState(editor.getAttributes('link').href || '');
  const apply = () => {
    const v = url.trim();
    if (!v) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|tel:)/i.test(v) ? v : (v.includes('@') ? `mailto:${v}` : `https://${v}`) }).run();
    onClose();
  };
  return (
    <div className="link-pop" onMouseDown={(e) => e.stopPropagation()}>
      <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link or email"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') onClose(); }} />
      <button className="btn btn-primary btn-sm" onClick={apply}>Apply</button>
      {editor.isActive('link') && <button className="btn btn-ghost btn-sm" onClick={() => { editor.chain().focus().unsetLink().run(); onClose(); }}>Remove</button>}
    </div>
  );
}

function Toolbar({ editor, doc, setMeta }) {
  const [linkOpen, setLinkOpen] = useState(false);
  if (!editor) return null;
  const style = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
      : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';
  const setStyle = (v) => {
    const c = editor.chain().focus();
    if (v === 'p') c.setParagraph().run(); else c.setHeading({ level: Number(v[1]) }).run();
  };

  return (
    <div className="doc-toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton title="Undo (⌘Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><TIcon d={T.undo} /></ToolButton>
      <ToolButton title="Redo (⌘⇧Z)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><TIcon d={T.redo} /></ToolButton>
      <span className="tb-sep" />
      <select className="tb-select" value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Name / Title</option>
        <option value="h2">Section heading</option>
        <option value="h3">Subheading</option>
      </select>
      <span className="tb-sep" />
      <ToolButton title="Bold (⌘B)" on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolButton>
      <ToolButton title="Italic (⌘I)" on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i style={{ fontFamily: 'Georgia, serif' }}>I</i></ToolButton>
      <ToolButton title="Underline (⌘U)" on={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolButton>
      <span className="tb-wrap">
        <ToolButton title="Link" on={editor.isActive('link')} onClick={() => setLinkOpen((o) => !o)}><TIcon d={T.link} /></ToolButton>
        {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
      </span>
      <span className="tb-sep" />
      <ToolButton title="Bullet list" on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><TIcon d={T.ul} /></ToolButton>
      <ToolButton title="Numbered list" on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><TIcon d={T.ol} /></ToolButton>
      <span className="tb-sep" />
      <ToolButton title="Align left" on={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><TIcon d={T.left} /></ToolButton>
      <ToolButton title="Align center" on={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><TIcon d={T.center} /></ToolButton>
      <ToolButton title="Align right" on={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><TIcon d={T.right} /></ToolButton>
      <span className="tb-sep" />
      <ToolButton title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}><TIcon d={T.hr} /></ToolButton>
      <ToolButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><TIcon d={T.clear} /></ToolButton>
      <span className="tb-sep" />
      <div className="seg tb-seg" aria-label="Font">
        <button className={doc.font !== 'serif' ? 'on' : ''} onClick={() => setMeta({ font: 'sans' })}>Sans</button>
        <button className={doc.font === 'serif' ? 'on' : ''} onClick={() => setMeta({ font: 'serif' })} style={{ fontFamily: 'Georgia, serif' }}>Serif</button>
      </div>
      <div className="seg tb-seg" aria-label="Page size">
        {Object.entries(PAGES).map(([k, v]) => (
          <button key={k} className={(doc.pageSize || 'A4') === k ? 'on' : ''} onClick={() => setMeta({ pageSize: k })}>{v.label}</button>
        ))}
      </div>
    </div>
  );
}

export default function DocEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [savedAt, setSavedAt] = useState(null);
  const [manualDone, setManualDone] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [toast, setToast] = useState('');
  const [pages, setPages] = useState(1);
  const [contentH, setContentH] = useState(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const latest = useRef(null);
  const draftTimer = useRef(null);
  const leaveAnswer = useRef(null);
  const sheetRef = useRef(null);
  useMinuteTick();

  const DRAFT_KEY = `rk_draft_${user.uid}_${id}`;
  const writeDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    if (!dirty.current || !latest.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), resume: latest.current })); } catch { /* full */ }
  }, [DRAFT_KEY]);
  const clearDraft = useCallback(() => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }, [DRAFT_KEY]);

  const change = useCallback((fn) => {
    setDoc((d) => {
      const next = fn(d);
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setStatus('dirty');
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(writeDraft, 400);
  }, [writeDraft]);
  const setMeta = (patch) => change((d) => ({ ...d, ...patch }));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      LinkExt.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: null } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start typing your resume…' }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      Image.configure({ allowBase64: true }),
    ],
    content: '',
    editorProps: { attributes: { class: 'doc-content', spellcheck: 'true' } },
    onUpdate: ({ editor: ed }) => change((d) => ({ ...d, html: ed.getHTML() })),
  });

  // Load (restoring unsaved changes from a previous visit, if any)
  useEffect(() => {
    if (!editor) return;
    getResume(user.uid, id).then((server) => {
      if (!server) return navigate('/app', { replace: true });
      if (server.kind !== 'document') return navigate(`/app/edit/${id}`, { replace: true });
      let d = server;
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { /* ignore */ }
      if (draft?.resume && draft.at > (server.updatedAt || 0)) {
        d = { ...draft.resume, id: server.id };
        dirty.current = true;
        setStatus('dirty');
        setToast('We brought back changes you hadn’t saved yet. Click Save to keep them.');
      } else if (draft) clearDraft();
      latest.current = d;
      setDoc(d);
      setSavedAt(server.updatedAt || Date.now());
      editor.commands.setContent(d.html || '', false);
      if (d.importNote) {
        setToast(d.importNote);
        const cleaned = { ...d };
        delete cleaned.importNote;
        latest.current = cleaned;
        setDoc(cleaned);
        saveResume(user.uid, cleaned).catch(() => {});
      }
    }).catch(() => navigate('/app', { replace: true }));
  }, [editor, user.uid, id, navigate, DRAFT_KEY, clearDraft]);

  const flush = useCallback(async ({ force = false } = {}) => {
    if (!latest.current || (!dirty.current && !force)) return true;
    if (JSON.stringify(latest.current).length > MAX_DOC_CHARS) {
      setStatus('error');
      setToast('This document is too large to save — try removing a picture.');
      return false;
    }
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
    if (await flush({ force: true })) {
      setManualDone(true);
      setTimeout(() => setManualDone(false), 1600);
    }
  }, [flush]);

  const saveBeforeLeaving = useCallback(async () => {
    if (!dirty.current && !saving.current) return true;
    setLeaving('saving');
    const t0 = Date.now();
    while (saving.current) await sleep(50);
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

  useEffect(() => setLeaveGuard(saveBeforeLeaving), [saveBeforeLeaving]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (dirty.current || saving.current) && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    let live = true;
    saveBeforeLeaving().then((go) => { if (live) { if (go) blocker.proceed(); else blocker.reset(); } });
    return () => { live = false; };
  }, [blocker.state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  useEffect(() => {
    const onUnload = (e) => { if (!dirty.current) return; writeDraft(); flush(); e.preventDefault(); e.returnValue = ''; };
    const onHide = () => { if (document.visibilityState === 'hidden' && dirty.current) { writeDraft(); flush(); } };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onHide);
      if (dirty.current) { writeDraft(); flush(); }
    };
  }, [flush, writeDraft]);

  // Page-break guides: measure the text height and compare with one page's usable height.
  const page = PAGES[doc?.pageSize] || PAGES.A4;
  const usable = (page.h - MARGIN.y * 2) * MM;
  useEffect(() => {
    const el = sheetRef.current?.querySelector('.doc-content');
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setContentH(el.scrollHeight);
      setPages(Math.max(1, Math.ceil((el.scrollHeight - 2) / usable)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor, doc?.pageSize, usable, doc !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  async function exportPdf() {
    await flush();
    if (import.meta.env.MODE === 'demo') {
      setToast('This is a preview link, where printing is blocked. Export PDF works on the real site.');
      return;
    }
    const prev = document.title;
    document.title = (doc.title || 'Resume').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Resume';
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setToast('In the print dialog, set Destination to “Save as PDF”, then click Save.');
    setTimeout(() => window.print(), 150);
  }

  if (!doc) return <Spinner />;

  const statusText = {
    saved: savedAt ? `Saved ${timeAgo(savedAt)}` : 'Saved',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    error: 'Couldn’t save — try again',
  }[status];
  const fontClass = doc.font === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div className="editor doc-editor">
      <header className="ebar">
        <Link to="/app" className="icon-btn" title="All resumes" style={{ width: 'auto', padding: '0 6px', gap: 6, display: 'inline-flex', alignItems: 'center' }}>
          {Icon.back}<BrandMark size={26} />
        </Link>
        <input className="title-input" value={doc.title} onChange={(e) => setMeta({ title: e.target.value })} aria-label="Resume name" />
        <div className="spacer" />
        <span className={`save-state ${status} hide-sm`} title={savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : undefined} aria-live="polite">
          <span className="s-dot" />{statusText}
        </span>
        <button className={`btn btn-white btn-sm save-btn ${manualDone ? 'done' : ''} ${status === 'dirty' || status === 'error' ? 'needs-save' : ''}`}
          onClick={saveNow} disabled={status === 'saving'} title="Save now (⌘S / Ctrl+S)" aria-label="Save">
          {manualDone ? Icon.check : Icon.save}
          <span className="hide-xs">{status === 'saving' ? 'Saving…' : manualDone ? 'Saved' : 'Save'}</span>
        </button>
        <button className="btn btn-primary btn-sm" onClick={exportPdf} title="Export PDF" aria-label="Export PDF">{Icon.download}<span className="hide-xs">Export PDF</span></button>
        <span className="hide-sm"><ProfileMenu /></span>
      </header>

      <Toolbar editor={editor} doc={doc} setMeta={setMeta} />

      <div className="doc-canvas" onMouseDown={(e) => { if (e.target === e.currentTarget) editor?.chain().focus('end').run(); }}>
        <div className="doc-meta">
          <span>{pages === 1 ? '1 page' : `About ${pages} pages`} · {page.label}</span>
        </div>
        <div ref={sheetRef} className={`doc-sheet ${fontClass}`}
          style={{ '--page-w': `${page.w}mm`, '--pad-y': `${MARGIN.y}mm`, '--pad-x': `${MARGIN.x}mm` }}>
          <EditorContent editor={editor} />
          {Array.from({ length: Math.max(0, Math.ceil(contentH / usable) - 1) }, (_, i) => (
            <div key={i} className="page-guide" style={{ top: `calc(var(--pad-y) + ${(i + 1) * usable}px)` }}>
              <span>Page {i + 2}</span>
            </div>
          ))}
        </div>
        <p className="doc-tip">Tip: click anywhere in the page to edit. Use the toolbar for headings, bold text and bullet lists.</p>
      </div>

      {document.getElementById('print-root') && createPortal(
        <>
          <style>{`@page { size: ${page.css}; margin: ${MARGIN.y}mm ${MARGIN.x}mm; }`}</style>
          <div className={`doc-print ${fontClass}`}>
            <div className="doc-content" dangerouslySetInnerHTML={{ __html: doc.html || '' }} />
          </div>
        </>,
        document.getElementById('print-root'),
      )}

      {leaving && (
        <div className="leave-overlay" role="alertdialog" aria-live="assertive" aria-label="Saving your resume">
          <div className="leave-card">
            {leaving === 'saving' && (<><div className="spinner" /><h3>Saving your resume…</h3><p>Hang on a second — we’re saving your latest changes before you go.</p></>)}
            {leaving === 'saved' && (<><div className="leave-check">{Icon.check}</div><h3>All changes saved</h3><p>Your resume is safe. You can pick up where you left off anytime.</p></>)}
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

      {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')}>Got it</button></div>}
    </div>
  );
}
