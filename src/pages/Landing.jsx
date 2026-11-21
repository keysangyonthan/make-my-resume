import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../config';
import { useAuth } from '../lib/auth';
import { sampleResume } from '../lib/resume';
import { TEMPLATES, TEMPLATE_KEYS } from '../templates';
import ResumePages from '../components/ResumePages';
import { Brand, DemoBanner, GoogleIcon, Icon } from '../components/ui';
import { Link } from 'react-router-dom';
import { UpdateStatus } from '../components/UpdateBanner';

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
  const label = user ? 'Open my resumes' : demo ? 'Start building — free' : 'Continue with Google';
  return { start, busy, error, label, user, demo };
}

function StartButton({ size = 'lg', variant = 'primary', text }) {
  const { start, busy, label, user, demo } = useStart();
  return (
    <button className={`btn btn-${variant} ${size === 'lg' ? 'btn-lg' : ''}`} onClick={start} disabled={busy}>
      {!user && !demo && <span style={{ background: '#fff', borderRadius: 6, display: 'grid', placeItems: 'center', width: 26, height: 26 }}><GoogleIcon /></span>}
      {busy ? 'Signing in…' : text || label}
    </button>
  );
}

function HeroVisual() {
  const base = useMemo(() => sampleResume(), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % TEMPLATE_KEYS.length), 2600);
    return () => clearInterval(t);
  }, []);
  const resume = useMemo(() => ({ ...base, template: TEMPLATE_KEYS[i] }), [base, i]);
  return (
    <div className="hero-visual">
      <div className="mock">
        <div className="mock-bar"><i /><i /><i /></div>
        <div className="mock-body">
          <div className="mock-form">
            <div className="mock-card active">
              <div className="mock-label">Full name</div>
              <div className="mock-input">Priya Sharma<span className="caret" /></div>
            </div>
            <div className="mock-card">
              <div className="mock-label">Headline</div>
              <div className="mock-input">Senior Product Designer</div>
            </div>
            <div className="mock-card">
              <div className="mock-label">Experience</div>
              <div className="mock-input">Lumen Labs · 2022 – Present</div>
              <div className="mock-input" style={{ marginTop: 6 }}>Kite Payments · 2019 – 2022</div>
            </div>
            <div className="mock-card">
              <div className="mock-label">Template</div>
              <div className="mock-input" style={{ color: 'var(--brand)', fontWeight: 600 }}>{TEMPLATES[TEMPLATE_KEYS[i]].name}</div>
            </div>
          </div>
          <div className="mock-preview">
            <ResumePages resume={resume} width={250} maxPages={1} />
          </div>
        </div>
      </div>
      <div className="float-badge b1"><span className="dot" /> Live preview</div>
      <div className="float-badge b2">{Icon.download} Export as PDF</div>
    </div>
  );
}

