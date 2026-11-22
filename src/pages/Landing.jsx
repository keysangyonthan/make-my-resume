import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME, CREATOR_NAME } from '../config';
import { useAuth } from '../lib/auth';
import { sampleResume } from '../lib/resume';
import { TEMPLATES, TEMPLATE_KEYS } from '../templates';
import ResumePages from '../components/ResumePages';
import { BrandMark, DemoBanner, GoogleIcon, Wordmark } from '../components/ui';
import ProfileMenu from '../components/ProfileMenu';
import FeedbackModal from '../components/FeedbackModal';
import { LinkedInLogo, linkedInOf } from '../components/LinkedIn';
import { resumeDataFromLinkedIn } from '../lib/linkedin';

// The example resume shown on this page — the visitor's own LinkedIn details when they've imported them.
function useShowcaseResume() {
  const { user } = useAuth();
  const li = linkedInOf(user);
  return useMemo(() => {
    const r = sampleResume();
    if (li) r.data = resumeDataFromLinkedIn(li.data);
    return r;
  }, [li]);
}
import '../styles/landing.css';

function useStart() {
  const { user, signIn, demo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setError('');
    if (user) return navigate('/app');
    setBusy(true);
    try {
      const u = await signIn();
      if (u) navigate('/app');
    } catch (e) {
      setError(e?.message || 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { start, busy, error, user, demo };
}

// Fade sections in as they scroll into view.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.ap-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function CTA({ label, light = false, ctx }) {
  const { start, busy, user, demo } = ctx;
  return (
    <button className={`ap-btn ${light ? 'light' : ''}`} onClick={start} disabled={busy}>
      {!user && !demo && <span className="ap-g"><GoogleIcon /></span>}
      {busy ? 'Signing in…' : user ? 'Open my resumes' : label}
    </button>
  );
}

// Three styles fanned out like paper on a desk.
function HeroFan() {
  const base = useShowcaseResume();
  return (
    <div className="ap-fan" aria-hidden>
      <div className="ap-sheet left"><ResumePages resume={{ ...base, template: 'classic', accent: '#111827' }} width={300} maxPages={1} gap={0} /></div>
      <div className="ap-sheet right"><ResumePages resume={{ ...base, template: 'sidebar', accent: '#0f766e' }} width={300} maxPages={1} gap={0} /></div>
      <div className="ap-sheet front"><ResumePages resume={base} width={340} maxPages={1} gap={0} /></div>
    </div>
  );
}

// A small editor window: the name types itself and the preview follows.
const NAMES = ['Priya Sharma', 'Arjun Mehta', 'Sara Thomas'];
function LiveDemo() {
  const base = useMemo(() => sampleResume(), []);
  const [text, setText] = useState('');
  const state = useRef({ n: 0, i: 0, dir: 1, wait: 0 });

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setText(NAMES[0]); return undefined; }
    const t = setInterval(() => {
      const s = state.current;
      const name = NAMES[s.n];
      if (s.wait > 0) { s.wait -= 1; return; }
      s.i += s.dir;
      if (s.i >= name.length) { s.dir = -1; s.wait = 18; }
      if (s.i <= 0) { s.dir = 1; s.n = (s.n + 1) % NAMES.length; s.wait = 4; }
      setText(name.slice(0, Math.max(0, s.i)));
    }, 90);
    return () => clearInterval(t);
  }, []);

  // Fit the preview page to the space available (narrow on phones).
  const previewRef = useRef(null);
  const [pw, setPw] = useState(380);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setPw(Math.min(380, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resume = useMemo(
    () => ({ ...base, data: { ...base.data, personal: { ...base.data.personal, fullName: text || ' ' } } }),
    [base, text],
  );

  return (
    <div className="ap-window">
      <div className="ap-window-bar"><i /><i /><i /></div>
      <div className="ap-window-body">
        <div className="ap-form">
          <div className="ap-field active">
            <label>Full name</label>
            <div className="ap-input">{text}<span className="ap-caret" /></div>
          </div>
          <div className="ap-field">
            <label>Headline</label>
            <div className="ap-input">Senior Product Designer</div>
          </div>
          <div className="ap-field">
            <label>Experience</label>
            <div className="ap-input">Lumen Labs · 2022 – Present</div>
            <div className="ap-input">Kite Payments · 2019 – 2022</div>
          </div>
          <div className="ap-field">
            <label>Skills</label>
            <div className="ap-input">Figma, Prototyping, Research</div>
          </div>
        </div>
        <div className="ap-preview" ref={previewRef}>
          <ResumePages resume={resume} width={pw} maxPages={1} gap={0} />
        </div>
      </div>
    </div>
  );
}

// Three styles, filled with the same person's details, fanned on the dark LinkedIn section.
function LinkedInThumbs() {
  const base = useShowcaseResume();
  return (
    <div className="ap-li-thumbs" aria-hidden>
      {['modern', 'sidebar', 'classic'].map((k, i) => (
        <div key={k} className={`ap-li-thumb t${i}`}><ResumePages resume={{ ...base, template: k }} width={170} maxPages={1} gap={0} /></div>
      ))}
    </div>
  );
}

function StyleStrip() {
  const base = useShowcaseResume();
  return (
    <div className="ap-strip" tabIndex={0} aria-label="Resume styles">
      {TEMPLATE_KEYS.map((k) => (
        <figure key={k} className="ap-style">
          <div className="ap-style-thumb"><ResumePages resume={{ ...base, template: k }} width={210} maxPages={1} gap={0} /></div>
          <figcaption>
            <b>{TEMPLATES[k].name}</b>
            <span>{TEMPLATES[k].blurb}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function Landing() {
  const ctx = useStart();
  const [contactOpen, setContactOpen] = useState(false);
  const { start, busy, error, user, demo } = ctx;
  const navigate = useNavigate();
  useReveal();

  // Support links like /#faq (e.g. from the account menu).
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (id && !id.startsWith('/')) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 300);
  }, []);

  // Returning from a redirect-based Google sign-in (mobile): go straight to the app.
  useEffect(() => {
    let flag = null;
    try { flag = sessionStorage.getItem('rk_after_login'); } catch { /* ignore */ }
    if (user && flag) {
      try { sessionStorage.removeItem('rk_after_login'); } catch { /* ignore */ }
      navigate('/app');
    }
  }, [user, navigate]);

  return (
    <div className="ap">
      <DemoBanner />
      <nav className="ap-nav">
        <div className="ap-nav-in">
          <Link to="/" className="ap-brand"><BrandMark size={26} /><Wordmark /></Link>
          <div className="ap-links">
            <a href="#live">Overview</a>
            <a href="#styles">Styles</a>
            <a href="#faq">FAQ</a>
            <Link to="/changelog">What’s new</Link>
          </div>
          <div className="ap-nav-right">
            <button className="ap-btn small" onClick={start} disabled={busy}>
              {user ? 'My resumes' : demo ? 'Get started' : 'Sign in'}
            </button>
            {user && <ProfileMenu />}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="ap-hero">
        <p className="ap-eyebrow">{APP_NAME}</p>
        <h1>Your resume.<br />Beautifully simple.</h1>
        <p className="ap-sub">Fill in a form. Watch it come to life. Export a perfect PDF.</p>
        <div className="ap-cta-row">
          <CTA label="Get started — it’s free" ctx={ctx} />
          <a className="ap-more" href="#styles">See all styles <span aria-hidden>›</span></a>
        </div>
        {error && <p className="ap-error">{error}</p>}
        <HeroFan />
      </header>

      {/* Live preview */}
      <section className="ap-section gray" id="live">
        <div className="ap-head ap-reveal">
          <h2>See every change.<br />Instantly.</h2>
          <p>Type on the left. Your resume updates on the right — exactly as it will print.</p>
        </div>
        <div className="ap-reveal"><LiveDemo /></div>
      </section>

      {/* Bento */}
      <section className="ap-section">
        <div className="ap-head ap-reveal">
          <h2>Everything you need.<br />Nothing you don’t.</h2>
        </div>
        <div className="ap-bento">
          <div className="ap-tile tall ap-reveal">
            <span className="ap-big grad">10</span>
            <h3>Styles to choose from.</h3>
            <p>From classic serif to bold color. Switch anytime — your words stay put.</p>
          </div>
          <div className="ap-tile ap-reveal">
            <span className="ap-big">PDF</span>
            <h3>Print-perfect export.</h3>
            <p>Real, selectable text that recruiters’ software can read. Clean page breaks.</p>
          </div>
          <div className="ap-tile dark ap-reveal">
            <span className="ap-big">Free.</span>
            <h3>No watermarks. No paywall.</h3>
            <p>Build, save and export as many resumes as you like.</p>
          </div>
          <div className="ap-tile ap-reveal">
            <div className="ap-stepper" aria-hidden><span>−</span><b>10 pt</b><span>+</span></div>
            <h3>Make it fit.</h3>
            <p>Adjust font size and spacing until it sits perfectly on one page.</p>
          </div>
          <div className="ap-tile ap-reveal">
            <span className="ap-big">Saved.</span>
            <h3>Pick up where you left off.</h3>
            <p>Sign in with Google. Every change saves automatically.</p>
          </div>
        </div>
      </section>

      {/* LinkedIn */}
      <section className="ap-section ap-dark" id="linkedin">
        <div className="ap-head ap-reveal">
          <p className="ap-kicker"><LinkedInLogo size={20} /> New</p>
          <h2>Your LinkedIn.<br />In every template.</h2>
          <p>Import your LinkedIn once and every template fills itself in with your experience, education and skills. No retyping.</p>
        </div>
        <div className="ap-li-flow ap-reveal">
          <div className="ap-li-profile" aria-hidden>
            <div className="ap-li-cover" />
            <div className="ap-li-avatar">PS</div>
            <b>Priya Sharma</b>
            <span>Senior Product Designer · Bengaluru</span>
            <div className="ap-li-rows">
              <div><i>Experience</i>Lumen Labs · Kite Payments · Pixelcraft</div>
              <div><i>Education</i>National Institute of Design</div>
              <div><i>Skills</i>Product design · Prototyping · Figma</div>
            </div>
          </div>
          <div className="ap-li-arrow" aria-hidden>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </div>
          <LinkedInThumbs />
        </div>
        <div className="ap-li-steps ap-reveal">
          <div><span>1</span>On LinkedIn, save your profile as a PDF</div>
          <div><span>2</span>Upload it — we read it in your browser</div>
          <div><span>3</span>Pick any template. It’s already filled in.</div>
        </div>
        <div className="ap-li-cta ap-reveal">
          <CTA label="Import from LinkedIn" ctx={ctx} />
          <p>Remove it anytime. Your existing resumes are never changed.</p>
        </div>
      </section>

      {/* Styles */}
      <section className="ap-section gray" id="styles">
        <div className="ap-head ap-reveal">
          <h2>A style for every story.</h2>
          <p>Choose a look, pick a color, done.</p>
        </div>
        <StyleStrip />
      </section>

      {/* Steps */}
      <section className="ap-section">
        <div className="ap-head ap-reveal"><h2>Three steps. That’s it.</h2></div>
        <div className="ap-steps ap-reveal">
          <div><span>1</span><h3>Sign in</h3><p>One click with Google.</p></div>
          <div><span>2</span><h3>Fill the form</h3><p>Simple questions, section by section.</p></div>
          <div><span>3</span><h3>Export</h3><p>Download a polished PDF.</p></div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ap-section gray" id="faq">
        <div className="ap-head ap-reveal"><h2>Questions? Answers.</h2></div>
        <div className="ap-faq ap-reveal">
          <details><summary>Is it really free?</summary><p>Yes. Building, saving and exporting resumes is free, with no watermarks and no download limits.</p></details>
          <details><summary>Can I fill my resume from LinkedIn?</summary><p>Yes. On LinkedIn, open your profile and choose Resources → Save to PDF, then upload that file on Your resumes. Every template fills in with your experience, education and skills. You can remove these details anytime.</p></details>
          <details><summary>Can I upload the resume I already have?</summary><p>Coming soon! We’re building a way to upload a PDF or Word file and edit it directly on the page, like a document. For now, pick a template and fill in the form — it only takes a few minutes.</p></details>
          <details><summary>Can my resume be more than one page?</summary><p>Yes. Pages break cleanly on their own. To fit everything on one page, open “Customise look” and lower the font size or choose Compact spacing.</p></details>
          <details><summary>Will applicant tracking systems read my PDF?</summary><p>Yes. The PDF contains real text, not an image, so ATS software and recruiters can search and copy it.</p></details>
          <details><summary>Where is my data stored?</summary><p>Privately, in your account. Only you can see your resumes.</p></details>
          <details><summary>How do I save the PDF?</summary><p>Click “Export PDF”, choose “Save as PDF” as the destination, then Save.</p></details>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ap-final ap-reveal">
        <h2>Your next job<br />starts here.</h2>
        <CTA label="Make my resume" ctx={ctx} />
        {error && <p className="ap-error">{error}</p>}
      </section>

      <footer className="ap-foot">
        <div className="ap-foot-top">
          <p className="ap-made">Made with <span className="ap-heart" aria-label="love">❤️</span> by {CREATOR_NAME}</p>
          <p className="ap-foot-sub">Have an idea, found a bug, or just want to say hi?</p>
          <button className="ap-contact" onClick={() => setContactOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            Contact me
          </button>
        </div>
        <div className="ap-foot-in">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <span className="ap-foot-links">
            <Link to="/changelog">What’s new</Link>
            <a href="#faq">FAQ</a>
            <button className="ap-foot-link" onClick={() => setContactOpen(true)}>Feedback</button>
          </span>
        </div>
      </footer>
      {contactOpen && <FeedbackModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
