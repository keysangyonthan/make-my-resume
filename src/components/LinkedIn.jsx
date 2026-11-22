import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { readLinkedInPdf } from '../lib/linkedin';
import Modal from './Modal';

export const LinkedInLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect width="24" height="24" rx="5" fill="#0A66C2" />
    <path fill="#fff" d="M7.1 9.6h2.3V17H7.1zM8.25 6a1.33 1.33 0 110 2.66 1.33 1.33 0 010-2.66zM10.9 9.6h2.2v1h.03c.31-.58 1.06-1.2 2.18-1.2 2.33 0 2.76 1.53 2.76 3.53V17h-2.3v-3.6c0-.86-.02-1.96-1.2-1.96-1.2 0-1.38.93-1.38 1.9V17h-2.3z" />
  </svg>
);

export const linkedInOf = (user) => (user?.profile?.linkedin?.data ? user.profile.linkedin : null);

function Summary({ data }) {
  const p = data.personal || {};
  return (
    <div className="li-review">
      <div className="li-person">
        <b>{p.fullName || 'Name not found'}</b>
        {p.headline && <span>{p.headline}</span>}
        {p.location && <span className="muted">{p.location}</span>}
      </div>
      <div className="li-grid">
        <div>
          <h4>Experience <em>{data.experience.length}</em></h4>
          <ul>{data.experience.slice(0, 4).map((e) => <li key={e.id}><b>{e.role}</b>{e.company && ` · ${e.company}`}</li>)}</ul>
          {data.experience.length > 4 && <span className="muted">+{data.experience.length - 4} more</span>}
        </div>
        <div>
          <h4>Education <em>{data.education.length}</em></h4>
          <ul>{data.education.slice(0, 3).map((e) => <li key={e.id}><b>{e.school}</b>{e.degree && ` · ${e.degree}`}</li>)}</ul>
        </div>
        <div>
          <h4>Also found</h4>
          <ul>
            {data.summary && <li>Summary</li>}
            {data.skills[0]?.items && <li>Skills: {data.skills[0].items}</li>}
            {data.custom.map((c) => <li key={c.id}>{c.title}</li>)}
            {data.personal.email && <li>Email</li>}
            {data.personal.linkedin && <li>LinkedIn link</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// A tiny picture of a LinkedIn profile showing where "Save to PDF" is.
function MiniLinkedIn() {
  return (
    <div className="mini-li" aria-hidden>
      <div className="mini-cover" />
      <div className="mini-av" />
      <div className="mini-lines"><i /><i /></div>
      <div className="mini-btns">
        <span className="pill blue">Open to</span>
        <span className="pill">Add section</span>
        <span className="pill hl">Resources ▾
          <span className="mini-menu">
            <span className="hl2">⬇ Save to PDF</span>
            <span>About this profile</span>
          </span>
        </span>
      </div>
    </div>
  );
}

// Step-by-step "Link LinkedIn": download your profile PDF from LinkedIn, upload it, review, link.
export function LinkedInModal({ onClose }) {
  const { updateProfile } = useAuth();
  const [state, setState] = useState({ step: 'upload' }); // upload | reading | review | saving
  const [drag, setDrag] = useState(false);
  const [opened, setOpened] = useState(false); // clicked "Open my LinkedIn profile"
  const [back, setBack] = useState(false); // came back to this tab after opening LinkedIn
  const fileRef = useRef(null);

  // When the person comes back from the LinkedIn tab, point them at the upload box.
  useEffect(() => {
    if (!opened) return undefined;
    const onBack = () => { if (document.visibilityState === 'visible') setBack(true); };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => { document.removeEventListener('visibilitychange', onBack); window.removeEventListener('focus', onBack); };
  }, [opened]);

  async function read(file) {
    if (!file) return;
    setState({ step: 'reading', fileName: file.name });
    try {
      const data = await readLinkedInPdf(file);
      setState({ step: 'review', data, fileName: file.name });
    } catch (e) {
      setState({ step: 'upload', error: e?.message || 'We couldn’t read that file. Please try again.' });
    }
  }

  async function link() {
    setState((s) => ({ ...s, step: 'saving' }));
    try {
      await updateProfile({ linkedin: { data: state.data, linkedAt: Date.now(), fileName: state.fileName } });
      onClose(true);
    } catch (e) {
      setState((s) => ({ ...s, step: 'review', error: e?.code === 'permission-denied' ? 'Couldn’t save — the database rules need updating.' : 'Couldn’t save. Please try again.' }));
    }
  }

  const footer = state.step === 'review' || state.step === 'saving'
    ? (
      <>
        <button className="btn btn-ghost" onClick={() => setState({ step: 'upload' })} disabled={state.step === 'saving'}>Choose another file</button>
        <button className="btn btn-primary" onClick={link} disabled={state.step === 'saving'}>{state.step === 'saving' ? 'Linking…' : 'Link LinkedIn'}</button>
      </>
    )
    : null;

  return (
    <Modal
      title="Link your LinkedIn"
      subtitle="Fill every template with your own experience, education and skills."
      onClose={() => onClose(false)}
      footer={footer}
    >
      {(state.step === 'upload' || state.step === 'reading') && (
        <>
          <div className="li-two">
            {/* Step 1 — get the PDF */}
            <div className={`li-stepcard ${opened ? 'done' : ''}`}>
              <div className="li-stephead"><span className="n">{opened ? '✓' : '1'}</span>Get your PDF from LinkedIn</div>
              <a className="btn li-btn li-big" href="https://www.linkedin.com/in/me/" target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
                <LinkedInLogo size={18} /> Open my LinkedIn profile ↗
              </a>
              <p className="li-hint">On your profile, click <b>Resources</b> (sometimes called <b>More</b>) → <b>Save to PDF</b>.</p>
              <MiniLinkedIn />
            </div>
            {/* Step 2 — upload it */}
            <div className={`li-stepcard ${opened ? 'next' : ''}`}>
              <div className="li-stephead"><span className="n">2</span>Upload it here</div>
              <button
                type="button"
                className={`li-drop ${drag ? 'drag' : ''} ${back ? 'pulse' : ''}`}
                onClick={() => fileRef.current?.click()}
                disabled={state.step === 'reading'}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files?.[0]); }}
              >
                {state.step === 'reading'
                  ? (<><div className="spinner" /><span>Reading {state.fileName}…</span></>)
                  : (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                      <b>{back ? 'Got it? Upload Profile.pdf' : 'Upload Profile.pdf'}</b>
                      <span>It’s in your Downloads folder. Click to choose, or drag it here.</span>
                    </>
                  )}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; read(f); }} />
            </div>
          </div>
          {state.error && <p className="form-error">{state.error}</p>}
          <p className="li-note">LinkedIn doesn’t let other websites download your profile for you, so it takes these two quick clicks. Use a computer — LinkedIn’s phone app doesn’t have Save to PDF. Your file is read in your browser and you can unlink anytime.</p>
        </>
      )}
      {(state.step === 'review' || state.step === 'saving') && (
        <>
          <p className="li-lead">Here’s what we found. Templates will use these details:</p>
          <Summary data={state.data} />
          {state.error && <p className="form-error">{state.error}</p>}
        </>
      )}
    </Modal>
  );
}