function TemplateShowcase() {
  const base = useMemo(() => sampleResume(), []);
  return (
    <div className="tpl-showcase">
      {TEMPLATE_KEYS.map((k) => (
        <div key={k} className="tpl-show">
          <div className="thumb"><ResumePages resume={{ ...base, template: k }} width={200} maxPages={1} gap={0} /></div>
          <div className="name">{TEMPLATES[k].name}</div>
          <div className="desc">{TEMPLATES[k].blurb}</div>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const { start, busy, error, user, demo } = useStart();
  const navigate = useNavigate();

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
    <>
      <DemoBanner />
      <nav className="nav">
        <div className="nav-in">
          <Brand />
          <div className="nav-links">
            <a className="text" href="#features">Features</a>
            <a className="text" href="#templates">Templates</a>
            <a className="text" href="#faq">FAQ</a>
            <Link className="text" to="/changelog">What’s new</Link>
            <span className="hide-md"><UpdateStatus /></span>
            <button className="btn btn-primary" onClick={start} disabled={busy}>
              {user ? 'My resumes' : demo ? 'Get started' : 'Sign in'}
            </button>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="pill">100% free · No watermarks · No credit card</span>
          <h1>Your resume, <em>done in minutes.</em></h1>
          <p className="lead">
            Fill in a simple form and watch your resume take shape on the right — live. Pick a template, then export a
            clean, print-quality PDF. Sign in once and come back to update it anytime.
          </p>
          <div className="hero-cta">
            <StartButton />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>}
          <div className="hero-note"><span>Live preview</span><span>{TEMPLATE_KEYS.length} resume styles</span><span>Multi-page PDF</span></div>
        </div>
        <HeroVisual />
      </section>

      <section className="section" id="features">
        <h2>Everything you need. Nothing you don’t.</h2>
        <p className="sub">No design skills, no fiddly page layout. Type, preview, export.</p>
        <div className="features">
          <div className="feature"><div className="ic">{Icon.eyeLive}</div><h3>Live preview</h3><p>Every keystroke updates the preview instantly, exactly as it will print.</p></div>
          <div className="feature"><div className="ic">{Icon.grid}</div><h3>Concise or spacious</h3><p>{TEMPLATE_KEYS.length} styles, colors, font size and spacing — squeeze onto one page or breathe across several.</p></div>
          <div className="feature"><div className="ic">{Icon.file}</div><h3>Print-quality PDF</h3><p>Real, selectable text that applicant tracking systems can read. Clean page breaks.</p></div>
          <div className="feature"><div className="ic">{Icon.cloud}</div><h3>Saved to your account</h3><p>Sign in with Google. Your resumes autosave, so you can update them anytime.</p></div>
        </div>
      </section>

      <section className="section" id="templates" style={{ paddingTop: 24 }}>
        <h2>Pick a template. Change it anytime.</h2>
        <p className="sub">Your content stays the same — only the look changes. Choose an accent color to make it yours.</p>
        <TemplateShowcase />
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <h2>Three steps. That’s it.</h2>
        <p className="sub">Most people finish their first resume in under 15 minutes.</p>
        <div className="steps">
          <div className="step"><div className="n">1</div><h3>Sign in with Google</h3><p>One click. No passwords to remember, no forms to verify.</p></div>
          <div className="step"><div className="n">2</div><h3>Fill in the form</h3><p>Answer simple questions, section by section. The preview updates as you type.</p></div>
          <div className="step"><div className="n">3</div><h3>Export as PDF</h3><p>Hit Export and save. Come back later to tweak and export again.</p></div>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 24 }}>
        <h2>Questions</h2>
        <p className="sub">The short answers.</p>
        <div className="faq">
          <details><summary>Is it really free?</summary><p>Yes. Building, saving and exporting resumes is free, with no watermarks and no limit on downloads.</p></details>
          <details><summary>Can my resume be more than one page?</summary><p>Yes. Pages break automatically and cleanly — headings never get stranded at the bottom of a page. To fit everything on one page, open “Customise look” and lower the font size, choose Compact spacing or pick the Concise style.</p></details>
          <details><summary>Will applicant tracking systems (ATS) read my PDF?</summary><p>Yes. The PDF contains real text, not an image, so ATS software and recruiters can search and copy it.</p></details>
          <details><summary>Where is my data stored?</summary><p>Your resumes are saved privately to your account. Only you can see them.</p></details>
          <details><summary>How do I save the PDF?</summary><p>Click “Export PDF”. In the dialog that opens, choose “Save as PDF” as the destination and click Save.</p></details>
        </div>
      </section>

      <div style={{ padding: '0 24px' }}>
        <div className="cta-band">
          <h2>Ready to land the interview?</h2>
          <p>Build your resume now — it’s free.</p>
          <StartButton variant="white" />
        </div>
      </div>

      <footer className="foot">© {new Date().getFullYear()} {APP_NAME}. Made for job seekers. · <Link to="/changelog">What’s new</Link></footer>
    </>
  );
}