// Card on the Your resumes page.
export function LinkedInCard() {
  const { user, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);
  const li = linkedInOf(user);

  async function unlink() {
    setBusy(true);
    try { await updateProfile({ linkedin: null }); } finally { setBusy(false); setConfirmUnlink(false); }
  }

  return (
    <section className={`li-card ${li ? 'linked' : ''}`}>
      <LinkedInLogo size={36} />
      <div className="li-card-text">
        {li ? (
          <>
            <b>LinkedIn linked{li.data.personal?.fullName ? ` · ${li.data.personal.fullName}` : ''}</b>
            <span>
              {li.data.experience.length} job{li.data.experience.length === 1 ? '' : 's'} · {li.data.education.length} school{li.data.education.length === 1 ? '' : 's'}
              {li.data.skills[0]?.items ? ` · ${li.data.skills[0].items.split(',').length} skills` : ''} — templates below now use your details.
            </span>
          </>
        ) : (
          <>
            <b>Link your LinkedIn</b>
            <span>Fill every template with your own experience, education and skills — in about a minute.</span>
          </>
        )}
      </div>
      <div className="li-card-actions">
        {li ? (
          confirmUnlink ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmUnlink(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-white btn-sm danger-text" onClick={unlink} disabled={busy}>{busy ? 'Unlinking…' : 'Yes, unlink'}</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Update</button>
              <button className="btn btn-white btn-sm" onClick={() => setConfirmUnlink(true)}>Unlink</button>
            </>
          )
        ) : (
          <button className="btn btn-primary btn-sm li-btn" onClick={() => setOpen(true)}>Link LinkedIn</button>
        )}
      </div>
      {open && <LinkedInModal onClose={() => setOpen(false)} />}
    </section>
  );
}
